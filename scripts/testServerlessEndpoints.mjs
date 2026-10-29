import fs from 'node:fs';
import path from 'node:path';

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

// Import handlers
const retrieveModule = await import('../api/retrieve.ts');
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
    json(data) {
      this.bodyData = data;
      return this;
    },
    send(data) {
      this.bodyData = data;
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

async function run() {
  console.log('=== TEST 1: CALLING /api/retrieve (DSA question search) ===');
  const { req: reqRet, res: resRet } = createMockReqRes({
    action: 'questions',
    query: 'How to find the longest substring without repeating characters using sliding window?',
    filters: { topic: 'DSA' },
    k: 2
  });
  await retrieveModule.default(reqRet, resRet);
  console.log('Status:', resRet.statusCode);
  console.log('Response body:\n', JSON.stringify(resRet.bodyData, null, 2));

  console.log('\n=== TEST 2: CALLING /api/interview (Follow-up generation) ===');
  const { req: reqInt, res: resInt } = createMockReqRes({
    action: 'followup',
    payload: {
      previousQuestion: 'How does indexing in PostgreSQL work internally and when would a B-tree index degrade?',
      previousAnswer: 'PostgreSQL uses B-trees by default which keep values sorted. It can degrade if columns have very high churn or high duplication, or if we use functions on indexed columns in where clauses without a functional index.',
      difficulty: 'hard'
    }
  });
  await interviewModule.default(reqInt, resInt);
  console.log('Status:', resInt.statusCode);
  console.log('Response body:\n', JSON.stringify(resInt.bodyData, null, 2));

  console.log('\n=== TEST 3: CALLING /api/retrieve (Rubric lookup by questionId) ===');
  const { req: reqRub, res: resRub } = createMockReqRes({
    action: 'rubric',
    questionId: 'dsa-12'
  });
  await retrieveModule.default(reqRub, resRub);
  console.log('Status:', resRub.statusCode);
  console.log('Response body:\n', JSON.stringify(resRub.bodyData, null, 2));

  console.log('\n=== TEST 4: CALLING /api/interview (Action: feedback) ===');
  const { req: reqFeed, res: resFeed } = createMockReqRes({
    action: 'feedback',
    payload: {
      transcript: 'I used a sliding window technique with two pointers to track duplicate characters in the substring.',
      delay: 2.1,
      fillerCount: 1,
      confidenceScore: 85,
      responses: [
        {
          questionText: 'How do you find the length of the longest substring that contains no duplicate characters?',
          rubric: [
            'Applies a dynamic sliding window with left and right pointers.',
            'Uses a hash map or integer array to store the most recent index of each visited character.',
            'When a duplicate character is encountered, shifts the left pointer past the previous occurrence.',
            'Updates the maximum length at each step, running in O(N) time and O(min(N, charset)) space.'
          ],
          transcript: 'I used a sliding window technique with two pointers and a hash map.',
          delay: 2.1,
          fillerCount: 1
        }
      ]
    }
  });
  await interviewModule.default(reqFeed, resFeed);
  console.log('Status:', resFeed.statusCode);
  console.log('Response body:\n', JSON.stringify(resFeed.bodyData, null, 2));
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
