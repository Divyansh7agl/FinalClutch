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

const {
  getRelevantQuestions,
  RETRIEVAL_HIGH_CONFIDENCE_THRESHOLD,
  RETRIEVAL_MIN_CONFIDENCE_THRESHOLD,
  RETRIEVAL_MIN_TOP_GAP
} = await import('../api/_lib/retrieval.ts');

// 36 In-Bank Queries across all 9 domains (paraphrased & spoken candidate responses)
const inBankTestSet = [
  // DSA (4)
  { topic: 'DSA', query: 'How would you detect a cycle in a linked list using slow and fast pointers?' },
  { topic: 'DSA', query: 'finding the maximum subarray sum in O(N) using kadane algorithm' },
  { topic: 'DSA', query: 'invert a binary tree by recursively swapping left and right children' },
  { topic: 'DSA', query: 'two sum problem with hash map looking up the target complement in O(1)' },

  // DBMS (4)
  { topic: 'DBMS', query: 'What is the practical difference between clustered and non-clustered index in database tables?' },
  { topic: 'DBMS', query: 'How does database normalization up to 3NF prevent update anomalies and duplicate rows?' },
  { topic: 'DBMS', query: 'ACID properties in relational databases and how atomicity rollback works' },
  { topic: 'DBMS', query: 'optimistic concurrency control vs pessimistic locking with select for update' },

  // OS (4)
  { topic: 'OS', query: 'What is the difference between a process and a thread in terms of memory address space?' },
  { topic: 'OS', query: 'How does virtual memory paging and page faults work in modern operating systems?' },
  { topic: 'OS', query: 'mutex lock vs counting semaphore when synchronizing shared resources across threads' },
  { topic: 'OS', query: 'What causes a deadlock and how do the four coffman conditions prevent it?' },

  // Networking (4)
  { topic: 'Networking', query: 'Why would an application choose UDP instead of TCP for live video calls or online gaming?' },
  { topic: 'Networking', query: 'Explain the three-way handshake in TCP with SYN, SYN-ACK, and ACK flags' },
  { topic: 'Networking', query: 'What happens step-by-step when resolving a domain name through recursive DNS servers?' },
  { topic: 'Networking', query: 'How does an SSL TLS handshake exchange asymmetric keys to establish symmetric encryption?' },

  // React (4)
  { topic: 'React', query: 'What is a stale closure in React useEffect and how does dependency array fix it?' },
  { topic: 'React', query: 'difference between useMemo and useCallback hooks for performance optimization' },
  { topic: 'React', query: 'controlled vs uncontrolled form inputs in React with ref and state' },
  { topic: 'React', query: 'How does React Virtual DOM diffing algorithm compare keys during reconciliation?' },

  // Node (4)
  { topic: 'Node', query: 'How does the Node js event loop phases work with microtasks process nextTick and timers?' },
  { topic: 'Node', query: 'handling streaming file uploads in Express with backpressure to prevent high memory usage' },
  { topic: 'Node', query: 'How do you structure global error handling middleware in an Express application?' },
  { topic: 'Node', query: 'difference between synchronous fs readFileSync and asynchronous streams in Node' },

  // System Design (4)
  { topic: 'System Design', query: 'How does consistent hashing on a circular ring minimize cache key remapping when adding nodes?' },
  { topic: 'System Design', query: 'Why introduce a message queue like RabbitMQ or Kafka between order processing and notification service?' },
  { topic: 'System Design', query: 'How do you design a rate limiter using token bucket algorithm with Redis?' },
  { topic: 'System Design', query: 'horizontal scaling vs vertical scaling and caching strategies using Redis CDN' },

  // JavaScript (4)
  { topic: 'JavaScript', query: 'What is a closure in JavaScript and what is a practical use case for data privacy?' },
  { topic: 'JavaScript', query: 'difference between call, apply, and bind functions when setting this context' },
  { topic: 'JavaScript', query: 'How does prototype inheritance and the prototype chain work in JavaScript?' },
  { topic: 'JavaScript', query: 'event bubbling vs event capturing in DOM event propagation with stopPropagation' },

  // HR (4)
  { topic: 'HR', query: 'Tell me about a time you had a technical disagreement with a teammate and how you resolved it' },
  { topic: 'HR', query: 'Describe a situation where a production bug occurred and how you handled the postmortem' },
  { topic: 'HR', query: 'Tell me about a project where you had to learn a completely new technology on a tight deadline' },
  { topic: 'HR', query: 'making a trade-off between writing perfect clean code versus shipping a feature quickly' }
];

