import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import { MetricsService } from '../metrics/metrics.service';
import { AuditService } from '../audit/audit.service';
import { CacheStats, CacheStatus, RateLimitResult } from './dto/cache-stats.dto';

/**
 * Cache Service - Redis-based caching and rate limiting
 *
 * Features:
 * - Key-value caching with TTL
 * - Sliding window rate limiting
 * - Cache statistics tracking
 * - Graceful degradation when disabled
 *
 * Follows DatabaseService patterns:
 * - onModuleInit with 3-retry logic
 * - Metrics instrumentation
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;
  private isConnected = false;
  private stats = { hits: 0, misses: 0 };

  constructor(
    @InjectPinoLogger(CacheService.name)
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Log a cache operation to audit trail (fire-and-forget)
   */
  private logCacheOperation(
    operation: string,
    key?: string,
    durationMs?: number,
  ): void {
    this.audit.logEvent({
      type: 'cache_operation',
      timestamp: new Date(),
      metadata: {
        operation,
        key,
        durationMs,
      },
    });
  }

  /**
   * Check if Redis is configured (via URL or individual components)
   */
  get enabled(): boolean {
    return !!(
      process.env.REDIS_URL ||
      (process.env.REDIS_HOST && process.env.REDIS_PORT)
    );
  }

  /**
   * Get Redis connection URL, constructing from components if needed
   */
  private getRedisUrl(): string {
    if (process.env.REDIS_URL) {
      return process.env.REDIS_URL;
    }
    // Construct from components (for Kubernetes with auth enabled)
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT || '6379';
    const password = process.env.REDIS_PASSWORD;
    if (password) {
      // URL-encode password to handle special characters like @, :, /
      const encodedPassword = encodeURIComponent(password);
      return `redis://:${encodedPassword}@${host}:${port}`;
    }
    return `redis://${host}:${port}`;
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.info('Redis not configured, caching features disabled');
      return;
    }

    try {
      this.redis = new Redis(this.getRedisUrl(), {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        connectTimeout: 5000,
        lazyConnect: true,
      });

      // Track connection state changes
      this.redis.on('error', (error) => {
        this.logger.error({ error: error.message }, 'Redis connection error');
        this.isConnected = false;
      });
      this.redis.on('close', () => {
        this.logger.warn('Redis connection closed');
        this.isConnected = false;
      });
      this.redis.on('reconnecting', () => {
        this.logger.info('Redis reconnecting...');
      });
      this.redis.on('ready', () => {
        this.logger.info('Redis connection ready');
        this.isConnected = true;
      });

      await this.waitForRedis();
      this.isConnected = true;
      this.logger.info('Cache service initialized');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize cache service');
      throw error;
    }
  }

  /**
   * Wait for Redis with short retry logic.
   */
  private async waitForRedis(maxRetries = 3, delayMs = 1000): Promise<void> {
    if (!this.redis) return;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.redis.connect();
        const result = await this.redis.ping();
        if (result === 'PONG') {
          if (attempt > 1) {
            this.logger.info({ attempt }, 'Redis connection established');
          }
          return;
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          this.logger.warn(
            { attempt, maxRetries, error: lastError.message },
            'Redis not ready, retrying...',
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw new Error(
      `Redis not available after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.logger.info('Redis connection closed');
    }
  }

  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.isConnected || !this.redis) {
      return null;
    }

    const endTimer = this.metrics.cacheOperationDuration.startTimer({
      operation: 'get',
    });
    let success = true;

    try {
      const value = await this.redis.get(key);
      if (value !== null) {
        this.stats.hits++;
        this.metrics.cacheHitsTotal.inc();
        return JSON.parse(value) as T;
      }
      this.stats.misses++;
      this.metrics.cacheMissesTotal.inc();
      return null;
    } catch (error) {
      success = false;
      this.logger.error({ error, key }, 'Failed to get cached value');
      return null;
    } finally {
      endTimer({ success: String(success) });
    }
  }

  /**
   * Set a cached value with optional TTL
   */
  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!this.enabled || !this.isConnected || !this.redis) {
      return;
    }

    const startTime = Date.now();
    const endTimer = this.metrics.cacheOperationDuration.startTimer({
      operation: 'set',
    });
    let success = true;

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSeconds, serialized);
      this.logCacheOperation('SET', key, Date.now() - startTime);
    } catch (error) {
      success = false;
      this.logger.error({ error, key }, 'Failed to set cached value');
    } finally {
      endTimer({ success: String(success) });
    }
  }

  /**
   * Delete a cached value
   */
  async del(key: string): Promise<void> {
    if (!this.enabled || !this.isConnected || !this.redis) {
      return;
    }

    const startTime = Date.now();

    try {
      await this.redis.del(key);
      this.logCacheOperation('DEL', key, Date.now() - startTime);
    } catch (error) {
      this.logger.error({ error, key }, 'Failed to delete cached value');
    }
  }

  /**
   * Flush all keys (admin only)
   */
  async flush(): Promise<void> {
    if (!this.enabled || !this.isConnected || !this.redis) {
      return;
    }

    const startTime = Date.now();

    try {
      await this.redis.flushdb();
      this.stats = { hits: 0, misses: 0 };
      this.logCacheOperation('FLUSH', undefined, Date.now() - startTime);
      this.logger.info('Cache flushed');
    } catch (error) {
      this.logger.error({ error }, 'Failed to flush cache');
      throw error;
    }
  }

  /**
   * Check rate limit using sliding window algorithm
   *
   * Uses Redis sorted sets for efficient sliding window implementation.
   * Each request is stored with its timestamp as the score.
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    if (!this.enabled || !this.isConnected || !this.redis) {
      // Graceful degradation - allow all requests when Redis is unavailable
      return { allowed: true, remaining: limit, resetMs: 0, limit };
    }

    const endTimer = this.metrics.cacheOperationDuration.startTimer({
      operation: 'rate_limit',
    });
    let success = true;

    try {
      const now = Date.now();
      const windowKey = `ratelimit:${key}`;
      const windowMs = windowSeconds * 1000;

      // First, clean up old entries and check the current count
      const checkMulti = this.redis.multi();
      checkMulti.zremrangebyscore(windowKey, 0, now - windowMs);
      checkMulti.zcard(windowKey);
      const checkResults = await checkMulti.exec();
      const currentCount = (checkResults?.[1]?.[1] as number) || 0;

      const allowed = currentCount < limit;

      if (allowed) {
        // Only add entry if request is allowed
        await this.redis.zadd(windowKey, now, `${now}-${Math.random()}`);
        await this.redis.expire(windowKey, windowSeconds);
      } else {
        this.metrics.rateLimitRejectionsTotal.inc();
      }

      return {
        allowed,
        remaining: Math.max(0, limit - currentCount - (allowed ? 1 : 0)),
        resetMs: windowMs,
        limit,
      };
    } catch (error) {
      success = false;
      this.logger.error({ error, key }, 'Failed to check rate limit');
      // On error, allow the request
      return { allowed: true, remaining: limit, resetMs: 0, limit };
    } finally {
      endTimer({ success: String(success) });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!this.enabled || !this.isConnected || !this.redis) {
      return {
        enabled: this.enabled,
        connected: false,
        hits: 0,
        misses: 0,
        hitRate: 0,
        keysCount: 0,
      };
    }

    try {
      const keysCount = await this.redis.dbsize();
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsedBytes = memoryMatch ? parseInt(memoryMatch[1], 10) : undefined;

      const total = this.stats.hits + this.stats.misses;
      const hitRate = total > 0 ? Math.round((this.stats.hits / total) * 100) : 0;

      return {
        enabled: true,
        connected: this.isConnected,
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate,
        keysCount,
        memoryUsedBytes,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get cache stats');
      return {
        enabled: true,
        connected: false,
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
        keysCount: 0,
      };
    }
  }

  /**
   * Get service status for health checks
   */
  async getStatus(): Promise<CacheStatus> {
    if (!this.enabled) {
      return { enabled: false, connected: false };
    }

    if (!this.isConnected || !this.redis) {
      return { enabled: true, connected: false };
    }

    try {
      const memInfo = await this.redis.info('memory');
      const clientInfo = await this.redis.info('clients');

      const memoryMatch = memInfo.match(/used_memory_human:(.+)/);
      const clientsMatch = clientInfo.match(/connected_clients:(\d+)/);

      return {
        enabled: true,
        connected: true,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        memoryUsed: memoryMatch?.[1]?.trim(),
        connectedClients: clientsMatch ? parseInt(clientsMatch[1], 10) : undefined,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get cache status');
      return { enabled: true, connected: false };
    }
  }

  /**
   * List keys matching a pattern
   */
  async listKeys(pattern = '*', limit = 100): Promise<string[]> {
    if (!this.enabled || !this.isConnected || !this.redis) {
      return [];
    }

    try {
      const keys: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, batch] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        keys.push(...batch);

        if (keys.length >= limit) {
          break;
        }
      } while (cursor !== '0');

      return keys.slice(0, limit);
    } catch (error) {
      this.logger.error({ error, pattern }, 'Failed to list keys');
      return [];
    }
  }
}
