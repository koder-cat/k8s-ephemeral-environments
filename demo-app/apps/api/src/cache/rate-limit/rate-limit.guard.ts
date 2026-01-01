import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { CacheService } from '../cache.service';
import { RATE_LIMIT_KEY, RateLimitConfig } from './rate-limit.decorator';

/**
 * Rate Limit Guard
 *
 * Enforces rate limiting on endpoints decorated with @RateLimit().
 * Uses Redis sliding window algorithm via CacheService.
 *
 * Sets standard rate limit headers:
 * - X-RateLimit-Limit
 * - X-RateLimit-Remaining
 * - X-RateLimit-Reset
 *
 * Returns 429 Too Many Requests when limit is exceeded.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitConfig = this.reflector.get<RateLimitConfig>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    // No rate limit configured for this endpoint
    if (!rateLimitConfig) {
      return true;
    }

    // Redis not available - allow request (graceful degradation)
    if (!this.cacheService.enabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Create rate limit key from IP + path
    const key = this.getKey(request);

    const result = await this.cacheService.checkRateLimit(
      key,
      rateLimitConfig.limit,
      rateLimitConfig.windowSeconds,
    );

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(result.resetMs / 1000),
    );

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too Many Requests',
          error: `Rate limit exceeded. Try again in ${Math.ceil(result.resetMs / 1000)} seconds.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getKey(request: Request): string {
    // Use IP + method + path as rate limit key.
    // Note: For accurate IP detection behind a reverse proxy (like Traefik/Nginx),
    // ensure Express is configured with `app.set('trust proxy', true)`.
    // When trust proxy is set, request.ip will contain the correct client IP
    // from x-forwarded-for, making it safe to use directly.
    const ip = request.ip || 'unknown';
    return `${ip}:${request.method}:${request.path}`;
  }
}
