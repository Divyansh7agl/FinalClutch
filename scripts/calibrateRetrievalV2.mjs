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

const questionBank = JSON.parse(fs.readFileSync('src/data/questionBank.json', 'utf8'));
const questionMap = new Map(questionBank.map(q => [q.id, q]));

// 22 Realistic Spoken Candidate Answers across topics (some mixing topics)
const realisticSpokenQueries = [
  {
    domain: 'DSA',
    expectedId: 'dsa-05',
    query: "Um, so basically for checking if there's a loop in a linked list, I would use two pointers, like a slow one and a fast one moving at double speed. If they bump into each other, then yeah, there is definitely a cycle."
  },
  {
    domain: 'DSA',
    expectedId: 'dsa-18',
    query: "To find the first unique character, uh, I'd probably loop through the string once and count everything in a hash map. Then loop through a second time and pick the first one that has a count of one."
  },
  {
    domain: 'DBMS',
    expectedId: 'dbms-02',
    query: "So when our queries are getting super slow, we should run explain analyze on Postgres, you know, to see if it's doing a full table scan instead of using the index. Then maybe add a composite index or something."
  },
  {
    domain: 'DBMS',
    expectedId: 'dbms-06',
    query: "Basically a clustered index actually decides how the rows are physically stored on the hard drive, so you only get one per table. Non-clustered just has pointers back to the rows."
  },
  {
    domain: 'DBMS',
    expectedId: 'dbms-10',
    query: "Uh, with optimistic locking we just put a version column on the record and check it during update. But pessimistic locking does select for update and locks the row so nobody else can touch it."
  },
  {
    domain: 'OS',
    expectedId: 'os-01',
    query: "A process has its own isolated memory space that the OS protects, while threads share the exact same heap and global variables. So if a thread crashes, it can take down the whole process, you know."
  },
  {
    domain: 'OS',
    expectedId: 'os-04',
    query: "Deadlocks happen when you have circular waiting, like thread A holds lock 1 waiting for lock 2, and thread B does the reverse. To prevent it, we always acquire locks in a strict global order."
  },
  {
    domain: 'OS',
    expectedId: 'os-06',
    query: "A mutex is binary, so only one thread can hold it at a time and that same thread has to release it. But a semaphore is like a counter for a pool of resources, like database connections."
  },
  {
    domain: 'Networking',
    expectedId: 'net-03',
    query: "Well, TCP has the three-way handshake and handles packet retransmission, which adds a bunch of lag. For voice and multiplayer games, you don't care if a packet drops, so you just send UDP instead."
  },
  {
    domain: 'Networking',
    expectedId: 'net-02',
    query: "When you type a URL, your browser first checks local cache, then asks the OS resolver, then it hits the recursive DNS, root server, TLD server, and authoritative server to get the IP."
  },
  {
    domain: 'React',
    expectedId: 'react-04',
    query: "Uh, a stale closure happens when your useEffect or callback captures an old state value from an earlier render because you forgot to put it in the dependency array. So it keeps running with old data."
  },
  {
    domain: 'React',
    expectedId: 'react-06',
    query: "Basically useMemo is for caching the calculated result of an expensive function, whereas useCallback caches the actual function reference itself so child components don't re-render."
  },
  {
    domain: 'React',
    expectedId: 'react-08',
    query: "Controlled components are where the input value is bound to React state with an onChange handler. Uncontrolled components just let the DOM handle the value and you grab it with a ref."
  },
  {
    domain: 'Node',
    expectedId: 'node-06',
    query: "The event loop has different queues, like timers, I/O polling, and check phase for setImmediate. But process nextTick runs before the next phase as a microtask, so it can starve I/O if you loop it."
  },
  {
    domain: 'Node',
    expectedId: 'node-03',
    query: "If you read a huge 2GB file with readFileSync, it loads the whole thing into RAM and blocks the thread. Instead you should pipe a readable stream into a writable stream with backpressure."
  },
  {
    domain: 'System Design',
    expectedId: 'sys-13',
    query: "Consistent hashing puts both the servers and the cache keys on a virtual ring. When a server goes down, only the keys belonging to that server move to the next neighbor instead of rehashing everything."
  },
  {
    domain: 'System Design',
    expectedId: 'sys-10',
    query: "You put a queue like RabbitMQ or Kafka between checkout and notifications because sending emails is slow and might fail. The queue buffers the spike and lets workers retry asynchronously."
  },
  {
    domain: 'JavaScript',
    expectedId: 'js-02',
    query: "A closure is when an inner function remembers variables from its outer lexical scope even after that parent function finished executing. It's great for making private variables."
  },
  {
    domain: 'JavaScript',
    expectedId: 'js-06',
    query: "Event bubbling means the click event starts at the target button and bubbles up all the parent divs to the document. You call event stopPropagation if you want to stop that."
  },
  {
    domain: 'HR',
    expectedId: 'hr-01',
    query: "Um, so on my last project, my teammate wanted to rewrite our whole backend in Go, but we had a tight two-month deadline. I laid out the delivery risks, we compromised on keeping Node for now, and shipped on time."
  },
  {
    domain: 'Mixed: React+DBMS',
    expectedId: 'dbms-02',
    query: "Well, in my React dashboard the table was taking 5 seconds to load, so I thought it was state re-rendering, but when we checked Postgres it was doing a slow full table scan with no index."
  },
  {
    domain: 'Mixed: Node+Networking',
    expectedId: 'node-03',
    query: "Our Express microservice kept crashing with out of memory errors under high load because we were buffering incoming file uploads in RAM instead of piping them as streams."
  }
];

