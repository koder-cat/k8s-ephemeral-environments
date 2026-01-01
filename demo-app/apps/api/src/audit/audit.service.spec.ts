import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuditService } from './audit.service';
import { MetricsService } from '../metrics/metrics.service';
import { PinoLogger } from 'nestjs-pino';

// Mock MongoDB
vi.mock('mongodb', () => ({
  MongoClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    db: vi.fn().mockReturnValue({
      admin: vi.fn().mockReturnValue({
        ping: vi.fn().mockResolvedValue({ ok: 1 }),
      }),
      databaseName: 'testdb',
      collection: vi.fn().mockReturnValue({
        createIndex: vi.fn().mockResolvedValue('index'),
        insertOne: vi.fn().mockResolvedValue({ insertedId: 'test-id' }),
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([]),
              }),
            }),
            limit: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue([{ timestamp: new Date() }]),
            }),
          }),
        }),
        aggregate: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
        countDocuments: vi.fn().mockResolvedValue(0),
      }),
      command: vi.fn().mockResolvedValue({ storageSize: 1024 }),
    }),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnThis(),
  })),
}));

describe('AuditService', () => {
  let service: AuditService;
  let mockLogger: PinoLogger;
  let mockMetrics: MetricsService;

  beforeEach(() => {
    vi.stubEnv('MONGODB_URL', 'mongodb://localhost:27017/test');

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as PinoLogger;

    mockMetrics = {
      mongoOperationDuration: {
        startTimer: vi.fn().mockReturnValue(() => {}),
      },
      auditEventsTotal: {
        inc: vi.fn(),
      },
    } as unknown as MetricsService;

    service = new AuditService(mockLogger, mockMetrics);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('enabled', () => {
    it('should return true when MONGODB_URL is set', () => {
      expect(service.enabled).toBe(true);
    });

    it('should return false when MONGODB_URL is not set', () => {
      vi.stubEnv('MONGODB_URL', '');
      const newService = new AuditService(mockLogger, mockMetrics);
      expect(newService.enabled).toBe(false);
    });
  });

  describe('onModuleInit', () => {
    it('should initialize when enabled', async () => {
      await service.onModuleInit();
      expect(mockLogger.info).toHaveBeenCalledWith('Audit service initialized');
    });

    it('should skip initialization when disabled', async () => {
      vi.stubEnv('MONGODB_URL', '');
      const newService = new AuditService(mockLogger, mockMetrics);
      await newService.onModuleInit();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MONGODB_URL not set, audit features disabled',
      );
    });
  });

  describe('getStatus', () => {
    it('should return disabled status when not configured', async () => {
      vi.stubEnv('MONGODB_URL', '');
      const newService = new AuditService(mockLogger, mockMetrics);
      const status = await newService.getStatus();
      expect(status).toEqual({ enabled: false, connected: false });
    });

    it('should return enabled status when connected', async () => {
      await service.onModuleInit();
      const status = await service.getStatus();
      expect(status).toEqual({
        enabled: true,
        connected: true,
        database: 'testdb',
        collection: 'audit_events',
        ttlDays: 7,
      });
    });
  });

  describe('logEvent', () => {
    it('should not throw when service is disabled', async () => {
      vi.stubEnv('MONGODB_URL', '');
      const newService = new AuditService(mockLogger, mockMetrics);
      await expect(
        newService.logEvent({
          type: 'api_request',
          timestamp: new Date(),
          path: '/test',
          method: 'GET',
          statusCode: 200,
        }),
      ).resolves.toBeUndefined();
    });

    it('should log event when connected', async () => {
      await service.onModuleInit();
      await service.logEvent({
        type: 'api_request',
        timestamp: new Date(),
        path: '/test',
        method: 'GET',
        statusCode: 200,
      });
      expect(mockMetrics.auditEventsTotal.inc).toHaveBeenCalledWith({
        type: 'api_request',
      });
    });
  });

  describe('queryEvents', () => {
    it('should return empty array when disabled', async () => {
      vi.stubEnv('MONGODB_URL', '');
      const newService = new AuditService(mockLogger, mockMetrics);
      const events = await newService.queryEvents({});
      expect(events).toEqual([]);
    });

    it('should query events with filters', async () => {
      await service.onModuleInit();
      const events = await service.queryEvents({
        type: 'api_request',
        limit: 10,
      });
      expect(events).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return zero stats when disabled', async () => {
      vi.stubEnv('MONGODB_URL', '');
      const newService = new AuditService(mockLogger, mockMetrics);
      const stats = await newService.getStats();
      expect(stats.totalEvents).toBe(0);
    });

    it('should return stats when connected', async () => {
      await service.onModuleInit();
      const stats = await service.getStats();
      expect(stats).toHaveProperty('eventsByType');
    });
  });
});
