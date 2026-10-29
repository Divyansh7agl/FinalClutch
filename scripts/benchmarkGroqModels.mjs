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

const groqApiKey = process.env.GROQ_API_KEY;

async function fetchGroqModels() {
  console.log('=== 1. FETCHING GROQ ACTIVE MODELS LIST ===');
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    console.error('Failed to fetch models from Groq:', res.status, await res.text());
    return [];
  }

  const data = await res.json();
  const models = data.data.map(m => ({ id: m.id, owned_by: m.owned_by, active: m.active }));
  console.log(`Found ${models.length} available models on Groq:`);
  for (const m of models) {
    console.log(`  - ${m.id} (owned by ${m.owned_by})`);
  }
  return models.map(m => m.id);
}

const interviewModule = await import('../api/interview.ts');

function createMockReqRes(body, origin = 'http://localhost:5173') {
  const req = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': origin
    },
    body,
    socket: { remoteAddress: '127.0.0.1' }
  };

  const res = {
    statusCode: 200,
    headers: {},
    bodyData: null,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end(data) {
      if (data) {
        try {
          this.bodyData = JSON.parse(data);
        } catch {
          this.bodyData = data;
        }
      }
      return this;
    }
  };

  return { req, res };
}

const benchmarkPayload = {
  action: 'feedback',
  payload: {
    transcript: 'In my design, I partitioned the orders table by creation month to prevent B-tree degradation. For distributed transactions, I used a saga orchestrator pattern with idempotent compensation handlers instead of two-phase commit. When handling concurrent inventory reservation, I applied Redis distributed locks with a 500ms lease and Lua scripts to ensure atomic decrements. For our microservices, we introduced RabbitMQ as an asynchronous message broker to decouple checkout from fulfillment and billing. In frontend state management, we migrated heavy prop drilling to React Query and Context with memoized selector hooks.',
    delay: 2.4,
    fillerCount: 3,
    confidenceScore: 84,
    responses: [
      {
        questionText: 'An orders table query with two million rows suddenly starts taking eight seconds during peak hours. How do you inspect what the database engine is doing, and what would you look for?',
        rubric: [
          'Runs EXPLAIN ANALYZE on the slow query to compare estimated costs against actual execution times.',
          'Checks for sequential scans (Seq Scan) across millions of rows where an index scan was expected.',
          'Inspects disk buffer hit ratios and identifies high I/O read operations.',
          'Proposes adding a composite index, covering index, or partitioned table.'
        ],
        transcript: 'I used EXPLAIN ANALYZE to check sequential scans versus index scans and added monthly partitioning.',
        delay: 2.1,
        fillerCount: 1
      },
      {
        questionText: 'What is database replication using a primary-replica (master-slave) setup, and how does it improve read throughput?',
        rubric: [
          'Directs write operations to a single primary node and distributes read queries across multiple replicas.',
          'Identifies replication lag as the primary cause of stale reads on replica instances.',
          'Mentions write bottlenecks remain limited to the capacity of the single primary database instance.'
        ],
        transcript: 'Primary handles all writes while replicas scale read throughput with async replication.',
        delay: 1.8,
        fillerCount: 0
      },
      {
        questionText: 'Why would you introduce a message queue like RabbitMQ or Kafka between an order processing service and an email notification service?',
        rubric: [
          'Decouples the core ordering latency from third-party notification delivery.',
          'Buffers traffic bursts so high-volume spikes do not overwhelm the notification provider.',
          'Provides message retries and dead-letter queues if the downstream service temporarily fails.'
        ],
        transcript: 'RabbitMQ decouples the services and absorbs burst traffic with retry queues.',
        delay: 2.2,
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
        transcript: 'Consistent hashing uses a circular ring so adding a node only relocates K/N keys rather than re-hashing all keys.',
        delay: 3.1,
        fillerCount: 1
      },
      {
        questionText: 'What is a stale closure in a React useEffect hook, and how does the dependency array prevent it?',
        rubric: [
          'Occurs when an effect closure captures variables from an earlier render without re-subscribing.',
          'Explains that omitting dependencies leaves the callback executing with outdated state or props.',
          'Resolves stale values by listing all referenced reactive values in the dependency array.'
        ],
        transcript: 'A stale closure captures outdated state from an older render cycle because dependencies were omitted.',
        delay: 2.5,
        fillerCount: 0
      }
    ]
  }
};

async function runBenchmark() {
  const models = await fetchGroqModels();

  console.log('\n=== 2. RUNNING 10-ITERATION 5-QUESTION FEEDBACK BENCHMARK ===');
  const latencies = [];
  const modelStats = {};

  for (let i = 1; i <= 10; i++) {
    const { req, res } = createMockReqRes(benchmarkPayload);
    const start = performance.now();
    await interviewModule.default(req, res);
    const end = performance.now();
    const duration = Math.round(end - start);

    const modelUsed = res.bodyData?.modelUsed || 'unknown';
    const usedFallback = Boolean(res.bodyData?.usedFallback);
    modelStats[modelUsed] = (modelStats[modelUsed] || 0) + 1;

    if (res.statusCode === 200) {
      latencies.push(duration);
    }

    const preview = res.bodyData?.feedback ? res.bodyData.feedback.slice(0, 75).replace(/\n/g, ' ') : res.bodyData?.error || 'NO FEEDBACK';
    console.log(`Run ${i.toString().padStart(2, '0')}: ${duration}ms | Status: ${res.statusCode} | Model: ${modelUsed} | FallbackUsed: ${usedFallback} | Preview: "${preview}..."`);

    // 1.5s breathing room between calls to stay within on-demand token quota
    if (i < 10) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  latencies.sort((a, b) => a - b);
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const median = (latencies[4] + latencies[5]) / 2;
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

  console.log('\n=== BENCHMARK LATENCY REPORT ===');
  console.log('Successful runs:', latencies.length);
  console.log('Model breakdown:', JSON.stringify(modelStats));
  console.log('All latencies (sorted ms):', latencies.join(', '));
  console.log(`Min Latency:    ${min} ms`);
  console.log(`Median Latency: ${median} ms`);
  console.log(`Max Latency:    ${max} ms`);
  console.log(`Average:        ${avg} ms`);
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
