import type { IncomingMessage, ServerResponse } from 'node:http';
import { validateOrigin, getCorsHeaders, getClientIp, parseAndValidateBody } from './_lib/security.js';
import { interviewIpLimiter, interviewInstanceLimiter, interviewGlobalLimiter } from './_lib/rateLimit.js';
import {
  generateQuestionsServer,
  generateNextQuestionServer,
  generateFollowupChallengeServer,
  generateFeedbackServer
} from './_lib/llm.js';

interface VercelRequest extends IncomingMessage {
  body?: any;
}

interface VercelResponse extends ServerResponse {
  status(statusCode: number): VercelResponse;
  json(body: any): void;
}

const MAX_INTERVIEW_BODY_BYTES = 65536; // 64 KB

async function resolveRequestBody(req: VercelRequest): Promise<any> {
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      return req.body;
    }
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      return req.body;
    }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : (req.body || {}));
      } catch {
        resolve(data || req.body || {});
      }
    });
    req.on('error', () => resolve(req.body || {}));
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Origin & CORS check
  const originCheck = validateOrigin(req.headers);
  const corsHeaders = getCorsHeaders(originCheck.matchedOrigin);
  for (const [k, v] of Object.entries(corsHeaders)) {
    res.setHeader(k, v);
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const sendJson = (status: number, data: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  // 2. Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendJson(405, { error: 'Method Not Allowed', reasonCode: 'ERR_METHOD_NOT_ALLOWED' });
  }

  if (!originCheck.allowed) {
    return sendJson(403, { error: 'Forbidden origin', reasonCode: 'ERR_ORIGIN_FORBIDDEN' });
  }

  // 3. Multi-Tier Rate Limiting: Instance Ceiling & Per-IP Limit
  const clientIp = getClientIp(req.headers, req.socket?.remoteAddress);

  // Instance ceiling (30 req/min per lambda instance to protect Groq quotas)
  const instanceLimit = interviewInstanceLimiter.check('INSTANCE');
  if (!instanceLimit.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(instanceLimit.resetMs / 1000)));
    return sendJson(503, {
      error: 'AI interview service temporarily busy. Instance capacity reached. Please try again shortly.',
      reasonCode: 'ERR_RATE_LIMIT_INSTANCE',
      retryAfterSec: Math.ceil(instanceLimit.resetMs / 1000)
    });
  }

  // Per-IP limit (10 req/min; human answering pacing naturally spaces requests)
  const ipLimit = interviewIpLimiter.check(clientIp);
  res.setHeader('X-RateLimit-Remaining', String(ipLimit.remaining));
  if (!ipLimit.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(ipLimit.resetMs / 1000)));
    return sendJson(429, {
      error: 'Per-IP interview rate limit reached (max 10 requests per minute).',
      reasonCode: 'ERR_RATE_LIMIT_IP',
      retryAfterSec: Math.ceil(ipLimit.resetMs / 1000)
    });
  }

  // 4. Request Body Size Enforcement (64 KB)
  const rawBody = await resolveRequestBody(req);
  const parseResult = parseAndValidateBody(rawBody, req.headers, MAX_INTERVIEW_BODY_BYTES);
  if (!parseResult.ok) {
    return sendJson(parseResult.status || 400, {
      error: parseResult.error,
      reasonCode: parseResult.reasonCode
    });
  }

  const body = parseResult.body;

  // Explicitly reject any attempt to pass raw system/user prompts
  if (body.prompt || body.systemPrompt || body.userPrompt || body.messages) {
    console.warn(`[Security] Rejected request containing raw prompt fields from ${clientIp}. ReasonCode: ERR_RAW_PROMPT_DISALLOWED`);
    return sendJson(400, { error: 'Raw prompts are disallowed', reasonCode: 'ERR_RAW_PROMPT_DISALLOWED' });
  }

  const { action, payload } = body;
  if (!action || !payload || typeof payload !== 'object') {
    return sendJson(400, { error: 'Invalid request format. Expected { action, payload }', reasonCode: 'ERR_MALFORMED_PAYLOAD' });
  }

  try {
    // Action 1: generate-questions
    if (action === 'generate-questions') {
      const rawContext = payload.context;
      if (rawContext && typeof rawContext === 'string' && rawContext.length > 3000) {
        return sendJson(400, {
          error: 'Context exceeds maximum length of 3000 characters.',
          reasonCode: 'ERR_FIELD_TOO_LONG'
        });
      }
      const rawExamples = payload.examples;
      if (rawExamples && typeof rawExamples === 'string' && rawExamples.length > 2000) {
        return sendJson(400, {
          error: 'Examples exceed maximum length of 2000 characters.',
          reasonCode: 'ERR_FIELD_TOO_LONG'
        });
      }

      const context = typeof rawContext === 'string' ? rawContext.trim() : '';
      const count = typeof payload.count === 'number' ? Math.min(Math.max(1, payload.count), 10) : 5;
      const difficulty = typeof payload.difficulty === 'string' ? payload.difficulty.slice(0, 20) : 'medium';
      const examples = typeof rawExamples === 'string' ? rawExamples.trim() : '';

      const questions = await generateQuestionsServer(context, count, difficulty, examples);
      if (!questions) {
        return sendJson(502, { error: 'Failed to generate questions', reasonCode: 'ERR_LLM_GENERATION_FAILED' });
      }
      return sendJson(200, { questions });
    }

    // Action 2: next-question
    if (action === 'next-question') {
      const rawContext = payload.context;
      if (rawContext && typeof rawContext === 'string' && rawContext.length > 3000) {
        return sendJson(400, { error: 'Context exceeds maximum length of 3000 characters.', reasonCode: 'ERR_FIELD_TOO_LONG' });
      }
      const rawExamples = payload.examples;
      if (rawExamples && typeof rawExamples === 'string' && rawExamples.length > 2000) {
        return sendJson(400, { error: 'Examples exceed maximum length of 2000 characters.', reasonCode: 'ERR_FIELD_TOO_LONG' });
      }

      const history = Array.isArray(payload.history) ? payload.history.slice(-10).map((h: any) => ({
        question: String(h?.question || '').slice(0, 400),
        answer: String(h?.answer || '').slice(0, 800)
      })) : [];
      const context = typeof rawContext === 'string' ? rawContext.trim() : '';
      const difficulty = typeof payload.difficulty === 'string' ? payload.difficulty.slice(0, 20) : 'medium';
      const examples = typeof rawExamples === 'string' ? rawExamples.trim() : '';

      const question = await generateNextQuestionServer(history, context, difficulty, examples);
      if (!question) {
        return sendJson(502, { error: 'Failed to generate next question', reasonCode: 'ERR_LLM_NEXT_QUESTION_FAILED' });
      }
      return sendJson(200, question);
    }

    // Action 3: followup
    if (action === 'followup') {
      const rawPrevQ = payload.previousQuestion;
      if (rawPrevQ && typeof rawPrevQ === 'string' && rawPrevQ.length > 400) {
        return sendJson(400, { error: 'previousQuestion exceeds maximum length of 400 characters.', reasonCode: 'ERR_FIELD_TOO_LONG' });
      }
      const rawPrevA = payload.previousAnswer;
      if (rawPrevA && typeof rawPrevA === 'string' && rawPrevA.length > 1000) {
        return sendJson(400, { error: 'previousAnswer exceeds maximum length of 1000 characters.', reasonCode: 'ERR_FIELD_TOO_LONG' });
      }

      const previousQuestion = typeof rawPrevQ === 'string' ? rawPrevQ.trim() : '';
      const previousAnswer = typeof rawPrevA === 'string' ? rawPrevA.trim() : '';
      const difficulty = typeof payload.difficulty === 'string' ? payload.difficulty.slice(0, 20) : 'medium';
      const examples = typeof payload.examples === 'string' ? payload.examples.slice(0, 2000) : '';

      const question = await generateFollowupChallengeServer(previousQuestion, previousAnswer, difficulty, examples);
      if (!question) {
        return sendJson(502, { error: 'Failed to generate challenge', reasonCode: 'ERR_LLM_FOLLOWUP_FAILED' });
      }
      return sendJson(200, { question });
    }

    // Action 4: feedback
    if (action === 'feedback') {
      const rawTranscript = payload.transcript;
      if (rawTranscript && typeof rawTranscript === 'string' && rawTranscript.length > 5000) {
        return sendJson(400, { error: 'Transcript exceeds maximum length of 5000 characters.', reasonCode: 'ERR_FIELD_TOO_LONG' });
      }

      const transcript = typeof rawTranscript === 'string' ? rawTranscript.trim() : '';
      const delay = typeof payload.delay === 'number' ? payload.delay : 0;
      const fillerCount = typeof payload.fillerCount === 'number' ? payload.fillerCount : 0;
      const confidenceScore = typeof payload.confidenceScore === 'number' ? payload.confidenceScore : 50;

      const responses = Array.isArray(payload.responses) ? payload.responses.slice(0, 15).map((r: any) => ({
        questionText: String(r?.questionText || '').slice(0, 400),
        rubric: Array.isArray(r?.rubric) ? r.rubric.slice(0, 5).map((item: any) => String(item).slice(0, 300)) : undefined,
        transcript: String(r?.transcript || '').slice(0, 1000),
        delay: typeof r?.delay === 'number' ? r.delay : 0,
        fillerCount: typeof r?.fillerCount === 'number' ? r.fillerCount : 0,
        wordCount: typeof r?.wordCount === 'number' ? r.wordCount : 0
      })) : [];

      const result = await generateFeedbackServer(transcript, delay, fillerCount, confidenceScore, responses);
      if (!result) {
        return sendJson(502, { error: 'Failed to generate feedback', reasonCode: 'ERR_LLM_FEEDBACK_FAILED' });
      }

      if (result.isFallback || !result.scores) {
        console.warn(`[Interview] Falling back to local heuristic assessment. ReasonCode: ${result.reasonCode || 'ERR_MALFORMED_SCORES'}`);
        return sendJson(200, {
          ...result,
          notice: 'Offline feedback mode: AI feedback unavailable'
        });
      }

      return sendJson(200, result);
    }

    return sendJson(400, { error: `Unsupported action: ${action}`, reasonCode: 'ERR_UNSUPPORTED_ACTION' });
  } catch (error: any) {
    console.error(`[Server Error] /api/interview failure: ${error.message}. ReasonCode: ERR_INTERVIEW_INTERNAL`);
    return sendJson(500, { error: 'Internal Server Error', reasonCode: 'ERR_INTERVIEW_INTERNAL' });
  }
}
