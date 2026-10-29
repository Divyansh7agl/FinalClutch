import {
  retrieveQuestions,
  formatQuestionsForPrompt,
  retrieveRubricForQuestion
} from './retrieval';

const API_KEY =
  typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_GEMINI_API_KEY
    ? import.meta.env.VITE_GEMINI_API_KEY
    : "";
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";
const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = "gemma2:2b";
const GROQ_API_KEY =
  typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_GROQ_API_KEY
    ? import.meta.env.VITE_GROQ_API_KEY
    : "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_GROQ_MODEL) ||
  "openai/gpt-oss-120b";

async function fetchGroqChatCompletion(payload) {
  const models = [
    GROQ_MODEL,
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile"
  ];
  const uniqueModels = Array.from(new Set(models.filter(Boolean)));

  for (const model of uniqueModels) {
    try {
      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({ ...payload, model })
      });
      if (response.ok) {
        return response;
      }
      const err = await response.clone().json().catch(() => null);
      if (response.status === 404 || err?.error?.code === 'model_not_found') {
        console.warn(`Groq model ${model} unavailable, trying fallback...`);
        continue;
      }
      return response;
    } catch (e) {
      console.warn(`Groq network error with model ${model}:`, e);
    }
  }
  return null;
}

const CANDIDATE_LEVEL = "college student or fresher applying for internships and entry-level roles";

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

    // Fallback: combine role/topic prefix and a concise slice of resume text
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

let useFreeMode = true;
let useOllamaMode = false;

export function setUseFreeMode(value) {
  // Deprecated for deployment: defaulted to standard AI
}

