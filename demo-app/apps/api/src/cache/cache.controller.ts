import {
  Controller,
  Get,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheStats, CacheStatus } from './dto/cache-stats.dto';
import { RateLimit } from './rate-limit/rate-limit.decorator';

interface DisabledResponse {
  enabled: false;
  message: string;
}

/**
 * Cache Controller
 *
 * Provides endpoints for cache management and statistics.
 * All endpoints gracefully degrade when Redis is disabled.
 */
@Controller('cache')
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  /**
   * Get cache statistics
   *
   * Returns hit/miss counts, hit rate, keys count, and memory usage.
   */
  @Get('stats')
  async getStats(): Promise<CacheStats | DisabledResponse> {
    if (!this.cacheService.enabled) {
      return {
        enabled: false,
        message: 'Cache service not configured (REDIS_URL not set)',
      };
    }

    try {
      return await this.cacheService.getStats();
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to get cache statistics',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get cache service status
   *
   * Used for health checks and dashboard status display.
   */
  @Get('status')
  async getStatus(): Promise<CacheStatus> {
    return this.cacheService.getStatus();
  }

  /**
   * List cache keys
   *
   * @param pattern - Glob pattern to filter keys (default: *)
   * @param limit - Maximum keys to return (default: 100)
   */
  @Get('keys')
  async listKeys(
    @Query('pattern') pattern = '*',
    @Query('limit') limit = '100',
  ): Promise<{ keys: string[]; pattern: string } | DisabledResponse> {
    if (!this.cacheService.enabled) {
      return {
        enabled: false,
        message: 'Cache service not configured (REDIS_URL not set)',
      };
    }

    // Validate pattern to prevent injection attacks
    // Only allow safe glob characters: alphanumeric, *, ?, -, _, :, /
    if (!/^[a-zA-Z0-9*?\-_:/]*$/.test(pattern)) {
      throw new BadRequestException(
        'Invalid pattern. Only alphanumeric characters and glob wildcards (*, ?) are allowed.',
      );
    }

    const keys = await this.cacheService.listKeys(pattern, parseInt(limit, 10));
    return { keys, pattern };
  }

  /**
   * Flush all cache keys
   *
   * WARNING: This clears all cached data!
   * Rate limited to 1 request per minute to prevent abuse.
   */
  @Delete('flush')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(1, 60)
  async flush(): Promise<void> {
    if (!this.cacheService.enabled) {
      return;
    }

    try {
      await this.cacheService.flush();
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to flush cache',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
