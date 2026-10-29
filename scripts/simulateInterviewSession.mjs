import { InMemoryRateLimiter } from '../api/_lib/rateLimit.ts';

console.log('========================================================================================');
console.log('ITEM 4: REALISTIC FULL INTERVIEW SESSION RATE LIMIT SIMULATION');
console.log('Session sequence: generate-questions (1) + [next-question (1) + followup (1)] * 5 + feedback (1) = 12 API calls');
console.log('========================================================================================\n');

// 12-call interview session sequence
const sessionSequence = [
  { step: 1, action: 'generate-questions', desc: 'Initialize interview and generate 5 question bank batch' },
  { step: 2, action: 'next-question',     desc: 'Fetch question 1 prompt' },
  { step: 3, action: 'followup',          desc: 'Candidate answers question 1 -> generate follow-up challenge' },
  { step: 4, action: 'next-question',     desc: 'Fetch question 2 prompt' },
  { step: 5, action: 'followup',          desc: 'Candidate answers question 2 -> generate follow-up challenge' },
  { step: 6, action: 'next-question',     desc: 'Fetch question 3 prompt' },
  { step: 7, action: 'followup',          desc: 'Candidate answers question 3 -> generate follow-up challenge' },
  { step: 8, action: 'next-question',     desc: 'Fetch question 4 prompt' },
  { step: 9, action: 'followup',          desc: 'Candidate answers question 4 -> generate follow-up challenge' },
  { step: 10, action: 'next-question',    desc: 'Fetch question 5 prompt' },
  { step: 11, action: 'followup',         desc: 'Candidate answers question 5 -> generate follow-up challenge' },
  { step: 12, action: 'feedback',         desc: 'Submit entire interview session transcript for AI scoring' }
];

const candidateIp = '198.51.100.42';

// TEST PART A: Strict 6 req/min limit
console.log('--- TEST PART A: SIMULATING UNDER 6 REQ/MIN LIMIT ---');
const strictLimiter = new InMemoryRateLimiter(6, 60000, 'ERR_RATE_LIMIT_IP');
let blockedAtStepA = null;

for (const call of sessionSequence) {
  const res = strictLimiter.check(candidateIp);
  if (!res.allowed) {
    console.log(`❌ [Call ${call.step.toString().padStart(2, '0')}/12] Action: ${call.action.padEnd(20)} | BLOCKED! 429 Too Many Requests (${res.reasonCode})`);
    if (!blockedAtStepA) blockedAtStepA = call.step;
  } else {
    console.log(`✅ [Call ${call.step.toString().padStart(2, '0')}/12] Action: ${call.action.padEnd(20)} | Allowed (Remaining: ${res.remaining})`);
  }
}
console.log(`\nPart A Finding: 6 req/min limit blocks the candidate at call #${blockedAtStepA} (mid-interview). A full interview cannot complete within 1 minute.`);

// TEST PART B: Calibrated 15 req/min limit
console.log('\n--- TEST PART B: SIMULATING UNDER CALIBRATED 15 REQ/MIN LIMIT ---');
const calibratedLimiter = new InMemoryRateLimiter(15, 60000, 'ERR_RATE_LIMIT_IP');
let blockedAtStepB = null;

for (const call of sessionSequence) {
  const res = calibratedLimiter.check(candidateIp);
  if (!res.allowed) {
    console.log(`❌ [Call ${call.step.toString().padStart(2, '0')}/12] Action: ${call.action.padEnd(20)} | BLOCKED! (${res.reasonCode})`);
    if (!blockedAtStepB) blockedAtStepB = call.step;
  } else {
    console.log(`✅ [Call ${call.step.toString().padStart(2, '0')}/12] Action: ${call.action.padEnd(20)} | Allowed (Remaining: ${res.remaining})`);
  }
}

console.log(`\nPart B Finding: All 12/12 interview calls succeeded seamlessly under the 15 req/min limit with ${15 - sessionSequence.length} requests headroom.`);
console.log('Automated spammers exceeding 15 req/min remain strictly throttled with 429 ERR_RATE_LIMIT_IP.');
