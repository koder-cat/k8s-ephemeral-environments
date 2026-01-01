import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheService } from './cache.service';
import { MetricsService } from '../metrics/metrics.service';
import { AuditService } from '../audit/audit.service';
import { PinoLogger } from 'nestjs-pino';

// Mock ioredis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    flushdb: vi.fn().mockResolvedValue('OK'),
    dbsize: vi.fn().mockResolvedValue(10),
    info: vi.fn().mockResolvedValue('used_memory:1024\nconnected_clients:5'),
    quit: vi.fn().mockResolvedValue('OK'),
    multi: vi.fn().mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
    }),
    scan: vi.fn().mockResolvedValue(['0', ['key1', 'key2']]),
    on: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  })),
}));

describe('CacheService', () => {
  let service: CacheService;
  let mockLogger: PinoLogger;
  let mockMetrics: MetricsService;
  let mockAudit: AuditService;

  beforeEach(() => {
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as PinoLogger;

    mockMetrics = {
      cacheOperationDuration: {
        startTimer: vi.fn().mockReturnValue(() => {}),
      },
      cacheHitsTotal: {
        inc: vi.fn(),
      },
      cacheMissesTotal: {
        inc: vi.fn(),
      },
      rateLimitRejectionsTotal: {
        inc: vi.fn(),
      },
    } as unknown as MetricsService;

    mockAudit = {
      logEvent: vi.fn(),
    } as unknown as AuditService;

    service = new CacheService(mockLogger, mockMetrics, mockAudit);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('enabled', () => {
    it('should return true when REDIS_URL is set', () => {
      expect(service.enabled).toBe(true);
    });

    it('should return true when REDIS_HOST and REDIS_PORT are set', () => {
      vi.stubEnv('REDIS_URL', '');
      vi.stubEnv('REDIS_HOST', 'redis-server');
      vi.stubEnv('REDIS_PORT', '6379');
      const newService = new CacheService(mockLogger, mockMetrics, mockAudit);
      expect(newService.enabled).toBe(true);
    });

    it('should return false when no Redis config is set', () => {
      vi.stubEnv('REDIS_URL', '');
      vi.stubEnv('REDIS_HOST', '');
      vi.stubEnv('REDIS_PORT', '');
      const newService = new CacheService(mockLogger, mockMetrics, mockAudit);
      expect(newService.enabled).toBe(false);
    });
  });

  describe('onModuleInit', () => {
    it('should initialize when enabled', async () => {
      await service.onModuleInit();
      expect(mockLogger.info).toHaveBeenCalledWith('Cache service initialized');
    });

    it('should skip initialization when disabled', async () => {
      vi.stubEnv('REDIS_URL', '');
      vi.stubEnv('REDIS_HOST', '');
      vi.stubEnv('REDIS_PORT', '');
      const newService = new CacheService(mockLogger, mockMetrics, mockAudit);
      await newService.onModuleInit();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Redis not configured, caching features disabled',
      );
    });
  });

  describe('get/set', () => {
    it('should return null when disabled', async () => {
      vi.stubEnv('REDIS_URL', '');
      vi.stubEnv('REDIS_HOST', '');
      const newService = new CacheService(mockLogger, mockMetrics, mockAudit);
      const result = await newService.get('test-key');
      expect(result).toBeNull();
    });

    it('should set and get cached values', async () => {
      await service.onModuleInit();
      await service.set('test-key', { value: 123 });
      expect(mockMetrics.cacheMissesTotal.inc).not.toHaveBeenCalled();
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests when disabled', async () => {
      vi.stubEnv('REDIS_URL', '');
      vi.stubEnv('REDIS_HOST', '');
      const newService = new CacheService(mockLogger, mockMetrics, mockAudit);
      const result = await newService.checkRateLimit('test', 10, 60);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('should check rate limits when connected', async () => {
      await service.onModuleInit();
      const result = await service.checkRateLimit('test-key', 10, 60);
      expect(result.limit).toBe(10);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return zero stats when disabled', async () => {
      vi.stubEnv('REDIS_URL', '');
      vi.stubEnv('REDIS_HOST', '');
      const newService = new CacheService(mockLogger, mockMetrics, mockAudit);
      const stats = await newService.getStats();
      expect(stats.connected).toBe(false);
      expect(stats.hits).toBe(0);
    });

    it('should return stats when connected', async () => {
      await service.onModuleInit();
      const stats = await service.getStats();
      expect(stats.connected).toBe(true);
      expect(stats.keysCount).toBe(10);
    });
  });

  describe('getStatus', () => {
    it('should return disabled status when not configured', async () => {
      vi.stubEnv('REDIS_URL', '');
      vi.stubEnv('REDIS_HOST', '');
      const newService = new CacheService(mockLogger, mockMetrics, mockAudit);
      const status = await newService.getStatus();
      expect(status).toEqual({ enabled: false, connected: false });
    });

    it('should return connected status when initialized', async () => {
      await service.onModuleInit();
      const status = await service.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.connected).toBe(true);
    });
  });

  describe('flush', () => {
    it('should do nothing when disabled', async () => {
      vi.stubEnv('REDIS_URL', '');
      vi.stubEnv('REDIS_HOST', '');
      const newService = new CacheService(mockLogger, mockMetrics, mockAudit);
      await newService.flush();
      expect(mockLogger.info).not.toHaveBeenCalledWith('Cache flushed');
    });

    it('should flush cache when connected', async () => {
      await service.onModuleInit();
      await service.flush();
      expect(mockLogger.info).toHaveBeenCalledWith('Cache flushed');
    });
  });

  describe('listKeys', () => {
    it('should return empty array when disabled', async () => {
      vi.stubEnv('REDIS_URL', '');
      vi.stubEnv('REDIS_HOST', '');
      const newService = new CacheService(mockLogger, mockMetrics, mockAudit);
      const keys = await newService.listKeys();
      expect(keys).toEqual([]);
    });

    it('should list keys when connected', async () => {
      await service.onModuleInit();
      const keys = await service.listKeys('*', 10);
      expect(keys).toEqual(['key1', 'key2']);
    });
  });
});
