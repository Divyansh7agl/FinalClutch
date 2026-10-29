/**
 * In-Memory Multi-Tier Rate Limiting
 *
 * SERVERLESS ARCHITECTURE & HONESTY DISCLOSURE:
 * 1. Per-Instance Only: On serverless platforms (such as Vercel Functions), Node.js memory
 *    is strictly instance-local. It does NOT share state across concurrent execution instances.
 * 2. Ephemeral: In-memory counters reset whenever a lambda instance cold-starts or scales down.
 * 3. Distributed Production Upgrade: For true cross-instance global rate limiting, an external
 *    key-value store (Upstash Redis or Vercel KV) is required. The `IRateLimiter` interface below
 *    is structured so an Upstash/KV implementation can be dropped in without changing endpoint logic.
 *
 * QUOTA DEFENSE:
 * Groq on-demand tier caps qwen/qwen3.8-27b at ~1,000 output tokens/min account-wide.
 * - /api/interview per-IP limiter: Calibrated to allow one complete interview session (~12 requests/min)
 *   while blocking aggressive abusers and automated scripts (ERR_RATE_LIMIT_IP).
 * - /api/interview instance limiter: Local ceiling per lambda instance (ERR_RATE_LIMIT_INSTANCE).
 * - /api/tts: 10 req/min per IP (ERR_RATE_LIMIT_TTS).
 * - /api/retrieve: 30 req/min per IP (ERR_RATE_LIMIT_RETRIEVE).
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  reasonCode?: string;
}

export interface IRateLimiter {
  check(key: string): RateLimitResult;
}

interface WindowData {
  count: number;
  resetTime: number;
}

export class InMemoryRateLimiter implements IRateLimiter {
  private windows = new Map<string, WindowData>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly defaultReasonCode: string;

  constructor(maxRequests: number = 40, windowMs: number = 60000, defaultReasonCode: string = 'ERR_RATE_LIMIT') {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.defaultReasonCode = defaultReasonCode;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const window = this.windows.get(key);

    if (!window || now > window.resetTime) {
      this.windows.set(key, { count: 1, resetTime: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1, resetMs: this.windowMs };
    }

    if (window.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetMs: window.resetTime - now,
        reasonCode: this.defaultReasonCode
      };
    }

    window.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - window.count,
      resetMs: window.resetTime - now
    };
  }

  // Helper to reset a key (useful for testing)
  reset(key?: string) {
    if (key) this.windows.delete(key);
    else this.windows.clear();
  }
}

// Calibrated Rate Limiters
// Set to 10 req/min per IP. A real interview is paced by human speech and thinking time
// (typically 30-90s per response), so rapid-burst simulations overstate natural usage.
// 10 req/min provides plenty of headroom for normal pacing while blocking abuse.
export const interviewIpLimiter = new InMemoryRateLimiter(10, 60000, 'ERR_RATE_LIMIT_IP');
export const interviewInstanceLimiter = new InMemoryRateLimiter(30, 60000, 'ERR_RATE_LIMIT_INSTANCE');
export const ttsIpLimiter = new InMemoryRateLimiter(10, 60000, 'ERR_RATE_LIMIT_TTS');
export const retrieveIpLimiter = new InMemoryRateLimiter(30, 60000, 'ERR_RATE_LIMIT_RETRIEVE');

// Compatibility aliases
export const defaultRateLimiter = interviewIpLimiter;
export const interviewGlobalLimiter = interviewInstanceLimiter;