export function setUseOllamaMode(value) {
  // Deprecated for deployment: defaulted to standard AI
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

export async function generateAIFeedback(
  transcript,
  delay,
  fillerCount,
  confidenceScore,
  onToken = null,
  mode = 'free',
  responses = []
) {
  console.log("AI function triggered with data:", { delay, fillerCount, transcriptLength: transcript?.length, responseCount: responses.length });
  const trimmedTranscript = (transcript || "").slice(0, 3000);
  const delaySec = (delay / 1000).toFixed(1);

  // Retrieve rubrics for each question where available (exact match or similarity >= 0.9)
  let rubricList = [];
  try {
    rubricList = await Promise.all(
      responses.map(async (r) => {
        if (!r.questionText) return null;
        return await retrieveRubricForQuestion(r.questionText);
      })
    );
  } catch (err) {
    console.warn("Rubric retrieval failed in generateAIFeedback, proceeding without rubrics:", err);
    rubricList = responses.map(() => null);
  }

  const hasRubrics = rubricList.some(r => r && r.length > 0);

  const formattedResponses = responses.map((r, i) => {
    const rubric = rubricList[i];
    const rubricSection = rubric && rubric.length > 0
      ? `\nKEY EXPECTED RUBRIC CRITERIA:\n${rubric.map(point => `  * ${point}`).join("\n")}`
      : "";

    return `
QUESTION ${i + 1}: ${r.questionText}${rubricSection}
TRANSCRIPT: "${r.transcript || 'NO SPEECH DETECTED'}"
DELAY: ${(r.delay / 1000).toFixed(1)}s
FILLERS: ${r.fillerCount}
`;
  }).join("\n---\n");

  const systemPrompt = `You are an elite interview pressure coach. Your goal is to analyze the candidate's performance under stress.
You must return your assessment in two parts:
1. A qualitative coaching summary (plain text).
2. A quantitative JSON score block.

CRITICAL FOCUS: 
- JUDGE RELEVANCE: Does the transcript actually answer the specific questions asked? If not, penalize the STRUCTURE score heavily.
- ANALYZE FILLERS: If filler count is 0, highlight this as a major strength. If it's high, give specific advice.
- SILENT SESSIONS: If transcripts are empty, state that the candidate failed to participate.
${hasRubrics ? `- EVALUATE RUBRICS: For questions with "KEY EXPECTED RUBRIC CRITERIA", directly compare the candidate's transcript against those points. In SUMMARY and IMPROVEMENTS, explicitly mention which key points were covered and specifically name any criteria they missed.` : ''}

SCORING RUBRIC (0-100):
- CLARITY: Articulation purity. High fillers reduce this.
- COMPOSURE: Temporal mastery. Ideal delay is 2-4s. Silent gaps > 6s = penalty.
- STRUCTURE: RELEVANCE AND FLOW. Did they answer the question?
- CONFIDENCE: Overall authority.

RESPONSE FORMAT:
SUMMARY: (3-4 concise sentences referencing specific TRANSCRIPT details and QUESTION relevance${hasRubrics ? ', explicitly naming key criteria covered or missed' : ''})
IMPROVEMENTS: (3 actionable bullet points${hasRubrics ? ', specifying exact missed criteria from the rubric when applicable' : ''})
MOTIVATION: (1 short punchy line)

SCORES: {"clarity": X, "composure": X, "structure": X, "confidence": X}`;

  const userPrompt = `Context:
FULL SESSION DATA:
${formattedResponses}

AGGREGATED METRICS:
Total Transcript: "${trimmedTranscript}"
Average Delay: ${delaySec} seconds
Total Filler Count: ${fillerCount}
Raw Simulation Heuristic Score: ${confidenceScore}%

Analyze the candidate's responses for relevance and delivery now.`;

  // Attempt Primary AI if selected
  if (mode === 'groq' && GROQ_API_KEY) {
    try {
      const response = await fetchGroqChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        stream: false
      });

      if (response && response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || "";
        if (onToken) onToken(text.split(/SCORES:/i)[0]);
        return text;
      }
    } catch (error) {
      console.warn("Primary AI API error, falling back...");
    }
  }

  // Attempt Ollama if selected
  if (mode === 'ollama') {
    try {
      const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          system: systemPrompt,
          prompt: userPrompt,
          stream: !!onToken,
          options: { temperature: 0.1, num_ctx: 2048, num_predict: 300 }
        }),
      });

      if (response.ok) {
        if (onToken) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullText = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (data.response) {
                  fullText += data.response;
                  onToken(fullText.split("SCORES:")[0]);
                }
              } catch (e) { }
            }
          }
          return fullText;
        } else {
          const data = await response.json();
          return data.response;
        }
      }
    } catch (error) {
      console.warn("Ollama unavailable, falling back...");
    }
  }

  // Attempt Gemini if selected
  if (mode === 'gemini' && API_KEY && API_KEY !== "PLACEHOLDER_API_KEY") {
    try {
      const response = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (onToken) onToken(text.split(/SCORES:/i)[0]);
        return text;
      }
    } catch (error) {
      console.warn("Gemini API error, falling back...");
    }
  }

  // Final fallback to Local Hand-coded
  const feedback = buildLocalFeedback(transcript, delay, fillerCount, confidenceScore);
  if (onToken) onToken(feedback);
  return feedback;
}

