import {
  retrieveQuestions,
  formatQuestionsForPrompt,
  retrieveRubricForQuestion
} from './retrieval';

const CANDIDATE_LEVEL = "college student or fresher applying for internships and entry-level roles";

export function setUseFreeMode(value) {
  // Deprecated: All requests route through the secure serverless /api backend
}

export function setUseOllamaMode(value) {
  // Deprecated: All requests route through the secure serverless /api backend
}

function extractQueryFromContext(context) {
  if (!context) return "";

  const resumeMatch = context.match(/candidate resume context:\s*([\s\S]+)/i);
  if (resumeMatch && resumeMatch[1]) {
    const resumeText = resumeMatch[1];
    const prefixContext = context.replace(/candidate resume context:[\s\S]+/i, '').trim();

    // Extract high-signal Skills / Technologies / Projects sections from the resume
    const skillsMatch = resumeText.match(/(?:skills|technical skills|technologies|tools|languages)\s*[:\-\n]([^\n]+(?:\n[^\n]+)?)/i);
    const projectsMatch = resumeText.match(/(?:projects|key projects|academic projects)\s*[:\-\n]([^\n]+(?:\n[^\n]+)?)/i);

    let parts = [];
    if (prefixContext) parts.push(prefixContext.slice(0, 100));
    if (skillsMatch && skillsMatch[1]) {
      parts.push(skillsMatch[1].replace(/[\r\n]+/g, ' ').slice(0, 150));
    }
    if (projectsMatch && projectsMatch[1]) {
      parts.push(projectsMatch[1].replace(/[\r\n]+/g, ' ').slice(0, 150));
    }

    if (parts.length > 0) {
      return parts.join('; ').trim().slice(0, 300);
    }

    return `${prefixContext} ${resumeText.slice(0, 150)}`.trim();
  }

  return context.slice(0, 250).trim();
}

function extractQueryForNextQuestion(history, context) {
  const shortContext = (context || "").replace(/candidate resume context:[\s\S]+/i, '').slice(0, 100).trim();
  const lastAnswer = history && history.length > 0 ? history[history.length - 1].answer : "";
  if (lastAnswer) {
    return `${shortContext} ${lastAnswer.slice(0, 200)}`.trim();
  }
  return extractQueryFromContext(context);
}

function buildLocalFeedback(transcript, delay, fillerCount, confidenceScore) {
  const safeTranscript = (transcript || "").trim();
  const wordCount = safeTranscript ? safeTranscript.split(/\s+/).length : 0;
  const styleIndex = (Math.max(0, delay) + fillerCount * 37 + wordCount * 11) % 3;
  const clarityNote =
    fillerCount > 6
      ? "Filler words broke the rhythm and reduced clarity."
      : fillerCount > 0
        ? "Clarity stayed solid with minor filler interruptions."
        : "Clarity was clean with minimal filler interference.";
  const pacingNote =
    delay > 6000
      ? "Response timing was slow; the opening could be sharper."
      : delay > 2500
        ? "Response timing was steady but could be faster."
        : "Response timing was sharp and confident.";
  const confidenceNote =
    confidenceScore >= 80
      ? "Composure stayed strong under pressure."
      : confidenceScore >= 55
        ? "Composure was stable with slight dips under stress."
        : "Composure dropped under pressure; slow your cadence.";
  const contextNote = safeTranscript
    ? wordCount < 20
      ? "Your answer felt short; add one concrete example."
      : "Your answer had substance; tighten structure for impact."
    : "No transcript detected; confirm the mic is active.";

  const improvements = [
    "- Open with a one-sentence headline before details.",
    `- Replace fillers with a brief silent pause (count: ${fillerCount}).`,
    "- Close with a concrete result or takeaway.",
  ];

  if (delay > 6000) {
    improvements[0] = "- Lead faster with a clear opening line in the first 2 seconds.";
  }

  if (wordCount < 15) {
    improvements[2] = "- Add one specific detail to show depth before closing.";
  }

  const closingLines = [
    "Strong progress. Keep the pressure on.",
    "You are close. Tighten the delivery and keep momentum.",
    "Solid base. Next run, focus on sharper openings.",
  ];

  return [
    `${clarityNote} ${pacingNote} ${confidenceNote} ${contextNote}`,
    improvements[0],
    improvements[1],
    improvements[2],
    closingLines[styleIndex],
  ].join("\n");
}

