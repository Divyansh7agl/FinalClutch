import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const env = fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8');
const groqKey = (env.match(/GROQ_API_KEY=(.+)/) || env.match(/VITE_GROQ_API_KEY=(.+)/))[1].trim();

const realisticResponses = [
  {
    questionText: "How would you check for duplicate tags in real time as a user types them into an input field?",
    rubric: [
      "Uses a Hash Set to store previously added tags for O(1) average lookup and insertion time.",
      "Explains that memory scales linearly with the number of unique tags (O(N) space complexity).",
      "Caps the number of tags and/or normalizes case and whitespace before checking duplicates."
    ],
    transcript: "So when the user enters a tag, I would take the string and put it into an array. Then I would use array.includes() to check if it already exists before adding it. If it is there, I show a warning message. In terms of memory, storing strings takes some space, but for a few tags it should be fine.",
    delay: 2400,
    fillerCount: 2
  },
  {
    questionText: "Two users click 'Book Seat' at the exact same millisecond for the last available concert ticket. How does your database ensure only one of them gets confirmed?",
    rubric: [
      "Uses a database transaction with row-level locking (such as SELECT ... FOR UPDATE) to hold exclusive access on the seat record.",
      "Acceptable alternative: uses optimistic concurrency control checking a version number or status flag during the UPDATE statement.",
      "Explains that the winning transaction commits while the conflicting transaction aborts, rolls back, or raises an error."
    ],
    transcript: "We can wrap the booking in a database transaction. When the first user tries to book, we do a select with for update lock on that row so other queries wait. Then we check if the status is still available. If it is, we update it to booked and commit. The second user's query gets unlocked, sees it is already booked, and rolls back.",
    delay: 1800,
    fillerCount: 0
  },
  {
    questionText: "A teammate updates a list of items by pushing directly into the state array and calls setItems(items), but the UI refuses to update. Why did that happen, and how do you fix it?",
    rubric: [
      "Explains that React compares state updates using shallow reference equality (Object.is).",
      "Explains that mutating an existing array in place leaves the array reference identical, so React skips re-rendering.",
      "Fixes the issue by creating a new array reference (e.g., using spread setItems([...items, newItem]))."
    ],
    transcript: "React compares the old state and new state references using Object.is. Because array.push modifies the array in place without creating a new reference, React thinks nothing changed and bails out of re-rendering. To fix it, you should spread the existing items into a new array like setItems([...items, newItem]).",
    delay: 1500,
    fillerCount: 1
  },
  {
    questionText: "Your Express API handles thousands of lightweight requests easily, but whenever one route parses a 50MB JSON file, all other users' requests freeze. What is happening under the hood, and how do you fix it?",
    rubric: [
      "Explains that Node.js executes JavaScript on a single thread, and synchronous CPU operations like JSON.parse block the event loop.",
      "Explains that while the main thread is blocked, incoming I/O events waiting in the event loop queue cannot execute.",
      "Proposes streaming parsers or offloading the heavy CPU task to a Worker Thread or separate background process."
    ],
    transcript: "Node.js runs on a single thread, so calling synchronous JSON.parse on 50 megabytes blocks the event loop thread completely until parsing is done. During that time, no other network sockets can be processed. To fix it, we can stream the JSON or offload the heavy parsing to a worker thread.",
    delay: 2100,
    fillerCount: 0
  },
  {
    questionText: "During a hackathon or class project, a teammate wanted to use a brand-new framework they had never used before, but you had a tight 24-hour deadline. How did you handle that disagreement?",
    rubric: [
      "Structure: Clearly sets the context and conflicting priorities (desire to learn vs. project delivery risk).",
      "Action: Focuses the conversation on objective constraints (documentation, team familiarity, deadline).",
      "Outcome: Explains the agreed compromise (e.g. timeboxed 1-hour prototype, or using proven tools for core features)."
    ],
    transcript: "I understood they were excited to try the new technology, but with only 24 hours we could not afford to get stuck on unexpected configuration bugs. I suggested we timebox experimenting with the new framework for 45 minutes to build a quick proof of concept. When we hit setup issues, we agreed to build the core backend in Express and try the new tool on a non-critical feature.",
    delay: 2200,
    fillerCount: 1
  }
];

const formattedResponses = realisticResponses.map((r, i) => `
QUESTION ${i + 1}: ${r.questionText}
KEY EXPECTED RUBRIC CRITERIA:
${r.rubric.map(p => `  * ${p}`).join('\n')}
TRANSCRIPT: "${r.transcript}"
DELAY: ${(r.delay / 1000).toFixed(1)}s
FILLERS: ${r.fillerCount}
`).join('\n---\n');

const systemPrompt = `You are an elite interview pressure coach. Analyze the candidate's performance under stress.
Return your assessment in two parts:
1. A qualitative coaching summary (plain text).
2. A quantitative JSON score block.

CRITICAL FOCUS:
- EVALUATE RUBRICS: For questions with "KEY EXPECTED RUBRIC CRITERIA", compare the candidate's transcript against those points. In SUMMARY and IMPROVEMENTS, explicitly mention which key points were covered and specifically name any criteria they missed.
- CLARITY & COMPOSURE: Ideal delay is 2-4s. Silent gaps > 6s = penalty.

RESPONSE FORMAT:
SUMMARY: (3-4 concise sentences referencing specific TRANSCRIPT details, naming criteria covered and missed)
IMPROVEMENTS: (3 actionable bullet points, citing exact missed criteria from the rubric when applicable)
MOTIVATION: (1 short punchy line)

SCORES: {"clarity": X, "composure": X, "structure": X, "confidence": X}`;

const userPrompt = `Context:
FULL SESSION DATA:
${formattedResponses}

AGGREGATED METRICS:
Total Transcript: "${realisticResponses.map(r => r.transcript).join(' ')}"
Average Delay: 2.0 seconds
Total Filler Count: 4
Raw Simulation Heuristic Score: 85%

Analyze the candidate's responses for relevance, criteria coverage, and delivery now.`;

async function testLatency() {
  console.log('Sending realistic 5-question feedback payload to Groq...');
  console.log(`Prompt size: ${(systemPrompt.length + userPrompt.length)} characters`);

  const startTime = Date.now();
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 500
    })
  });

  const elapsedMs = Date.now() - startTime;
  const data = await res.json();

  console.log(`HTTP Status: ${res.status}`);
  console.log(`Total Latency: ${elapsedMs}ms (${(elapsedMs / 1000).toFixed(2)}s)`);
  if (data.choices && data.choices[0]) {
    console.log('\n--- Model Output ---');
    console.log(data.choices[0].message.content);
  } else {
    console.log('Error:', data);
  }
}

testLatency();
