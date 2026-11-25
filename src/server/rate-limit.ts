import type { Request, Response, NextFunction } from 'express';

interface RateLimitBucket {
  count: number;
  resetTime: number;
}

const ipBuckets = new Map<string, RateLimitBucket>();

// Cleanup stale IP buckets every 5 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of ipBuckets.entries()) {
    if (now > bucket.resetTime) {
      ipBuckets.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
  skipInTests?: boolean;
}

/**
 * Enterprise In-Memory Rate Limiting & DoS Protection Middleware
 * Protects against traffic surges, credential brute-forcing, and endpoint exhaustion.
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default window
  const maxRequests = options.maxRequests || 1200; // 1200 requests / minute default for corporate NAT busy hours
  const message = options.message || 'Too many requests from this IP, please try again later.';
  const skipInTests = options.skipInTests !== false;

  return (req: Request, res: Response, next: NextFunction) => {
    // Bypass in test suites unless explicitly tested
    if (skipInTests && (process.env.NODE_ENV === 'test' || process.env.VITEST)) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const now = Date.now();

    let bucket = ipBuckets.get(ip);
    if (!bucket || now > bucket.resetTime) {
      bucket = {
        count: 1,
        resetTime: now + windowMs,
      };
      ipBuckets.set(ip, bucket);
    } else {
      bucket.count += 1;
    }

    const remaining = Math.max(0, maxRequests - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetSeconds.toString());

    if (bucket.count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds.toString());
      return res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: resetSeconds,
      });
    }

    next();
  };
}