export async function generateAIChat(messages, context, onToken = null, mode = 'free') {
  const { transcript, delay, fillerCount, confidenceScore } = context;
  const systemContext = `
    You are an interview coach. You are discussing the user's recent performance.
    
    Session Context:
    - Transcript: ${transcript}
    - Delay: ${delay}ms
    - Fillers: ${fillerCount}
    - Score: ${confidenceScore}%
    
    Keep responses brief, coaching-focused, and direct. 
    Reference specific parts of their transcript when giving advice.

    SCORING RUBRIC (Reference these for advice):
    CLARITY: Vocal hygiene, word choice.
    COMPOSURE: Timing, steadiness.
    STRUCTURE: Argument coherence, transitions.
    CONFIDENCE: Authority.
  `.trim();

  // Unified Chat Logic
  if (mode === 'groq' && GROQ_API_KEY) {
    try {
      const response = await fetchGroqChatCompletion({
        messages: [
          { role: "system", content: systemContext },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        temperature: 0.5,
        stream: false
      });

      if (response && response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || "";
        if (onToken) onToken(text);
        return text;
      }
    } catch (e) {
      console.error("AI chat error", e);
    }
  }

  if (mode === 'ollama') {
    try {
      const prompt = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + '\nAssistant:';
      const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          system: systemContext,
          prompt,
          stream: !!onToken,
        }),
      });

      if (response.ok) {
        let fullText = "";
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.response) {
                fullText += data.response;
                if (onToken) onToken(fullText);
              }
            } catch (e) { }
          }
        }
        return fullText;
      }
    } catch (e) {
      console.error("Ollama chat error", e);
    }
  }

  if (mode === 'groq' && GROQ_API_KEY) {
    // Already handled above
  }

  // Fallback for Chat
  const fallbackMsg = "I'm currently in offline mode. Based on your transcript, focus on reducing those ${fillerCount} fillers and keeping your response delay under 2 seconds. What else would you like to know?";
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
      console.warn("RAG retrieval failed in generateAIQuestions, continuing with empty examples:", e);
      ragExamples = "";
    }
  }

  const hasResumeContext = /candidate resume context:/i.test(context);
  const difficultyInstructions = {
    easy: "Generate beginner-friendly, straightforward questions focusing on fundamental concepts and basic scenarios. Keep questions simple and accessible.",
    medium: "Generate standard interview questions with moderate complexity and balanced difficulty.",
    hard: "Generate advanced, challenging questions with complex edge cases, deep technical scenarios, and high-pressure situations. Make them intellectually demanding."
  };

  const difficultyInstruction = difficultyInstructions[difficulty] || difficultyInstructions.medium;

  const systemPrompt = `You are an experienced interviewer preparing questions for a live interview.
Candidate level: ${CANDIDATE_LEVEL}.
Context: ${context}.
Generate ${count} questions.

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
${difficultyInstruction}

Rules:
- Each question is 1-2 plain sentences, exactly as a person would say it out loud.
- Every question differs in topic and type: cover a mix of project decision, fundamentals check, "what would happen if" scenario, and trade-off.
- No definition-only questions unless difficulty is EASY.
- No theatrical phrasing, no jargon like "delve" or "navigate".
- Order questions from easier to harder.
${hasResumeContext
  ? '- RESUME PRIORITY: Most questions must be grounded in specific projects, tools, and decisions from the resume — ask why they chose something, what broke, or what they would change. Do not just ask them to describe a project.'
  : '- Ask broadly relevant questions for the given context.'}
${ragExamples ? `\nReal questions for style reference only, do not copy them:\n${ragExamples}` : ''}

Return ONLY a JSON array of strings. No introductory text, no markdown code blocks.
Example: ["Question 1", "Question 2"]`;

  if (mode === 'groq' && GROQ_API_KEY) {
    try {
      const response = await fetchGroqChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the questions now." }
        ],
        temperature: 0.7,
        stream: false
      });

      if (response && response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || "";
        // Clean up potential markdown formatting if the model ignored instructions
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
          const questions = JSON.parse(cleanedText);
          if (Array.isArray(questions)) {
            return questions.map((q, i) => ({ id: `ai-${Date.now()}-${i}`, text: q }));
          }
        } catch (e) {
          console.error("Failed to parse AI questions JSON", e, cleanedText);
        }
      }
    } catch (error) {
      console.warn("AI API error generating questions:", error);
    }
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
      console.warn("RAG retrieval failed in generateNextAIQuestion, continuing with empty examples:", e);
      ragExamples = "";
    }
  }

  const historyText = history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`).join('\n\n');
  const hasResumeContext = /candidate resume context:/i.test(context);

  const difficultyInstructions = {
    easy: "Keep questions beginner-friendly and straightforward. Focus on basic concepts and avoid complex scenarios.",
    medium: "Maintain standard interview difficulty with moderate complexity.",
    hard: "Make questions challenging and intellectually demanding. Include complex scenarios, edge cases, and deep technical probing."
  };

  const difficultyInstruction = difficultyInstructions[difficulty] || difficultyInstructions.medium;

  const systemPrompt = `You are a senior engineer interviewing a candidate live.
