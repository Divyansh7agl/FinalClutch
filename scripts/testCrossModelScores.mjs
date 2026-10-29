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

const questionContext = [
  {
    questionText: 'How do you determine if a singly linked list contains a cycle without modifying node values?',
    rubric: [
      'Applies Floyd’s Cycle Detection algorithm using two pointers (slow and fast).',
      'Advances the slow pointer by one step and the fast pointer by two steps.',
      'Identifies a cycle if the slow and fast pointers meet.',
      'Concludes no cycle exists if the fast pointer reaches null, taking O(N) time and O(1) space.'
    ],
    transcript: '',
    delay: 0,
    fillerCount: 0
  }
];

const candidateTranscripts = {
  strong: {
    text: "I would use Floyd's Cycle Detection algorithm with two pointers, slow and fast. The slow pointer moves one step at a time while the fast pointer advances two steps. If the list contains a cycle, the two pointers will eventually meet at the same node. If the fast pointer or its next node hits null, no cycle exists. This runs in O(N) time complexity and requires O(1) auxiliary space.",
    delay: 2100,
    fillers: 0,
    heuristic: 92
  },
  mediocre: {
    text: "Um, you can use two pointers to check for a loop in the linked list. Like, one pointer goes faster than the other pointer. If they cross each other then there is a loop. I think it runs in linear time.",
    delay: 3800,
    fillers: 4,
    heuristic: 68
  },
  poor: {
    text: "Uh, well, you know, maybe I would just loop through it with a for loop and check if I see the same node again or store it in an array or something. Not really sure about the pointers thing.",
    delay: 7200,
    fillers: 11,
    heuristic: 35
  }
};

const models = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

async function run() {
  console.log('========================================================================================');
  console.log('ITEM 2: CROSS-MODEL SCORE CONSISTENCY BENCHMARK (3 Transcripts x 3 Models x 3 Runs)');
  console.log('========================================================================================\n');

  const results = {};

  for (const tier of ['strong', 'mediocre', 'poor']) {
    results[tier] = {};
    const input = candidateTranscripts[tier];
    console.log(`\n----------------------------------------------------------------------------------------`);
    console.log(`EVALUATING ${tier.toUpperCase()} CANDIDATE`);
    console.log(`Transcript: "${input.text}"`);
    console.log(`Delay: ${input.delay}ms | Fillers: ${input.fillers}`);

    for (const model of models) {
      results[tier][model] = [];
      console.log(`\n  Model: ${model}`);

      for (let run = 1; run <= 3; run++) {
        const responses = [{
          ...questionContext[0],
          transcript: input.text,
          delay: input.delay,
          fillerCount: input.fillers
        }];

        const res = await generateFeedbackServer(
          input.text,
          input.delay,
          input.fillers,
          input.heuristic,
          responses,
          model
        );

        const scores = res?.scores || { clarity: 0, composure: 0, structure: 0, confidence: 0 };
        results[tier][model].push(scores);
        console.log(`    Run ${run}: clarity=${scores.clarity}, composure=${scores.composure}, structure=${scores.structure}, confidence=${scores.confidence}`);

        // Pacing pause
        await new Promise(r => setTimeout(r, 2500));
      }
    }
  }

  console.log('\n========================================================================================');
  console.log('SCORE COMPARISON TABLE ACROSS MODELS (Mean Values)');
  console.log('========================================================================================');
  console.log('Candidate | Metric     | Qwen 27B | GPT-OSS 120B | GPT-OSS 20B | Delta (Max-Min)');
  console.log('--------------------------------------------------------------------------------');

  const avg = (arr, key) => Math.round(arr.reduce((s, x) => s + (x[key] || 0), 0) / arr.length);

  for (const tier of ['strong', 'mediocre', 'poor']) {
    for (const metric of ['clarity', 'composure', 'structure', 'confidence']) {
      const qVal = avg(results[tier]['qwen/qwen3.8-27b'], metric);
      const g120Val = avg(results[tier]['openai/gpt-oss-120b'], metric);
      const g20Val = avg(results[tier]['openai/gpt-oss-20b'], metric);
      const delta = Math.max(qVal, g120Val, g20Val) - Math.min(qVal, g120Val, g20Val);

      console.log(`${tier.padEnd(9)} | ${metric.padEnd(10)} | ${qVal.toString().padStart(8)} | ${g120Val.toString().padStart(12)} | ${g20Val.toString().padStart(11)} | ${delta.toString().padStart(15)}`);
    }
    console.log('--------------------------------------------------------------------------------');
  }
}

run().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
