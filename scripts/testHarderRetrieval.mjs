import fs from 'node:fs';

// Load .env.local
const envLocal = fs.readFileSync('.env.local', 'utf8');
for (const line of envLocal.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    process.env[key] = val;
  }
}

const { getRelevantQuestions, RETRIEVAL_CONFIDENCE_THRESHOLD } = await import('../api/_lib/retrieval.ts');

const techAdjacentQueries = [
  'Python decorators and functools wraps',
  'Kubernetes pods lifecycle and replica sets',
  'Java garbage collection algorithms G1 and ZGC',
  'Object oriented programming principles polymorphism and encapsulation',
  'Docker networking overlay network and bridge mode',
  'SQL window functions row_number and partition by',
  'GraphQL vs REST API architecture tradeoffs',
  'Git rebase vs merge interactive squash workflow',
  'C++ smart pointers unique_ptr and shared_ptr reference counting',
  'Redis Pub/Sub message broker vs Apache Kafka consumer groups'
];

const vagueSpokenQueries = [
  'um, I would use a hash thing',
  'idk maybe just loop over it',
  'not sure, probably restart the server'
];

const inBankControlQueries = [
  'How does indexing in PostgreSQL work internally?',
  'Explain the difference between TCP and UDP with header overhead',
  'Explain React useEffect dependency array stale closures'
];

async function run() {
  console.log('========================================================================');
  console.log('HARDER RETRIEVAL TEST SUITE (Current Threshold:', RETRIEVAL_CONFIDENCE_THRESHOLD, ')');
  console.log('========================================================================\n');

  async function testGroup(title, queries) {
    console.log(`--- ${title} ---`);
    const results = [];
    for (const q of queries) {
      const res = await getRelevantQuestions(q, undefined, 3);
      const top1 = res.questions[0];
      const top2 = res.questions[1];
      const score1 = top1 ? top1.similarity : 0;
      const score2 = top2 ? top2.similarity : 0;
      const gap = top1 && top2 ? (score1 - score2) : 0;
      const isAboveThreshold = score1 >= RETRIEVAL_CONFIDENCE_THRESHOLD;

      results.push({
        query: q,
        score1,
        score2,
        gap,
        isAboveThreshold,
        top1Id: top1 ? top1.id : 'none',
        top1Topic: top1 ? top1.topic : 'none',
        lowConfidence: res.lowConfidence
      });

      console.log(`Query: "${q}"`);
      console.log(`  Top-1: [${top1?.id}] (${top1?.topic}) score=${score1.toFixed(4)} | gap_to_top2=${gap.toFixed(4)} | lowConfidence=${res.lowConfidence}`);
      if (top1) console.log(`  Match Q: "${top1.question}"`);
      console.log('');
    }
    return results;
  }

  const adjacentResults = await testGroup('1. 10 Tech-Adjacent Out-of-Bank Queries', techAdjacentQueries);
  const vagueResults = await testGroup('2. 3 Very Short / Vague Spoken Queries', vagueSpokenQueries);
  const inBankResults = await testGroup('3. 3 In-Bank Control Queries', inBankControlQueries);

  console.log('\n========================================================================');
  console.log('SUMMARY TABLE & ANALYSIS');
  console.log('========================================================================');

  console.log('\nTech-Adjacent Max Score:', Math.max(...adjacentResults.map(r => r.score1)).toFixed(4));
  console.log('Tech-Adjacent Mean Score:', (adjacentResults.reduce((a, b) => a + b.score1, 0) / adjacentResults.length).toFixed(4));
  console.log('Vague Max Score:', Math.max(...vagueResults.map(r => r.score1)).toFixed(4));
  console.log('In-Bank Min Score:', Math.min(...inBankResults.map(r => r.score1)).toFixed(4));

  const falsePositives = adjacentResults.filter(r => r.score1 >= RETRIEVAL_CONFIDENCE_THRESHOLD);
  console.log(`\nFalse positives (Tech-adjacent >= ${RETRIEVAL_CONFIDENCE_THRESHOLD}):`, falsePositives.length);
  for (const fp of falsePositives) {
    console.log(`  - "${fp.query}" -> score: ${fp.score1.toFixed(4)}, matched: ${fp.top1Id} (${fp.top1Topic}), gap: ${fp.gap.toFixed(4)}`);
  }
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
