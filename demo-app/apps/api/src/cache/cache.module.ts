import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheService } from './cache.service';
import { CacheController } from './cache.controller';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';

/**
 * Cache Module - Redis-based caching and rate limiting
 *
 * Features:
 * - Key-value caching with TTL
 * - Sliding window rate limiting via @RateLimit() decorator
 * - Cache statistics and management endpoints
 * - Graceful degradation when Redis unavailable
 *
 * @Global() decorator makes CacheService available throughout the app
 * without needing to import CacheModule in every module.
 *
 * Note: AuditService is injected via @Global() AuditModule - no import needed.
 */
@Global()
@Module({
  controllers: [CacheController],
  providers: [
    CacheService,
    // Register RateLimitGuard globally
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
