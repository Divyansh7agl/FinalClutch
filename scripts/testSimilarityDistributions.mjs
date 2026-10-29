import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const env = fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8');
const key = (env.match(/GEMINI_API_KEY=(.+)/) || env.match(/VITE_GEMINI_API_KEY=(.+)/))[1].trim();
const bank = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', 'questionBankEmbedded.json'), 'utf8'));

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function l2Norm(v) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n === 0 ? v : v.map(x => x / n);
}

async function testQuery(text, category) {
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
  const queryVec = l2Norm(data.embedding.values);

  const scored = bank.map(q => ({
    id: q.id,
    topic: q.topic,
    question: q.question,
    sim: dot(queryVec, q.embedding)
  })).sort((a, b) => b.sim - a.sim);

  return {
    category,
    query: text,
    top1: scored[0],
    top2: scored[1],
    top3: scored[2]
  };
}

async function run() {
  const tests = [
    // 1. Spoken-style candidate answers
    { cat: 'Spoken Answer', q: 'I updated the state array by calling push but the component did not re-render' },
    { cat: 'Spoken Answer', q: 'Two users tried to reserve the same seat simultaneously and both succeeded' },
    { cat: 'Spoken Answer', q: 'Our node server stopped accepting requests when someone uploaded a huge json payload' },
    { cat: 'Spoken Answer', q: 'I used floyd algorithm with two pointers to check if the list has a loop' },

    // 2. Broad topic queries
    { cat: 'Broad Topic', q: 'Node concurrency' },
    { cat: 'Broad Topic', q: 'React reconciliation' },
    { cat: 'Broad Topic', q: 'Database indexing strategies' },
    { cat: 'Broad Topic', q: 'Operating system deadlocks' },
    { cat: 'Broad Topic', q: 'TCP vs UDP' },

    // 3. Off-topic queries (6 queries)
    { cat: 'Off-Topic', q: 'How do I bake sourdough bread with a crispy crust?' },
    { cat: 'Off-Topic', q: 'What are the rules for offside in European football?' },
    { cat: 'Off-Topic', q: 'How to change the motor oil and filter in a Honda Civic?' },
    { cat: 'Off-Topic', q: 'The distance from Earth to Mars during opposition' },
    { cat: 'Off-Topic', q: 'Best pruning practices for backyard tomato plants' },
    { cat: 'Off-Topic', q: 'Recipe for authentic Italian pasta carbonara' }
  ];

  console.log('--- RUNNING REALISTIC SIMILARITY TESTS ---');
  const results = [];
  for (const t of tests) {
    const r = await testQuery(t.q, t.cat);
    results.push(r);
    console.log(`[${r.category}] "${r.query}"`);
    console.log(`   Top 1 (Sim: ${r.top1.sim.toFixed(3)}): [${r.top1.topic} - ${r.top1.id}] ${r.top1.question}`);
    console.log(`   Top 2 (Sim: ${r.top2.sim.toFixed(3)}): [${r.top2.topic} - ${r.top2.id}]`);
    console.log('');
  }

  const spokenSims = results.filter(r => r.category === 'Spoken Answer').map(r => r.top1.sim);
  const broadSims = results.filter(r => r.category === 'Broad Topic').map(r => r.top1.sim);
  const offTopicSims = results.filter(r => r.category === 'Off-Topic').map(r => r.top1.sim);

  console.log('--- SIMILARITY DISTRIBUTION SUMMARY ---');
  console.log('Spoken Answers Top-1 Sim:', 'Min =', Math.min(...spokenSims).toFixed(3), 'Max =', Math.max(...spokenSims).toFixed(3), 'Avg =', (spokenSims.reduce((a,b)=>a+b,0)/spokenSims.length).toFixed(3));
  console.log('Broad Topics Top-1 Sim:  ', 'Min =', Math.min(...broadSims).toFixed(3), 'Max =', Math.max(...broadSims).toFixed(3), 'Avg =', (broadSims.reduce((a,b)=>a+b,0)/broadSims.length).toFixed(3));
  console.log('Off-Topic Top-1 Sim:     ', 'Min =', Math.min(...offTopicSims).toFixed(3), 'Max =', Math.max(...offTopicSims).toFixed(3), 'Avg =', (offTopicSims.reduce((a,b)=>a+b,0)/offTopicSims.length).toFixed(3));
}

run();
