import {
  GEMINI_EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  EMBEDDING_TASK_QUERY
} from '../../src/constants/embeddingConfig.js';
import questionBankRaw from '../../src/data/questionBankEmbedded.json' with { type: 'json' };

export interface EmbeddedBankItem {
  id: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  rubric: string[];
  embedding: number[];
}

export interface RetrievedResult {
  id: string;
  question: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  rubric: string[];
  similarity: number;
}

export interface RetrievalFilters {
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * Dual-signal retrieval confidence thresholds derived from empirical testing:
 * - High-confidence direct match: >= 0.68
 * - Marginal match: 0.63 <= score < 0.68 requires minimum gap of >= 0.03 to top-2
 * - Below 0.63 or flat distribution (gap < 0.03): flagged as lowConfidence
 */
export const RETRIEVAL_HIGH_CONFIDENCE_THRESHOLD = 0.68;
export const RETRIEVAL_MIN_CONFIDENCE_THRESHOLD = 0.63;
export const RETRIEVAL_MIN_TOP_GAP = 0.030;
export const RETRIEVAL_CONFIDENCE_THRESHOLD = 0.68;

// Statically traced and bundled bank item array
const loadedBank = (questionBankRaw as unknown) as EmbeddedBankItem[];

export function getLoadedBank(): EmbeddedBankItem[] {
  return loadedBank;
}

function l2Normalize(vector: number[]): number[] {
  const sumSq = vector.reduce((sum, val) => sum + val * val, 0);
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vector;
  return vector.map(val => val / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export async function embedQueryServer(queryText: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GEMINI_EMBEDDING_MODEL,
      content: { parts: [{ text: queryText }] },
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
    throw new Error('No embedding values returned from Gemini API');
  }

  return l2Normalize(data.embedding.values);
}

/**
 * Reusable retrieval interface:
 * getRelevantQuestions(query, filters, k)
 */
export async function getRelevantQuestions(
  query: string,
  filters?: RetrievalFilters,
  k: number = 4
): Promise<{ questions: RetrievedResult[]; lowConfidence: boolean }> {
  const bank = getLoadedBank();
  if (!bank || bank.length === 0) {
    return { questions: [], lowConfidence: true };
  }

  let candidates = bank;
  if (filters?.topic) {
    const targetTopic = filters.topic.toLowerCase();
    const filtered = candidates.filter(item => item.topic.toLowerCase() === targetTopic);
    if (filtered.length > 0) candidates = filtered;
  }
  if (filters?.difficulty) {
    const targetDiff = filters.difficulty.toLowerCase();
    const filtered = candidates.filter(item => item.difficulty.toLowerCase() === targetDiff);
    if (filtered.length > 0) candidates = filtered;
  }

  const queryVector = await embedQueryServer(query);
  const scored: RetrievedResult[] = candidates.map(item => ({
    id: item.id,
    question: item.question,
    topic: item.topic,
    difficulty: item.difficulty,
    rubric: item.rubric,
    similarity: cosineSimilarity(queryVector, item.embedding)
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  const topMatches = scored.slice(0, k);

  const topScore = topMatches.length > 0 ? topMatches[0].similarity : 0;
  const secondScore = topMatches.length > 1 ? topMatches[1].similarity : 0;
  const topGap = topScore - secondScore;

  // Dual-signal confidence evaluation:
  // 1. Clear hit: topScore >= RETRIEVAL_HIGH_CONFIDENCE_THRESHOLD (0.68)
  // 2. Marginal hit: topScore >= RETRIEVAL_MIN_CONFIDENCE_THRESHOLD (0.63) AND topGap >= RETRIEVAL_MIN_TOP_GAP (0.03)
  // Otherwise: lowConfidence = true
  const isHighConfidence = topScore >= RETRIEVAL_HIGH_CONFIDENCE_THRESHOLD;
  const isMarginalWithGap = topScore >= RETRIEVAL_MIN_CONFIDENCE_THRESHOLD && topGap >= RETRIEVAL_MIN_TOP_GAP;
  const lowConfidence = !(isHighConfidence || isMarginalWithGap);

  return { questions: topMatches, lowConfidence };
}

/**
 * Rubric lookup:
 * 1. Primary key match on questionId (0ms, 0 API calls)
 * 2. Exact questionText match (0ms, 0 API calls)
 * 3. Semantic fuzzy match ONLY if similarity >= 0.90
 */
export async function lookupRubric(
  questionId?: string,
  questionText?: string
): Promise<{ rubric: string[] | null; matchType: 'id' | 'exact' | 'fuzzy' | 'none'; similarity?: number }> {
  const bank = getLoadedBank();
  if (!bank || bank.length === 0) {
    return { rubric: null, matchType: 'none' };
  }

  // 1. Primary Key: questionId
  if (questionId) {
    const cleanId = questionId.trim().toLowerCase();
    const match = bank.find(item => item.id.toLowerCase() === cleanId);
    if (match && match.rubric && match.rubric.length > 0) {
      return { rubric: match.rubric, matchType: 'id' };
    }
  }

  if (!questionText || !questionText.trim()) {
    return { rubric: null, matchType: 'none' };
  }

  const cleanQ = questionText.trim().toLowerCase();

  // 2. Exact match check
  const exactMatch = bank.find(item => item.question.trim().toLowerCase() === cleanQ);
  if (exactMatch && exactMatch.rubric && exactMatch.rubric.length > 0) {
    return { rubric: exactMatch.rubric, matchType: 'exact' };
  }

  // 3. Fuzzy semantic fallback for dynamic LLM questions
  try {
    const queryVector = await embedQueryServer(questionText.trim());
    let bestSim = -1;
    let bestRubric: string[] | null = null;

    for (const item of bank) {
      const sim = cosineSimilarity(queryVector, item.embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestRubric = item.rubric;
      }
    }

    if (bestSim >= 0.90 && bestRubric && bestRubric.length > 0) {
      return { rubric: bestRubric, matchType: 'fuzzy', similarity: bestSim };
    }
    return { rubric: null, matchType: 'none', similarity: bestSim };
  } catch (err) {
    console.warn('Semantic rubric lookup failed:', err);
    return { rubric: null, matchType: 'none' };
  }
}