// Out-of-Bank Queries (including Kadane's algorithm, Python decorators, K8s, Docker, etc.)
const outOfBankQueries = [
  { label: 'Out: Kadane Max Subarray', query: 'finding the maximum subarray sum in O(N) using kadane algorithm' },
  { label: 'Out: TLS 1.3 0-RTT Resumption', query: 'how does the TLS 1.3 handshake achieve zero round trip time session resumption with pre shared keys' },
  { label: 'Out: Python decorators', query: 'Python decorators and functools wraps' },
  { label: 'Out: Kubernetes pods', query: 'Kubernetes pods lifecycle and replica sets' },
  { label: 'Out: Java GC', query: 'Java garbage collection algorithms G1 and ZGC' },
  { label: 'Out: OOP principles', query: 'Object oriented programming principles polymorphism and encapsulation' },
  { label: 'Out: Docker networking', query: 'Docker networking overlay network and bridge mode' },
  { label: 'Out: SQL window functions', query: 'SQL window functions row_number and partition by' },
  { label: 'Out: GraphQL vs REST', query: 'GraphQL vs REST API architecture tradeoffs' },
  { label: 'Out: Git rebase', query: 'Git rebase vs merge interactive squash workflow' },
  { label: 'Out: C++ smart pointers', query: 'C++ smart pointers unique_ptr and shared_ptr reference counting' },
  { label: 'In-Bank Match: Redis vs Kafka', query: 'Redis Pub/Sub message broker vs Apache Kafka consumer groups', expectedId: 'sys-10' },
  { label: 'Out: Vague hash', query: 'um, I would use a hash thing' },
  { label: 'Out: Vague loop', query: 'idk maybe just loop over it' },
  { label: 'Out: Vague restart', query: 'not sure, probably restart the server' }
];

