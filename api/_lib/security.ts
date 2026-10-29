/**
 * Security, Origin Validation, CORS, IP Resolution, and Payload Size Enforcement
 *
 * NOTE ON SECURITY:
 * Origin and Referer header checks are a browser defense mechanism against Cross-Site Request
 * Forgery (CSRF) and unauthorized cross-domain embedding. They DO NOT provide cryptographic
 * authentication, as non-browser clients (such as curl, scripts, or proxies) can arbitrarily
 * forge or omit these headers. True authentication requires secret API tokens or session signatures.
 */

import type { IncomingMessage } from 'node:http';

export function getClientIp(
  headers: Record<string, string | string[] | undefined>,
  socketAddress?: string
): string {
  // 1. Vercel Edge sets x-real-ip directly from the client TCP connection (cannot be spoofed by downstream clients)
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  // 2. Fall back to the first hop in x-forwarded-for
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    const firstIp = forwarded[0].split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  // 3. Socket remote address
  return socketAddress || '127.0.0.1';
}

export function validateOrigin(headers: Record<string, string | string[] | undefined>): {
  allowed: boolean;
  matchedOrigin: string;
} {
  const originHeader = (headers['origin'] as string) || '';
  const refererHeader = (headers['referer'] as string) || '';
  const requestOrigin = originHeader || (refererHeader ? new URL(refererHeader).origin : '');

  // If no origin/referer header was provided:
  // Browser fetch requests always send Origin or Referer for POST requests.
  // Direct serverless invocations or non-browser tools without Origin are rejected unless explicitly allowed.
  if (!requestOrigin) {
    // If request comes from a direct curl/script without origin, reject unless in development
    const isDev = process.env.NODE_ENV !== 'production';
    return { allowed: isDev, matchedOrigin: isDev ? '*' : '' };
  }

  // 1. Check against explicit ALLOWED_ORIGIN env var (comma-separated if multiple)
  const envAllowed = process.env.ALLOWED_ORIGIN;
  if (envAllowed) {
    const allowedList = envAllowed.split(',').map(s => s.trim().toLowerCase());
    const lowerReq = requestOrigin.toLowerCase();
    const isMatch = allowedList.some(allowed => lowerReq === allowed || lowerReq.startsWith(allowed));
    if (isMatch) return { allowed: true, matchedOrigin: requestOrigin };
  }

  // 2. Allow local development origins
  const lower = requestOrigin.toLowerCase();
  const isLocal =
    lower.startsWith('http://localhost:') ||
    lower.startsWith('http://127.0.0.1:') ||
    lower.startsWith('https://localhost:') ||
    lower === 'http://localhost' ||
    lower === 'http://127.0.0.1';

  if (isLocal) {
    return { allowed: true, matchedOrigin: requestOrigin };
  }

  // 3. Allow Vercel preview and production deployments for this domain
  if (lower.endsWith('.vercel.app') && (lower.includes('finalclutch') || lower.includes('clutch'))) {
    return { allowed: true, matchedOrigin: requestOrigin };
  }

  // 4. Same-origin check against host header
  const host = (headers['host'] as string) || '';
  if (host) {
    const expectedOriginHttp = `http://${host}`.toLowerCase();
    const expectedOriginHttps = `https://${host}`.toLowerCase();
    if (lower === expectedOriginHttp || lower === expectedOriginHttps) {
      return { allowed: true, matchedOrigin: requestOrigin };
    }
  }

  return { allowed: false, matchedOrigin: '' };
}

export function getCorsHeaders(matchedOrigin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': matchedOrigin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

export interface BodyParseResult {
  ok: boolean;
  body?: any;
  status?: number;
  error?: string;
  reasonCode?: string;
}

export function parseAndValidateBody(
  rawBody: any,
  headers: Record<string, string | string[] | undefined>,
  maxBytes: number
): BodyParseResult {
  // Check Content-Length header first
  const contentLength = headers['content-length'];
  if (contentLength && typeof contentLength === 'string') {
    const parsedLength = parseInt(contentLength, 10);
    if (!isNaN(parsedLength) && parsedLength > maxBytes) {
      return {
        ok: false,
        status: 413,
        error: `Payload too large. Maximum allowed is ${maxBytes} bytes.`,
        reasonCode: 'ERR_PAYLOAD_TOO_LARGE'
      };
    }
  }

  let body: any = rawBody;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > maxBytes) {
      return {
        ok: false,
        status: 413,
        error: `Payload too large. Maximum allowed is ${maxBytes} bytes.`,
        reasonCode: 'ERR_PAYLOAD_TOO_LARGE'
      };
    }
    try {
      body = JSON.parse(body);
    } catch {
      return {
        ok: false,
        status: 400,
        error: 'Invalid JSON payload',
        reasonCode: 'ERR_INVALID_JSON'
      };
    }
  } else if (body && typeof body === 'object') {
    const estimatedSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
    if (estimatedSize > maxBytes) {
      return {
        ok: false,
        status: 413,
        error: `Payload too large. Maximum allowed is ${maxBytes} bytes.`,
        reasonCode: 'ERR_PAYLOAD_TOO_LARGE'
      };
    }
  } else {
    return {
      ok: false,
      status: 400,
      error: 'Missing request body',
      reasonCode: 'ERR_MISSING_BODY'
    };
  }

  return { ok: true, body };
}

/**
 * Strips or neutralizes prompt delimiter tags (<candidate_...>, </candidate_...>)
 * to prevent prompt injection and delimiter breakout attacks.
 * Features:
 * - Normalizes unicode lookalike brackets (fullwidth, angle brackets, guillemets)
 * - Whitespace-tolerant (< / candidate_transcript >)
 * - Case-insensitive (</CANDIDATE_TRANSCRIPT>)
 */
export function sanitizeDelimiters(text: string): string {
  if (!text || typeof text !== 'string') return '';
  // 1. Normalize unicode angle bracket lookalikes
  let sanitized = text
    .replace(/[\uFF1C\u2039\u27E8\u00AB]/g, '<')
    .replace(/[\uFF1E\u203A\u27E9\u00BB]/g, '>');

  // 2. Case-insensitive and whitespace-tolerant tag removal
  sanitized = sanitized
    .replace(/<\s*\/?\s*candidate_(transcript|answer|context|resume)\b[^>]*>/gi, '')
    .replace(/<\s*\/?\s*(system|instruction|user|prompt)\b[^>]*>/gi, '')
    .replace(/<\s*candidate_/gi, '&lt;candidate_')
    .replace(/<\s*\/\s*candidate_/gi, '&lt;/candidate_');

  return sanitized;
}
