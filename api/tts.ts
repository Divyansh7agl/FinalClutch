import type { IncomingMessage, ServerResponse } from 'node:http';
import { validateOrigin, getCorsHeaders, getClientIp, parseAndValidateBody } from './_lib/security.js';
import { ttsIpLimiter } from './_lib/rateLimit.js';

interface VercelRequest extends IncomingMessage {
  body?: any;
}

interface VercelResponse extends ServerResponse {
  status(statusCode: number): VercelResponse;
  json(body: any): void;
}

const GROQ_TTS_URL = 'https://api.groq.com/openai/v1/audio/speech';
const DEFAULT_VOICE = 'Thunder-PlayAI';
const TTS_MODEL = 'playai-tts';
const MAX_TTS_BODY_BYTES = 8192; // 8 KB
const MAX_TEXT_LENGTH = 500;     // 500 chars

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

  // 2. Only POST allowed
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendJson(405, { error: 'Method Not Allowed', reasonCode: 'ERR_METHOD_NOT_ALLOWED' });
  }

  if (!originCheck.allowed) {
    return sendJson(403, { error: 'Forbidden origin', reasonCode: 'ERR_ORIGIN_FORBIDDEN' });
  }

  // 3. Tighter Rate Limit for TTS (10 req/min per IP)
  const clientIp = getClientIp(req.headers, req.socket?.remoteAddress);
  const rateLimit = ttsIpLimiter.check(clientIp);
  res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rateLimit.resetMs / 1000)));
    return sendJson(429, {
      error: 'TTS rate limit exceeded (max 10 requests per minute).',
      reasonCode: 'ERR_RATE_LIMIT_TTS',
      retryAfterSec: Math.ceil(rateLimit.resetMs / 1000)
    });
  }

  // 4. Request Body Size Enforcement (8 KB)
  const parseResult = parseAndValidateBody(req.body, req.headers, MAX_TTS_BODY_BYTES);
  if (!parseResult.ok) {
    return sendJson(parseResult.status || 400, {
      error: parseResult.error,
      reasonCode: parseResult.reasonCode
    });
  }

  const body = parseResult.body;
  const rawText = typeof body?.text === 'string' ? body.text.trim() : '';
  const voice = typeof body?.voice === 'string' ? body.voice.slice(0, 50) : DEFAULT_VOICE;

  if (!rawText) {
    return sendJson(400, { error: 'Missing text parameter', reasonCode: 'ERR_MISSING_TEXT' });
  }

  // Text length cap enforcement (500 characters max)
  if (rawText.length > MAX_TEXT_LENGTH) {
    return sendJson(400, {
      error: `Text parameter exceeds maximum length of ${MAX_TEXT_LENGTH} characters (received ${rawText.length}).`,
      reasonCode: 'ERR_TEXT_TOO_LONG'
    });
  }

  const apiKey =
    process.env.GROQ_API_KEY ||
    process.env.VITE_GROQ_API_KEY ||
    (typeof globalThis !== 'undefined' && (globalThis as any).Netlify?.env?.get('GROQ_API_KEY')) ||
    '';
  if (!apiKey) {
    return sendJson(500, { error: 'GROQ_API_KEY missing on server', reasonCode: 'ERR_GROQ_KEY_MISSING' });
  }

  try {
    const groqRes = await fetch(GROQ_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: rawText,
        voice,
        response_format: 'mp3'
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => '');
      return sendJson(groqRes.status, {
        error: `Groq TTS error: ${groqRes.status}`,
        details: errText,
        reasonCode: 'ERR_GROQ_TTS_ERROR'
      });
    }

    const audioBuffer = await groqRes.arrayBuffer();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.end(Buffer.from(audioBuffer));
  } catch (error: any) {
    return sendJson(500, {
      error: error.message || 'Failed to synthesize speech',
      reasonCode: 'ERR_TTS_INTERNAL'
    });
  }
}
