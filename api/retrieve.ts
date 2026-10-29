import type { IncomingMessage, ServerResponse } from 'node:http';
import { validateOrigin, getCorsHeaders, getClientIp, parseAndValidateBody } from './_lib/security.ts';
import { retrieveIpLimiter } from './_lib/rateLimit.ts';
import { getRelevantQuestions, lookupRubric } from './_lib/retrieval.ts';

interface VercelRequest extends IncomingMessage {
  body?: any;
}

interface VercelResponse extends ServerResponse {
  status(statusCode: number): VercelResponse;
  json(body: any): void;
}

const MAX_RETRIEVE_BODY_BYTES = 16384; // 16 KB

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

  // 3. Rate limiting (30 req/min per IP)
  const clientIp = getClientIp(req.headers, req.socket?.remoteAddress);
  const rateLimit = retrieveIpLimiter.check(clientIp);
  res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rateLimit.resetMs / 1000)));
    return sendJson(429, {
      error: 'Retrieval rate limit exceeded (max 30 requests per minute).',
      reasonCode: 'ERR_RATE_LIMIT_RETRIEVE',
      retryAfterSec: Math.ceil(rateLimit.resetMs / 1000)
    });
  }

  // 4. Request Body Size Enforcement (16 KB)
  const rawBody = await resolveRequestBody(req);
  const parseResult = parseAndValidateBody(rawBody, req.headers, MAX_RETRIEVE_BODY_BYTES);
  if (!parseResult.ok) {
    return sendJson(parseResult.status || 400, {
      error: parseResult.error,
      reasonCode: parseResult.reasonCode
    });
  }

  const body = parseResult.body;
  const { action } = body;

  try {
    // Action: "questions"
    if (action === 'questions') {
      const rawQuery = body.query;
      if (typeof rawQuery !== 'string' || !rawQuery.trim()) {
        return sendJson(200, { questions: [], lowConfidence: true });
      }
      if (rawQuery.length > 400) {
        return sendJson(400, {
          error: 'Query parameter exceeds maximum length of 400 characters.',
          reasonCode: 'ERR_FIELD_TOO_LONG'
        });
      }

      const query = rawQuery.trim();

      let filters = undefined;
      if (body.filters && typeof body.filters === 'object') {
        const topic = typeof body.filters.topic === 'string' ? body.filters.topic.slice(0, 50) : undefined;
        const difficulty = typeof body.filters.difficulty === 'string' ? body.filters.difficulty.slice(0, 20) : undefined;
        filters = { topic, difficulty };
      }

      const k = typeof body.k === 'number' ? Math.min(Math.max(1, body.k), 10) : 4;
      const result = await getRelevantQuestions(query, filters, k);
      return sendJson(200, result);
    }

    // Action: "rubric"
    if (action === 'rubric') {
      const questionId = typeof body.questionId === 'string' ? body.questionId.trim() : undefined;
      const questionText = typeof body.questionText === 'string' ? body.questionText.trim() : undefined;

      if (questionId && questionId.length > 50) {
        return sendJson(400, {
          error: 'questionId parameter exceeds maximum length of 50 characters.',
          reasonCode: 'ERR_FIELD_TOO_LONG'
        });
      }
      if (questionText && questionText.length > 400) {
        return sendJson(400, {
          error: 'questionText parameter exceeds maximum length of 400 characters.',
          reasonCode: 'ERR_FIELD_TOO_LONG'
        });
      }

      const result = await lookupRubric(questionId, questionText);
      return sendJson(200, result);
    }

    return sendJson(400, { error: `Unsupported action: ${action}`, reasonCode: 'ERR_UNSUPPORTED_ACTION' });
  } catch (error: any) {
    console.error(`[Server Error] /api/retrieve failure: ${error.message}. ReasonCode: ERR_RETRIEVE_INTERNAL`);
    return sendJson(500, { error: 'Internal Server Error', reasonCode: 'ERR_RETRIEVE_INTERNAL' });
  }
}
