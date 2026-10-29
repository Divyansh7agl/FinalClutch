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

const { generateFeedbackServer, GROQ_MODELS } = await import('../api/_lib/llm.ts');

const sampleResponses = [
  {
    questionText: 'How do you find the length of the longest substring that contains no duplicate characters?',
    rubric: [
      'Applies a dynamic sliding window with left and right pointers.',
      'Uses a hash map or integer array to store the most recent index of each visited character.',
      'When a duplicate character is encountered, shifts the left pointer past the previous occurrence.',
      'Updates the maximum length at each step, running in O(N) time and O(min(N, charset)) space.'
    ],
    transcript: 'I used a sliding window technique with two pointers and a hash map.',
    delay: 2100,
    fillerCount: 1
  },
  {
    questionText: 'What is database replication using a primary-replica (master-slave) setup, and how does it improve read throughput?',
    rubric: [
      'Directs write operations to a single primary node and distributes read queries across multiple replicas.',
      'Identifies replication lag as the primary cause of stale reads on replica instances.',
      'Mentions write bottlenecks remain limited to the capacity of the single primary database instance.'
    ],
    transcript: 'Writes go to the primary node and reads are distributed to replicas.',
    delay: 1800,
    fillerCount: 0
  },
  {
    questionText: 'Why would you introduce a message queue like RabbitMQ or Kafka between an order processing service and an email notification service?',
    rubric: [
      'Decouples the core ordering latency from third-party notification delivery.',
      'Buffers traffic bursts so high-volume spikes do not overwhelm the notification provider.',
      'Provides message retries and dead-letter queues if the downstream service temporarily fails.'
    ],
    transcript: 'It decouples the order latency from email delivery and buffers bursts.',
    delay: 2200,
    fillerCount: 1
  },
  {
    questionText: 'How does consistent hashing minimize key redistribution when scaling a cluster of caching nodes up or down?',
    rubric: [
      'Maps both cache nodes and keys onto a circular hash ring modulo 2^32.',
      'Assigns each key to the first server node encountered moving clockwise.',
      'When adding or removing a node, only K/N keys need relocation instead of all keys.',
      'Uses virtual nodes to ensure uniform key distribution across the ring.'
    ],
    transcript: 'Consistent hashing places nodes on a ring so only K/N keys move on node change.',
    delay: 3100,
    fillerCount: 1
  },
  {
    questionText: 'What is a stale closure in a React useEffect hook, and how does the dependency array prevent it?',
    rubric: [
      'Occurs when an effect closure captures variables from an earlier render without re-subscribing.',
      'Explains that omitting dependencies leaves the callback executing with outdated state or props.',
      'Resolves stale values by listing all referenced reactive values in the dependency array.'
    ],
    transcript: 'A stale closure captures outdated variables because dependencies were not declared in the array.',
    delay: 2500,
    fillerCount: 0
  }
];

async function run() {
  console.log('========================================================================');
  console.log('ITEM 4: FALLBACK MODEL VALIDATION & SCORE CLAMPING REPORT');
  console.log('========================================================================\n');

  // Step 1: Raw Groq /models output
  console.log('--- 1. RAW GROQ /models API RESPONSE ---');
  const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
  });
  const rawModelsData = await modelsRes.json();
  console.log(JSON.stringify(rawModelsData, null, 2));

  // Step 2: Test 5 runs on each model in the chain
  const modelsToTest = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

  for (const model of modelsToTest) {
    console.log(`\n========================================================================`);
    console.log(`TESTING MODEL: ${model} (5 consecutive runs)`);
    console.log(`========================================================================`);

    const modelScores = { clarity: [], composure: [], structure: [], confidence: [] };

    for (let run = 1; run <= 5; run++) {
      const start = performance.now();
      const result = await generateFeedbackServer(
        'I used sliding window with two pointers, database replication for reads, Kafka for asynchronous decoupling, consistent hashing on a ring, and proper useEffect dependencies.',
        2340,
        3,
        80,
        sampleResponses,
        model
      );
      const duration = Math.round(performance.now() - start);

      const hasContent = Boolean(result && result.feedback && result.feedback.length > 50);
      const hasSummary = Boolean(result?.feedback?.includes('SUMMARY'));
      const hasImprovements = Boolean(result?.feedback?.includes('IMPROVEMENTS'));
      const hasMotivation = Boolean(result?.feedback?.includes('MOTIVATION'));
      const hasScores = Boolean(result?.scores && typeof result.scores.clarity === 'number');

      if (result?.scores) {
        modelScores.clarity.push(result.scores.clarity);
        modelScores.composure.push(result.scores.composure);
        modelScores.structure.push(result.scores.structure);
        modelScores.confidence.push(result.scores.confidence);
      }

      console.log(`\nRun ${run} (${duration}ms):`);
      console.log(`  Content Non-Empty: ${hasContent} (Length: ${result?.feedback?.length || 0} chars)`);
      console.log(`  Structure Check:   Summary=${hasSummary}, Improvements=${hasImprovements}, Motivation=${hasMotivation}, Scores=${hasScores}`);
      console.log(`  Parsed Scores:    `, JSON.stringify(result?.scores));
      console.log(`  Output Snippet:    "${result?.feedback?.slice(0, 160).replace(/\n/g, ' ')}..."`);

      // 4s pause to remain comfortably under on-demand token limits
      if (run < 5) await new Promise(r => setTimeout(r, 4000));
    }

    const calcRange = (arr) => arr.length ? `${Math.min(...arr)} - ${Math.max(...arr)}` : 'N/A';
    console.log(`\nModel [${model}] Summary:`);
    console.log(`  Clarity Range:    ${calcRange(modelScores.clarity)}`);
    console.log(`  Composure Range:  ${calcRange(modelScores.composure)}`);
    console.log(`  Structure Range:  ${calcRange(modelScores.structure)}`);
    console.log(`  Confidence Range: ${calcRange(modelScores.confidence)}`);

    // 5s pause before testing next model
    await new Promise(r => setTimeout(r, 5000));
  }
}

run().catch(err => {
  console.error('Model validation failed:', err);
  process.exit(1);
});
