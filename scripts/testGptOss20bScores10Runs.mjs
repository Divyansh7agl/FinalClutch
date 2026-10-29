import fs from 'node:fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
for (const line of envLocal.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
}

const { generateFeedbackServer } = await import('../api/_lib/llm.ts');

const sampleResponses = [
  {
    questionText: "How do you determine if a singly linked list contains a cycle without modifying the node values?",
    rubric: [
      "Applies Floyd's cycle detection algorithm using slow and fast pointers.",
      "Explains time complexity is O(N) and space complexity is O(1)."
    ],
    transcript: "I would use two pointers, slow and fast. The slow pointer moves one node at a time while fast moves two. If they meet, there is a cycle.",
    delay: 2400,
    fillerCount: 1
  }
];

async function run() {
  console.log('========================================================================================');
  console.log('ITEM 3: 10 CONSECUTIVE RUNS OF openai/gpt-oss-20b AT max_tokens=1200');
  console.log('Checking for completeness of SCORES block');
  console.log('========================================================================================\n');

  let successCount = 0;
  let missingScoresCount = 0;

  for (let i = 1; i <= 10; i++) {
    console.log(`[Run ${i.toString().padStart(2, '0')}/10] Invoking openai/gpt-oss-20b...`);
    const start = Date.now();
    try {
      const res = await generateFeedbackServer(
        "I would use two pointers, slow and fast. The slow pointer moves one node at a time while fast moves two. If they meet, there is a cycle.",
        2400,
        1,
        85,
        sampleResponses,
        'openai/gpt-oss-20b'
      );
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      const hasScores = !!res?.scores &&
        typeof res.scores.clarity === 'number' &&
        typeof res.scores.structure === 'number' &&
        typeof res.scores.composure === 'number' &&
        typeof res.scores.confidence === 'number';

      if (hasScores) {
        successCount++;
        console.log(`  ✅ Complete SCORES block present (${elapsed}s)`);
        console.log(`     Scores: clarity=${res.scores.clarity}, composure=${res.scores.composure}, structure=${res.scores.structure}, confidence=${res.scores.confidence}`);
      } else {
        missingScoresCount++;
        console.log(`  ❌ MISSING or UNPARSEABLE SCORES block (${elapsed}s)`);
        console.log(`     Raw output preview: ${res?.feedback?.slice(0, 150)}...`);
      }
    } catch (err) {
      missingScoresCount++;
      console.log(`  ❌ Error during invocation: ${err.message}`);
    }

    // Brief 1.5s delay to be mindful of rate limits
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n========================================================================================');
  console.log('10-RUN BENCHMARK SUMMARY (openai/gpt-oss-20b at max_tokens=1200)');
  console.log('========================================================================================');
  console.log(`Total Runs:             10`);
  console.log(`Complete SCORES Block:  ${successCount} (${((successCount / 10) * 100).toFixed(0)}%)`);
  console.log(`Missing/Malformed:      ${missingScoresCount} (${((missingScoresCount / 10) * 100).toFixed(0)}%)`);
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