// 13 Out-of-Bank Queries (10 tech-adjacent + 3 vague)
const outOfBankTestSet = [
  { label: 'Out: Python decorators', query: 'Python decorators and functools wraps' },
  { label: 'Out: Kubernetes pods', query: 'Kubernetes pods lifecycle and replica sets' },
  { label: 'Out: Java GC', query: 'Java garbage collection algorithms G1 and ZGC' },
  { label: 'Out: OOP principles', query: 'Object oriented programming principles polymorphism and encapsulation' },
  { label: 'Out: Docker networking', query: 'Docker networking overlay network and bridge mode' },
  { label: 'Out: SQL window functions', query: 'SQL window functions row_number and partition by' },
  { label: 'Out: GraphQL vs REST', query: 'GraphQL vs REST API architecture tradeoffs' },
  { label: 'Out: Git rebase', query: 'Git rebase vs merge interactive squash workflow' },
  { label: 'Out: C++ smart pointers', query: 'C++ smart pointers unique_ptr and shared_ptr reference counting' },
  { label: 'In-Bank Match: Redis vs Kafka', query: 'Redis Pub/Sub message broker vs Apache Kafka consumer groups' }, // Note: matches sys-10 in bank
  { label: 'Out: Vague hash', query: 'um, I would use a hash thing' },
  { label: 'Out: Vague loop', query: 'idk maybe just loop over it' },
  { label: 'Out: Vague restart', query: 'not sure, probably restart the server' }
];

async function runCalibration() {
  console.log('========================================================================');
  console.log('ITEM 6: RETRIEVAL CALIBRATION TEST SUITE (36 In-Bank + 13 Out-of-Bank)');
  console.log(`Current Rule: High Threshold >= ${RETRIEVAL_HIGH_CONFIDENCE_THRESHOLD} OR (Min Threshold >= ${RETRIEVAL_MIN_CONFIDENCE_THRESHOLD} AND Gap >= ${RETRIEVAL_MIN_TOP_GAP})`);
  console.log('========================================================================\n');

  console.log('--- 1. EVALUATING 36 IN-BANK QUERIES ACROSS 9 TOPICS ---');
  let falseRejects = 0;
  const inBankScores = [];

  for (let i = 0; i < inBankTestSet.length; i++) {
    const item = inBankTestSet[i];
    const res = await getRelevantQuestions(item.query, undefined, 2);
    const top1 = res.questions[0];
    const top2 = res.questions[1];
    const score1 = top1 ? top1.similarity : 0;
    const score2 = top2 ? top2.similarity : 0;
    const gap = score1 - score2;
    inBankScores.push(score1);

    const isRejected = res.lowConfidence;
    if (isRejected) falseRejects++;

    const statusMark = isRejected ? '❌ FALSE REJECT' : '✅ ACCEPTED';
    console.log(`[${(i + 1).toString().padStart(2, '0')}/36] [${item.topic}] "${item.query.slice(0, 50)}..."`);
    console.log(`     -> Top-1: [${top1?.id}] score=${score1.toFixed(4)}, gap=${gap.toFixed(4)} | ${statusMark}`);
  }

  console.log('\n--- 2. EVALUATING 13 OUT-OF-BANK / ADJACENT QUERIES ---');
  let falseAccepts = 0;
  const outBankScores = [];

  for (let i = 0; i < outOfBankTestSet.length; i++) {
    const item = outOfBankTestSet[i];
    const res = await getRelevantQuestions(item.query, undefined, 2);
    const top1 = res.questions[0];
    const top2 = res.questions[1];
    const score1 = top1 ? top1.similarity : 0;
    const score2 = top2 ? top2.similarity : 0;
    const gap = score1 - score2;
    outBankScores.push(score1);

    // Note: 'Redis vs Kafka' legitimately matches sys-10 in bank, so we treat true out-of-bank as the other 12
    const isTrulyOutOfBank = !item.label.includes('In-Bank Match');
    const isAccepted = !res.lowConfidence;
    if (isTrulyOutOfBank && isAccepted) falseAccepts++;

    const statusMark = isAccepted
      ? (isTrulyOutOfBank ? '❌ FALSE ACCEPT' : '✅ LEGITIMATE IN-BANK MATCH (sys-10)')
      : '✅ CORRECTLY REJECTED';

    console.log(`[${(i + 1).toString().padStart(2, '0')}/13] [${item.label}] "${item.query}"`);
    console.log(`     -> Top-1: [${top1?.id}] score=${score1.toFixed(4)}, gap=${gap.toFixed(4)} | ${statusMark}`);
  }

  console.log('\n========================================================================');
  console.log('CALIBRATION METRICS & ERROR RATE ANALYSIS');
  console.log('========================================================================');
  const falseRejectRate = ((falseRejects / inBankTestSet.length) * 100).toFixed(1);
  const falseAcceptRate = ((falseAccepts / 12) * 100).toFixed(1);

  console.log(`Total In-Bank Queries:     ${inBankTestSet.length}`);
  console.log(`False Rejects:             ${falseRejects} (${falseRejectRate}%)`);
  console.log(`Total True Out-of-Bank:    12 (excluding sys-10 match)`);
  console.log(`False Accepts:             ${falseAccepts} (${falseAcceptRate}%)`);
  console.log(`\nIn-Bank Score Range:       ${Math.min(...inBankScores).toFixed(4)} to ${Math.max(...inBankScores).toFixed(4)} (Mean: ${(inBankScores.reduce((a,b)=>a+b,0)/inBankScores.length).toFixed(4)})`);
  console.log(`Out-of-Bank Score Range:   ${Math.min(...outBankScores).toFixed(4)} to ${Math.max(...outBankScores).toFixed(4)} (Mean: ${(outBankScores.reduce((a,b)=>a+b,0)/outBankScores.length).toFixed(4)})`);
}

runCalibration().catch(err => {
  console.error('Calibration failed:', err);
  process.exit(1);
});
