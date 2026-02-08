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
const GROQ_MODEL = "llama-3.3-70b-versatile";

let useFreeMode = true;
let useOllamaMode = false;

export function setUseFreeMode(value) {
  // Deprecated for deployment: defaulted to Groq
}

export function setUseOllamaMode(value) {
  // Deprecated for deployment: defaulted to Groq
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

  const formattedResponses = responses.map((r, i) => `
QUESTION ${i + 1}: ${r.questionText}
TRANSCRIPT: "${r.transcript || 'NO SPEECH DETECTED'}"
DELAY: ${(r.delay / 1000).toFixed(1)}s
FILLERS: ${r.fillerCount}
`).join("\n---\n");

  const systemPrompt = `You are an elite interview pressure coach. Your goal is to analyze the candidate's performance under stress.
You must return your assessment in two parts:
1. A qualitative coaching summary (plain text).
2. A quantitative JSON score block.

CRITICAL FOCUS: 
- JUDGE RELEVANCE: Does the transcript actually answer the specific questions asked? If not, penalize the STRUCTURE score heavily.
- ANALYZE FILLERS: If filler count is 0, highlight this as a major strength. If it's high, give specific advice.
- SILENT SESSIONS: If transcripts are empty, state that the candidate failed to participate.

SCORING RUBRIC (0-100):
- CLARITY: Articulation purity. High fillers reduce this.
- COMPOSURE: Temporal mastery. Ideal delay is 2-4s. Silent gaps > 6s = penalty.
- STRUCTURE: RELEVANCE AND FLOW. Did they answer the question?
- CONFIDENCE: Overall authority.

RESPONSE FORMAT:
SUMMARY: (3-4 concise sentences referencing specific TRANSCRIPT details and QUESTION relevance)
IMPROVEMENTS: (3 actionable bullet points)
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

  // Attempt Groq if selected
  if (mode === 'groq' && GROQ_API_KEY) {
    try {
      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.1,
          stream: false
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || "";
        if (onToken) onToken(text.split(/SCORES:/i)[0]);
        return text;
      }
    } catch (error) {
      console.warn("Groq API error, falling back...");
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
      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: systemContext },
            ...messages.map(m => ({ role: m.role, content: m.content }))
          ],
          temperature: 0.5,
          stream: false
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || "";
        if (onToken) onToken(text);
        return text;
      }
    } catch (e) {
      console.error("Groq chat error", e);
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

export async function generateAIScore(transcript, delay, fillerCount) {
  return null;
}
