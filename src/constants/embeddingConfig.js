/**
 * Shared Gemini Embedding configuration used by both:
 * 1. scripts/embedQuestionBank.mjs (Node.js script to embed the offline bank)
 * 2. src/utils/retrieval.ts (Runtime browser vector retrieval)
 *
 * Model: models/gemini-embedding-001
 * Why chosen: Google's current recommended GA embedding model supporting
 * MRL (Matryoshka Representation Learning) output dimensionality (768)
 * and asymmetric retrieval tasks (RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY).
 */
export const GEMINI_EMBEDDING_MODEL = 'models/gemini-embedding-001';
export const EMBEDDING_DIMENSION = 768;
export const EMBEDDING_TASK_DOCUMENT = 'RETRIEVAL_DOCUMENT';
export const EMBEDDING_TASK_QUERY = 'RETRIEVAL_QUERY';
