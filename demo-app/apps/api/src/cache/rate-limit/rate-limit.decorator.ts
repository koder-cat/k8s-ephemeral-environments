import { SetMetadata } from '@nestjs/common';

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Rate Limit Decorator
 *
 * Apply to controller methods to enforce rate limiting.
 * Uses Redis sliding window algorithm.
 *
 * @param limit - Maximum requests allowed in the window
 * @param windowSeconds - Time window in seconds
 *
 * @example
 * ```
 * @RateLimit(5, 60) // 5 requests per minute
 * @Post('stress')
 * async runStress() { ... }
 * ```
 */
export const RateLimit = (limit: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds });
