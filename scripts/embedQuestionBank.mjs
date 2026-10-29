import fs from 'node:fs';
import path from 'node:path';
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

// L2-normalize vector to unit length
function l2Normalize(vector) {
  const sumSq = vector.reduce((sum, val) => sum + val * val, 0);
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vector;
  return vector.map(val => val / norm);
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

  const maxRetries = 3;
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
          console.warn(`Rate limit hit (429), waiting 2s before retry ${attempt}/${maxRetries}...`);
          await sleep(2000);
          continue;
        }
        throw new Error(`Gemini API error (${response.status}): ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      if (!data.embedding || !data.embedding.values) {
        throw new Error(`Invalid response structure from Gemini API: ${JSON.stringify(data)}`);
      }

      // Return L2-normalized vector
      return l2Normalize(data.embedding.values);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.warn(`Attempt ${attempt} failed: ${err.message}. Retrying in 1s...`);
      await sleep(1000);
    }
  }
}

async function main() {
  console.log('--- Question Bank Offline Embedder ---');
  console.log(`Using Model: ${GEMINI_EMBEDDING_MODEL}`);
  console.log(`Target Dimension: ${EMBEDDING_DIMENSION}`);
  console.log(`Task Type: ${EMBEDDING_TASK_DOCUMENT}`);

  const apiKey = getApiKey();
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.error('ERROR: No valid VITE_GEMINI_API_KEY found in .env.local, .env, or environment variables.');
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

  console.log(`Loaded ${questions.length} questions from ${inputPath}`);
  const embeddedQuestions = [];

  for (let i = 0; i < questions.length; i++) {
    const item = questions[i];
    const textToEmbed = `${item.topic}: ${item.question}`;
    process.stdout.write(`[${i + 1}/${questions.length}] Embedding: [${item.topic}] "${item.question.slice(0, 45)}..." `);

    try {
      const vector = await embedTextWithGemini(textToEmbed, apiKey);
      embeddedQuestions.push({
        ...item,
        embedding: vector
      });
      process.stdout.write(`✓ (dim: ${vector.length})\n`);
    } catch (err) {
      console.error(`\nFAILED to embed "${item.id}":`, err.message);
      process.exit(1);
    }

    // Small delay between requests to remain comfortably within rate limits
    if (i < questions.length - 1) {
      await sleep(250);
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(embeddedQuestions, null, 2), 'utf8');
  console.log(`\nSuccessfully wrote ${embeddedQuestions.length} embedded questions to:`);
  console.log(`-> ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error during embedding execution:', err);
  process.exit(1);
});
