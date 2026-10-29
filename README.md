## Run Locally

**Prerequisites:** Node.js (v18+)

1. Install dependencies:
   `npm install`
2. Create `.env.local` and set your API keys:
   - `VITE_GEMINI_API_KEY=your_gemini_api_key`
   - `VITE_GROQ_API_KEY=your_groq_api_key`
3. Run the app:
   `npm run dev`

---

## Question Bank & Lightweight RAG

This project features a lightweight Retrieval-Augmented Generation (RAG) system with **no external vector database**. Question embeddings are precomputed offline and queried in the browser using pure TypeScript cosine similarity over L2-normalized vectors.

### Embedding Model Configuration
- **Model:** `models/gemini-embedding-001` (Google's currently recommended embedding model).
- **Output Dimensionality:** 768 (Matryoshka Representation Learning).
- **Asymmetric Task Types:** `RETRIEVAL_DOCUMENT` for offline bank generation, `RETRIEVAL_QUERY` for live user queries.
- **Normalization:** Both document and query vectors are L2-normalized so cosine similarity is computed directly via dot product.
- **Bundle Optimization:** `questionBankEmbedded.json` is loaded dynamically via `import()` and cached in memory, keeping the main bundle lean.
- **Shared Configuration:** Centralized in `src/constants/embeddingConfig.js`.

### How to Add Questions & Re-Embed

1. Open `src/data/questionBank.json`.
2. Add your new question entries following this schema:
   ```json
   {
     "id": "react-04",
     "topic": "React",
     "difficulty": "medium",
     "question": "How does React memo differ from useMemo, and when does each make sense?",
     "rubric": [
       "Explains React.memo wraps whole components to skip re-rendering when props are unchanged",
       "Explains useMemo caches the result of an expensive calculation inside a component",
       "Notes shallow comparison behavior of props and how callback functions require useCallback",
       "Warns against premature memoization overhead when calculations are cheap"
     ]
   }
   ```
3. Run the embedding script:
   ```bash
   npm run embed:questions
   # or: node scripts/embedQuestionBank.mjs
   ```
   The script reads `.env.local`, calls the Gemini Embeddings API, L2-normalizes the vectors, and writes `src/data/questionBankEmbedded.json`.

### Rubric Lookup in Scoring
During candidate feedback evaluation (`generateAIFeedback`), the system checks the question being scored against the bank:
- A rubric is **only attached** on an exact question-text match or when cosine similarity is $\ge 0.90$.
- If similarity is $< 0.90$, no rubric is attached, and the answer is evaluated normally without a rubric.
- When attached, the feedback prompt explicitly instructs the LLM to cross-reference the candidate's transcript against the key criteria and name any specific missed points.
