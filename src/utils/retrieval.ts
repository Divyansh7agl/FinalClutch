/**
 * Client-Side Retrieval Interface
 *
 * All vector embeddings, cosine math, and the 150-question bank are securely
 * managed on the server via /api/retrieve. The client never bundles API keys
 * or raw question vectors.
 */

export interface QuestionBankItem {
  id: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  rubric: string[];
}

export interface RetrievedQuestion extends QuestionBankItem {
  similarity: number;
}

/**
 * Retrieves the topK most relevant questions via POST /api/retrieve.
 * Fail-safe: Returns [] on any network or API error so the application never breaks.
 */
export async function retrieveQuestions(
  queryText: string,
  topK: number = 4
): Promise<RetrievedQuestion[]> {
  const cleanQuery = (queryText || "").trim();
  if (!cleanQuery) return [];

  try {
    const response = await fetch('/api/retrieve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'questions',
        query: cleanQuery.slice(0, 500),
        k: topK
      })
    });

    if (!response.ok) {
      console.warn(`[Retrieval] /api/retrieve responded with status ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data.questions) ? data.questions : [];
  } catch (err) {
    console.warn('[Retrieval] Failed to fetch questions from /api/retrieve, falling back to empty:', err);
    return [];
  }
}

/**
 * Formats retrieved questions into a clean reference string to pass as `examples`.
 */
export function formatQuestionsForPrompt(questions: RetrievedQuestion[]): string {
  if (!questions || questions.length === 0) return "";
  return questions
    .map((q, i) => `${i + 1}. [${q.topic} - ${q.difficulty.toUpperCase()}] ${q.question}`)
    .join("\n");
}

/**
 * Looks up rubric for a given question via POST /api/retrieve.
 * Supports questionId as primary key and questionText as fallback.
 * Strictly returns null if similarity < 0.90 on fuzzy matches.
 * Fail-safe: Returns null on any error so scoring continues without rubric.
 */
export async function retrieveRubricForQuestion(
  questionText: string,
  questionId?: string
): Promise<string[] | null> {
  const cleanQ = (questionText || "").trim();
  const cleanId = (questionId || "").trim();
  if (!cleanQ && !cleanId) return null;

  try {
    const response = await fetch('/api/retrieve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rubric',
        questionId: cleanId || undefined,
        questionText: cleanQ ? cleanQ.slice(0, 500) : undefined
      })
    });

    if (!response.ok) {
      console.warn(`[Retrieval] /api/retrieve rubric responded with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    return Array.isArray(data.rubric) ? data.rubric : null;
  } catch (err) {
    console.warn('[Retrieval] Failed to fetch rubric from /api/retrieve, falling back to null:', err);
    return null;
  }
}
