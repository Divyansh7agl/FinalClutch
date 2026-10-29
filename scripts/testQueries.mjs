import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const env = fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8');
const key = env.match(/VITE_GEMINI_API_KEY=(.+)/)[1].trim();
const bank = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', 'questionBankEmbedded.json'), 'utf8'));

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

async function query(text) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 768
    })
  });
  const data = await res.json();
  const v = data.embedding.values;
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  const queryVec = v.map(x => x / norm);
  const scored = bank.map(q => ({ id: q.id, topic: q.topic, q: q.question, sim: dot(queryVec, q.embedding) }))
                     .sort((a, b) => b.sim - a.sim);
  console.log(`Query: "${text}"`);
  console.log(`  Top 1: [${scored[0].topic} - ${scored[0].id}] (Sim: ${scored[0].sim.toFixed(3)}) ${scored[0].q}`);
  console.log(`  Top 2: [${scored[1].topic} - ${scored[1].id}] (Sim: ${scored[1].sim.toFixed(3)}) ${scored[1].q}\n`);
}

async function run() {
  await query('React state update not re-rendering component');
  await query('Two users booking the same concert seat at once');
  await query('Express server frozen by large JSON parsing');
  await query('Disagreement with teammate on technology choice during hackathon');
  await query('Finding maximum average latency in a sliding window');
}

run();