async function run() {
  console.log('========================================================================================');
  console.log('ITEM 1: RIGOROUS RETRIEVAL CALIBRATION WITH MATCH VERIFICATION');
  console.log(`Current Rule: High Threshold >= ${RETRIEVAL_HIGH_CONFIDENCE_THRESHOLD} OR (Min Threshold >= ${RETRIEVAL_MIN_CONFIDENCE_THRESHOLD} AND Gap >= ${RETRIEVAL_MIN_TOP_GAP})`);
  console.log('========================================================================================\n');

  console.log('--- PART 1: 22 REALISTIC SPOKEN IN-BANK QUERIES ---');
  let inBankCount = 0;
  let falseRejects = 0;
  let wrongMatchAccepted = 0;
  let correctMatches = 0;

  for (let i = 0; i < realisticSpokenQueries.length; i++) {
    const item = realisticSpokenQueries[i];
    inBankCount++;
    const res = await getRelevantQuestions(item.query, undefined, 2);
    const top1 = res.questions[0];
    const top2 = res.questions[1];
    const score1 = top1 ? top1.similarity : 0;
    const score2 = top2 ? top2.similarity : 0;
    const gap = score1 - score2;

    const matchedQ = questionMap.get(top1?.id);
    const isAccepted = !res.lowConfidence;

    // Judge correctness: does matched question really cover the query concept?
    const isCorrectMatch = top1?.id === item.expectedId;

    let classification = '';
    if (!isAccepted) {
      falseRejects++;
      classification = '❌ FALSE REJECT (Low Confidence)';
    } else if (!isCorrectMatch) {
      wrongMatchAccepted++;
      classification = `⚠️ WRONG-MATCH ACCEPTED (Expected ${item.expectedId}, got ${top1?.id})`;
    } else {
      correctMatches++;
      classification = '✅ CORRECT MATCH ACCEPTED';
    }

    console.log(`[${(i + 1).toString().padStart(2, '0')}/22] [${item.domain}]`);
    console.log(`  Query:        "${item.query}"`);
    console.log(`  Top-1 Matched: [${top1?.id}] "${matchedQ?.question || 'N/A'}"`);
    console.log(`  Score: ${score1.toFixed(4)} | Gap: ${gap.toFixed(4)} | Accepted: ${isAccepted} | Correct: ${isCorrectMatch ? 'Y' : 'N'}`);
    console.log(`  Result:       ${classification}\n`);
  }

  console.log('--- PART 2: 15 OUT-OF-BANK & ADJACENT QUERIES ---');
  let outOfBankCount = 0;
  let falseAccepts = 0;
  let outCorrectRejects = 0;

  for (let i = 0; i < outOfBankQueries.length; i++) {
    const item = outOfBankQueries[i];
    const res = await getRelevantQuestions(item.query, undefined, 2);
    const top1 = res.questions[0];
    const top2 = res.questions[1];
    const score1 = top1 ? top1.similarity : 0;
    const score2 = top2 ? top2.similarity : 0;
    const gap = score1 - score2;

    const matchedQ = questionMap.get(top1?.id);
    const isAccepted = !res.lowConfidence;

    const isLegitMatch = item.expectedId && top1?.id === item.expectedId;
    if (!isLegitMatch) outOfBankCount++;

    let classification = '';
    if (isLegitMatch) {
      classification = isAccepted ? '✅ LEGITIMATE IN-BANK MATCH (sys-10 message queue)' : '❌ FALSE REJECT';
    } else {
      if (isAccepted) {
        falseAccepts++;
        classification = `❌ FALSE ACCEPT (Out-of-bank query accepted into [${top1?.id}])`;
      } else {
        outCorrectRejects++;
        classification = '✅ CORRECTLY REJECTED (Low Confidence)';
      }
    }

    console.log(`[${(i + 1).toString().padStart(2, '0')}/15] [${item.label}]`);
    console.log(`  Query:        "${item.query}"`);
    console.log(`  Top-1 Matched: [${top1?.id}] "${matchedQ?.question || 'N/A'}"`);
    console.log(`  Score: ${score1.toFixed(4)} | Gap: ${gap.toFixed(4)} | Accepted: ${isAccepted}`);
    console.log(`  Result:       ${classification}\n`);
  }

  console.log('========================================================================================');
  console.log('CALIBRATION METRICS BREAKDOWN');
  console.log('========================================================================================');
  console.log(`In-Bank Queries Evaluated:       ${inBankCount}`);
  console.log(`  - Correct Match Accepted:      ${correctMatches} (${((correctMatches / inBankCount) * 100).toFixed(1)}%)`);
  console.log(`  - False Rejects:               ${falseRejects} (${((falseRejects / inBankCount) * 100).toFixed(1)}%)`);
  console.log(`  - Wrong-Match Accepted:        ${wrongMatchAccepted} (${((wrongMatchAccepted / inBankCount) * 100).toFixed(1)}%)`);
  console.log(`Out-of-Bank Queries Evaluated:   ${outOfBankCount}`);
  console.log(`  - Correctly Rejected:          ${outCorrectRejects} (${((outCorrectRejects / outOfBankCount) * 100).toFixed(1)}%)`);
  console.log(`  - False Accepts:               ${falseAccepts} (${((falseAccepts / outOfBankCount) * 100).toFixed(1)}%)`);
}

run().catch(err => {
  console.error('Calibration run failed:', err);
  process.exit(1);
});
