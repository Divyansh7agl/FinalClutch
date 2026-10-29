import {
  GEMINI_EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  EMBEDDING_TASK_QUERY
} from '../constants/embeddingConfig.js';

export interface QuestionBankItem {
  id: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  rubric: string[];
}

export interface EmbeddedQuestion extends QuestionBankItem {
  embedding: number[];
}

export interface RetrievedQuestion extends EmbeddedQuestion {
  similarity: number;
}

// In-memory cache for loaded embedded question bank
let cachedBank: EmbeddedQuestion[] | null = null;

/**
 * Dynamically imports questionBankEmbedded.json and caches it in memory.
 * By using dynamic import(), the embeddings JSON is not bundled into the main initial bundle.
 */
export async function getEmbeddedQuestionBank(): Promise<EmbeddedQuestion[]> {
  if (cachedBank) {
    return cachedBank;
  }
  try {
    const module = await import('../data/questionBankEmbedded.json');
    cachedBank = (module.default || module) as EmbeddedQuestion[];
    return cachedBank;
  } catch (error) {
    console.warn("Could not load questionBankEmbedded.json dynamically:", error);
    return [];
  }
}

/**
 * L2-normalizes a numerical vector so its Euclidean length is 1.0.
 */
export function l2Normalize(vector: number[]): number[] {
  const sumSq = vector.reduce((sum, val) => sum + val * val, 0);
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vector;
  return vector.map(val => val / norm);
}

/**
 * Computes cosine similarity between two vectors.
 * Since vectors are L2-normalized, cosine similarity equals the dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Embeds input query text using Google Gemini embeddings API with RETRIEVAL_QUERY task type.
 * Returns an L2-normalized vector.
 */
export async function embedQuery(queryText: string): Promise<number[]> {
  const apiKey =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_GEMINI_API_KEY
      ? import.meta.env.VITE_GEMINI_API_KEY
      : "";

  if (!apiKey || apiKey === "PLACEHOLDER_API_KEY") {
    throw new Error("Missing or invalid VITE_GEMINI_API_KEY");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_EMBEDDING_MODEL,
      content: {
        parts: [{ text: queryText }]
      },
      taskType: EMBEDDING_TASK_QUERY,
      outputDimensionality: EMBEDDING_DIMENSION
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Gemini embedQuery failed (${response.status}): ${JSON.stringify(errData)}`);
  }

  const data = await response.json();
  if (!data.embedding || !data.embedding.values) {
    throw new Error("Gemini API response did not contain embedding values");
  }

  return l2Normalize(data.embedding.values);
}

/**
 * Retrieves the topK most relevant questions from the bank for a given query text.
 */
export async function retrieveQuestions(
  queryText: string,
  topK: number = 4
): Promise<RetrievedQuestion[]> {
  const cleanQuery = (queryText || "").trim();
  if (!cleanQuery) return [];

  const bank = await getEmbeddedQuestionBank();
  if (!bank || bank.length === 0) return [];

  const queryVector = await embedQuery(cleanQuery);

  const scored: RetrievedQuestion[] = bank.map(item => ({
    ...item,
    similarity: cosineSimilarity(queryVector, item.embedding)
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
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
 * Looks up rubric for a given question text.
 * Strictly adheres to constraint:
 * ONLY return a rubric on an exact question-text match or cosine similarity >= 0.9.
 * Otherwise returns null so the answer is scored without a rubric.
 */
export async function retrieveRubricForQuestion(questionText: string): Promise<string[] | null> {
  const cleanQ = (questionText || "").trim();
  if (!cleanQ) return null;

  const bank = await getEmbeddedQuestionBank();
  if (!bank || bank.length === 0) return null;

  const lowerQ = cleanQ.toLowerCase();

  // 1. Exact match check (case-insensitive)
  const exactMatch = bank.find(item => item.question.trim().toLowerCase() === lowerQ);
  if (exactMatch && exactMatch.rubric && exactMatch.rubric.length > 0) {
    return exactMatch.rubric;
  }

  // 2. High-confidence semantic match (similarity >= 0.9)
  try {
    const queryVector = await embedQuery(cleanQ);
    let bestSimilarity = -1;
    let bestRubric: string[] | null = null;

    for (const item of bank) {
      const sim = cosineSimilarity(queryVector, item.embedding);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestRubric = item.rubric;
      }
    }

    if (bestSimilarity >= 0.90 && bestRubric && bestRubric.length > 0) {
      return bestRubric;
    }
  } catch (err) {
    console.warn("Rubric retrieval check error, falling back to null:", err);
  }

  // Never attach rubric of a merely similar question (< 0.90)
  return null;
}