/**
 * Helper to call the serverless /api/interview endpoint.
 * Returns null if offline or on network failure.
 */
async function callInterviewApi(action, payload) {
  try {
    const response = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });

    if (!response.ok) {
      console.warn(`[Interview API] /api/interview responded with HTTP ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.warn('[Interview API] Network error communicating with /api/interview:', err);
    return null;
  }
}

let lastFeedbackMeta = {
  isFallback: false,
  droppedRubric: false,
  notice: null
};

export function getLastFeedbackMeta() {
  return lastFeedbackMeta;
}

export async function generateAIFeedback(
  transcript,
  delay,
  fillerCount,
  confidenceScore,
  onToken = null,
  mode = 'free',
  responses = []
) {
  console.log("[AI Feedback] Triggered with data:", { delay, fillerCount, transcriptLength: transcript?.length, responseCount: responses.length });
  lastFeedbackMeta = { isFallback: false, droppedRubric: false, notice: null };

  // 1. Retrieve rubrics for each question where available
  let enrichedResponses = [];
  let rubricLookupFailed = false;
  try {
    enrichedResponses = await Promise.all(
      responses.map(async (r) => {
        const rubric = await retrieveRubricForQuestion(r.questionText, r.questionId);
        return {
          questionText: r.questionText || '',
          rubric: rubric || undefined,
          transcript: r.transcript || '',
          delay: r.delay || 0,
          fillerCount: r.fillerCount || 0
        };
      })
    );
  } catch (err) {
    console.warn("[AI Feedback] Rubric lookup failed, proceeding without rubrics:", err);
    rubricLookupFailed = true;
    enrichedResponses = responses.map(r => ({
      questionText: r.questionText || '',
      transcript: r.transcript || '',
      delay: r.delay || 0,
      fillerCount: r.fillerCount || 0
    }));
  }

  const hadQuestions = enrichedResponses.length > 0;
  const missingRubricCount = enrichedResponses.filter(r => !r.rubric).length;
  const rubricsDropped = rubricLookupFailed || (hadQuestions && missingRubricCount === enrichedResponses.length);

  // 2. Call serverless backend (dev-only ?forceFallback=true for testing offline fallback mode)
  const isDev = Boolean(import.meta.env?.DEV);
  const forceFallback = isDev && typeof window !== 'undefined' && window.location.search.includes('forceFallback=true');
  const data = forceFallback ? null : await callInterviewApi('feedback', {
    transcript: (transcript || "").slice(0, 5000),
    delay,
    fillerCount,
    confidenceScore,
    responses: enrichedResponses
  });

  if (data && data.feedback) {
    const isOfflineFallback = Boolean(data.isFallback);
    lastFeedbackMeta = {
      isFallback: isOfflineFallback,
      droppedRubric: rubricsDropped,
      modelUsed: data.modelUsed || null,
      notice: isOfflineFallback
        ? 'Offline feedback mode: AI feedback unavailable'
        : (rubricsDropped ? 'Standard AI feedback: Domain rubrics unavailable' : null)
    };
    if (onToken) onToken(data.feedback.split(/SCORES:/i)[0]);
    return data.feedback;
  }

  // 3. Fail-safe: Local rule-based coaching fallback
  console.warn("[AI Feedback] Serverless LLM unavailable, using local heuristic fallback.");
  lastFeedbackMeta = {
    isFallback: true,
    droppedRubric: true,
    modelUsed: null,
    notice: 'Offline feedback mode: AI feedback unavailable'
  };
  const localFallback = buildLocalFeedback(transcript, delay, fillerCount, confidenceScore);
  if (onToken) onToken(localFallback);
  return localFallback;
}

export async function generateAIChat(messages, context, onToken = null, mode = 'free') {
  const { fillerCount } = context || {};
  const fallbackMsg = `Based on your interview metrics, focus on keeping your response delay steady and minimizing filler words (recorded: ${fillerCount || 0}). Structure your answers with clear opening headlines.`;
  if (onToken) onToken(fallbackMsg);
  return fallbackMsg;
}

export async function generateAIQuestions(context = "General High-Pressure Interview", count = 5, mode = 'groq', difficulty = 'medium', examples = "") {
  let ragExamples = examples || "";
  if (!ragExamples) {
    try {
      const query = extractQueryFromContext(context);
      if (query) {
        const retrieved = await retrieveQuestions(query, 4);
        if (retrieved && retrieved.length > 0) {
          ragExamples = formatQuestionsForPrompt(retrieved);
        }
      }
    } catch (e) {
      console.warn("[AI Questions] RAG retrieval failed, continuing with empty examples:", e);
      ragExamples = "";
    }
  }

  const data = await callInterviewApi('generate-questions', {
    context: String(context).slice(0, 3000),
    count,
    difficulty,
    examples: ragExamples
  });

  if (data && Array.isArray(data.questions)) {
    return data.questions;
  }

  return null;
}

export async function generateNextAIQuestion(history = [], context = "General High-Pressure Interview", mode = 'groq', difficulty = 'medium', examples = "") {
  let ragExamples = examples || "";
  if (!ragExamples) {
    try {
      const query = extractQueryForNextQuestion(history, context);
      if (query) {
        const retrieved = await retrieveQuestions(query, 3);
        if (retrieved && retrieved.length > 0) {
          ragExamples = formatQuestionsForPrompt(retrieved);
        }
      }
    } catch (e) {
      console.warn("[AI Next Question] RAG retrieval failed, continuing with empty examples:", e);
      ragExamples = "";
    }
  }

  const data = await callInterviewApi('next-question', {
    history,
    context: String(context).slice(0, 3000),
    difficulty,
    examples: ragExamples
  });

  if (data && typeof data.question === 'string') {
    return data.question;
  }

  const fallbackQuestions = [
    "Could you walk me through a technical project you built recently and what role you played in it?",
    "What was the most challenging bug you encountered in your projects, and how did you diagnose it?",
    "How do you decide what tools or frameworks to use when starting a new application?",
    "Could you tell me more about your experience handling conflict or tight deadlines in a team?",
    "If you had another month to work on your latest project, what would you improve or refactor?"
  ];
  return fallbackQuestions[Math.min(history.length, fallbackQuestions.length - 1)];
}

export async function generateFollowupChallenge(previousQuestion = '', previousAnswer = '', difficulty = 'medium', examples = "") {
  let ragExamples = examples || "";
  if (!ragExamples && previousAnswer) {
    try {
      const retrieved = await retrieveQuestions(previousAnswer.slice(0, 200), 2);
      if (retrieved && retrieved.length > 0) {
        ragExamples = formatQuestionsForPrompt(retrieved);
      }
    } catch (e) {
      console.warn("[AI Followup Challenge] RAG retrieval failed:", e);
      ragExamples = "";
    }
  }

  const data = await callInterviewApi('followup', {
    previousQuestion,
    previousAnswer,
    difficulty,
    examples: ragExamples
  });

  if (data && typeof data.question === 'string') {
    return data.question;
  }

  return previousAnswer
    ? "That answer was a bit brief. Walk me through one concrete implementation decision and what trade-offs you considered."
    : "Tell me about a time a project decision you made did not go as planned, and what you would do differently today.";
}

export async function generateAIScore(transcript, delay, fillerCount) {
  return null;
}