Candidate level: ${CANDIDATE_LEVEL}.
Context: ${context}.

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
${difficultyInstruction}

${hasResumeContext
  ? 'RESUME PRIORITY: Keep follow-up questions tightly aligned to resume claims — projects, tech stack, impact metrics, specific decisions.'
  : 'Keep follow-up questions aligned to the provided interview context.'}

Conversation so far:
${historyText}

Decide the next move based on the candidate's LAST answer:
- Vague or short -> ask one specific follow-up about the exact thing they skipped.
- Wrong or shaky -> probe the gap once, calmly, without correcting them outright.
- Strong -> go one level deeper or move to a related topic.
- After 2 follow-ups on one topic -> move to a new topic from the resume or context.

Rules:
- ONE question, maximum 2 sentences, spoken style.
- No praise, no feedback, no summary of their answer.
- Never repeat or rephrase an earlier question.
${ragExamples ? `\nReal questions for style reference only, do not copy them:\n${ragExamples}` : ''}

Return ONLY the question text, no quotes or preamble.`;

  if (mode === 'groq' && GROQ_API_KEY) {
    try {
      const response = await fetchGroqChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the next conversational follow-up question now." }
        ],
        temperature: 0.8,
        stream: false
      });

      if (response && response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || "";
        return text.trim();
      }
    } catch (error) {
      console.warn("AI API error generating next question:", error);
    }
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
      console.warn("RAG retrieval failed in generateFollowupChallenge:", e);
      ragExamples = "";
    }
  }

  const difficultyInstructions = {
    easy: "Ask a probing follow-up that gently challenges one part of the answer. Stay direct but not harsh.",
    medium: "Ask a sharp follow-up that exposes a gap, contradiction, or vague claim in the answer. Be direct and specific.",
    hard: "Be a ruthless interrogator. Find the weakest point in the answer — an assumption, a vague claim, a missing metric — and attack it with a single, pointed question. No warmth."
  };
  const difficultyInstruction = difficultyInstructions[difficulty] || difficultyInstructions.medium;

  const hasHistory = previousQuestion && previousAnswer;

  const systemPrompt = `You are a tough technical interviewer who does not accept vague answers. You are not rude, but you push hard on weak spots.
Candidate level: ${CANDIDATE_LEVEL}.

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
${difficultyInstruction}

${hasHistory
  ? `Previous question: ${previousQuestion}
Candidate's answer: ${previousAnswer}

Ask ONE follow-up that attacks the weakest point in their answer. Pick the best fit from:
- A claim they made with no evidence or numbers.
- A trade-off they ignored.
- An edge case or failure mode they did not mention.
- A hidden assumption about scale, data, or environment.

Rules: 1-2 short sentences, direct and a little cold, no insults, do not repeat the previous question.
Return ONLY the question text, no quotes or preamble.`
  : `Ask one direct, specific question on the context with no warm-up, the way a real interviewer opens when short on time.
Rules: 1-2 sentences, plain spoken language, no theatrical phrasing.
Return ONLY the question text, no quotes or preamble.`}
${ragExamples ? `\nReal questions for style reference only, do not copy them:\n${ragExamples}` : ''}`;

  if (GROQ_API_KEY) {
    try {
      const response = await fetchGroqChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the follow-up challenge question now." }
        ],
        temperature: 0.85,
        stream: false
      });

      if (response && response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || "";
        return text.trim();
      }
    } catch (error) {
      console.warn("AI API error generating follow-up challenge:", error);
    }
  }
  return previousAnswer
    ? "That answer was vague. Give me one concrete example with actual numbers to back it up."
    : "Walk me through a time you failed under pressure — and tell me exactly what you did wrong.";
}

export async function generateAIScore(transcript, delay, fillerCount) {
  return null;
}
