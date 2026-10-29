import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  GEMINI_EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  EMBEDDING_TASK_DOCUMENT
} from '../src/constants/embeddingConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to extract API key from environment or .env files
function getApiKey() {
  if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY.trim();
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();

  const envFiles = ['.env.local', '.env'];
  for (const envFile of envFiles) {
    const fullPath = path.join(rootDir, envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const viteMatch = content.match(/VITE_GEMINI_API_KEY\s*=\s*(.+)/);
      if (viteMatch && viteMatch[1]) return viteMatch[1].trim().replace(/^['"]|['"]$/g, '');
      const geminiMatch = content.match(/GEMINI_API_KEY\s*=\s*(.+)/);
      if (geminiMatch && geminiMatch[1]) return geminiMatch[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return null;
}

// Compute deterministic SHA-256 hash of topic + question
function computeQuestionHash(topic, question) {
  return crypto.createHash('sha256').update(`${topic}::${question.trim()}`).digest('hex');
}

// L2-normalize vector to unit length
function l2Normalize(vector) {
  const sumSq = vector.reduce((sum, val) => sum + val * val, 0);
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vector;
  return vector.map(val => val / norm);
}

// Cosine similarity for unit vectors = dot product
function cosineSimilarity(a, b) {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function embedTextWithGemini(text, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const payload = {
    model: GEMINI_EMBEDDING_MODEL,
    content: {
      parts: [{ text }]
    },
    taskType: EMBEDDING_TASK_DOCUMENT,
    outputDimensionality: EMBEDDING_DIMENSION
  };

  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429 && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.warn(`\nRate limit hit (429), waiting ${(waitTime / 1000).toFixed(1)}s before retry ${attempt}/${maxRetries}...`);
          await sleep(waitTime);
          continue;
        }
        throw new Error(`Gemini API error (${response.status}): ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      if (!data.embedding || !data.embedding.values) {
        throw new Error(`Invalid response structure from Gemini API: ${JSON.stringify(data)}`);
      }

      return l2Normalize(data.embedding.values);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const waitTime = Math.pow(2, attempt) * 1000;
      console.warn(`\nAttempt ${attempt} failed: ${err.message}. Retrying in ${(waitTime / 1000).toFixed(1)}s...`);
      await sleep(waitTime);
    }
  }
}

async function main() {
  console.log('--- Question Bank Incremental Embedder ---');
  console.log(`Model: ${GEMINI_EMBEDDING_MODEL}`);
  console.log(`Target Dimension: ${EMBEDDING_DIMENSION}`);
  console.log(`Task Type: ${EMBEDDING_TASK_DOCUMENT}`);

  const apiKey = getApiKey();
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.error('ERROR: No valid GEMINI_API_KEY found in .env.local, .env, or environment variables.');
    process.exit(1);
  }

  const inputPath = path.join(rootDir, 'src', 'data', 'questionBank.json');
  const outputPath = path.join(rootDir, 'src', 'data', 'questionBankEmbedded.json');

  if (!fs.existsSync(inputPath)) {
    console.error(`ERROR: Question bank not found at: ${inputPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(inputPath, 'utf8');
  const questions = JSON.parse(rawData);

  // Load existing embeddings cache if available
  const existingCache = new Map();
  if (fs.existsSync(outputPath)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      if (Array.isArray(existingData)) {
        for (const item of existingData) {
          const hash = item.hash || computeQuestionHash(item.topic, item.question);
          if (Array.isArray(item.embedding) && item.embedding.length === EMBEDDING_DIMENSION) {
            existingCache.set(hash, item.embedding);
          }
        }
        console.log(`Loaded ${existingCache.size} existing embeddings from cache.`);
      }
    } catch (e) {
      console.warn('Could not parse existing embeddings file, re-embedding from scratch.');
    }
  }

  console.log(`Total questions to process: ${questions.length}`);
  const embeddedQuestions = [];
  let cachedCount = 0;
  let newEmbedCount = 0;

  for (let i = 0; i < questions.length; i++) {
    const item = questions[i];
    const hash = computeQuestionHash(item.topic, item.question);
    const textToEmbed = `${item.topic}: ${item.question}`;

    if (existingCache.has(hash)) {
      embeddedQuestions.push({
        ...item,
        hash,
        embedding: existingCache.get(hash)
      });
      cachedCount++;
      process.stdout.write(`[${i + 1}/${questions.length}] [CACHED] [${item.topic}] "${item.question.slice(0, 40)}..."\n`);
      continue;
    }

    process.stdout.write(`[${i + 1}/${questions.length}] [EMBEDDING] [${item.topic}] "${item.question.slice(0, 40)}..." `);

    try {
      const vector = await embedTextWithGemini(textToEmbed, apiKey);
      embeddedQuestions.push({
        ...item,
        hash,
        embedding: vector
      });
      newEmbedCount++;
      process.stdout.write(`✓ (dim: ${vector.length})\n`);
    } catch (err) {
      console.error(`\nFAILED to embed "${item.id}":`, err.message);
      process.exit(1);
    }

    // Delay between live requests to respect API rate limits
    if (i < questions.length - 1) {
      await sleep(350);
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(embeddedQuestions, null, 2), 'utf8');
  console.log(`\nSuccessfully saved ${embeddedQuestions.length} embedded questions to:`);
  console.log(`-> ${outputPath}`);
  console.log(`Stats: ${cachedCount} reused from cache, ${newEmbedCount} newly embedded.`);

  // Duplicate Check: Pairwise cosine similarity >= 0.90
  console.log('\n--- Running Duplicate / High-Similarity Check (>= 0.90) ---');
  let duplicatePairsCount = 0;
  for (let i = 0; i < embeddedQuestions.length; i++) {
    for (let j = i + 1; j < embeddedQuestions.length; j++) {
      const sim = cosineSimilarity(embeddedQuestions[i].embedding, embeddedQuestions[j].embedding);
      if (sim >= 0.90) {
        duplicatePairsCount++;
        console.warn(`[SIMILARITY ${sim.toFixed(3)}]`);
        console.warn(`  1. (${embeddedQuestions[i].id}) [${embeddedQuestions[i].topic}] ${embeddedQuestions[i].question}`);
        console.warn(`  2. (${embeddedQuestions[j].id}) [${embeddedQuestions[j].topic}] ${embeddedQuestions[j].question}\n`);
      }
    }
  }

  if (duplicatePairsCount === 0) {
    console.log('✓ Duplicate check PASSED: No question pairs with cosine similarity >= 0.90 found.');
  } else {
    console.warn(`⚠ Notice: Found ${duplicatePairsCount} pair(s) with similarity >= 0.90 for review.`);
  }
}

main().catch(err => {
  console.error('Fatal error during embedding execution:', err);
  process.exit(1);
});
