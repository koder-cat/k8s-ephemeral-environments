import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppService } from './app.service';
import { DatabaseService } from './database.service';

// Create a mock type that allows `enabled` to be mutable
interface MockDatabaseService {
  enabled: boolean;
  getStatus: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
}

describe('AppService', () => {
  let appService: AppService;
  let mockDatabaseService: MockDatabaseService;

  beforeEach(() => {
    mockDatabaseService = {
      enabled: false,
      getStatus: vi.fn().mockResolvedValue({ enabled: false, connected: false }),
      query: vi.fn(),
    };

    appService = new AppService(
      mockDatabaseService as unknown as DatabaseService,
    );
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.PR_NUMBER;
    delete process.env.COMMIT_SHA;
    delete process.env.BRANCH_NAME;
    delete process.env.APP_VERSION;
    delete process.env.PREVIEW_URL;
  });

  describe('getHealth', () => {
    it('should return ok status', async () => {
      const result = await appService.getHealth();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.uptime).toBe('number');
    });

    it('should include database status', async () => {
      const result = await appService.getHealth();

      expect(result.database).toEqual({ enabled: false, connected: false });
    });

    it('should return uptime as positive number', async () => {
      const result = await appService.getHealth();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return valid ISO timestamp', async () => {
      const result = await appService.getHealth();

      const parsedDate = new Date(result.timestamp);
      expect(parsedDate.toISOString()).toBe(result.timestamp);
    });
  });

  describe('getInfo', () => {
    it('should return environment variables with defaults', () => {
      const result = appService.getInfo();

      expect(result.pr).toBe('unknown');
      expect(result.commit).toBe('unknown');
      expect(result.branch).toBe('unknown');
      expect(result.version).toBe('1.0.0');
      expect(result.previewUrl).toBe('unknown');
    });

    it('should return actual environment variables when set', () => {
      process.env.PR_NUMBER = '42';
      process.env.COMMIT_SHA = 'abc1234';
      process.env.BRANCH_NAME = 'feature/test';
      process.env.APP_VERSION = '2.0.0';
      process.env.PREVIEW_URL = 'https://test.example.com';

      const result = appService.getInfo();

      expect(result.pr).toBe('42');
      expect(result.commit).toBe('abc1234');
      expect(result.branch).toBe('feature/test');
      expect(result.version).toBe('2.0.0');
      expect(result.previewUrl).toBe('https://test.example.com');
    });
  });

  describe('getDatabaseInfo', () => {
    it('should return disabled message when database not enabled', async () => {
      mockDatabaseService.enabled = false;

      const result = await appService.getDatabaseInfo();

      expect(result.enabled).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('should return connection failed when database enabled but not connected', async () => {
      mockDatabaseService.enabled = true;
      mockDatabaseService.getStatus = vi.fn().mockResolvedValue({
        enabled: true,
        connected: false,
      });

      const result = await appService.getDatabaseInfo();

      expect(result.enabled).toBe(true);
      expect(result.connected).toBe(false);
      expect(result.message).toBe('Database connection failed');
    });

    it('should return database info when connected', async () => {
      mockDatabaseService.enabled = true;
      mockDatabaseService.getStatus = vi.fn().mockResolvedValue({
        enabled: true,
        connected: true,
        host: 'localhost',
        database: 'testdb',
        version: '16.0',
      });
      mockDatabaseService.query = vi
        .fn()
        .mockResolvedValueOnce([{ table_name: 'users' }, { table_name: 'posts' }])
        .mockResolvedValueOnce([{ size: '16 MB' }]);

      const result = await appService.getDatabaseInfo();

      expect(result.enabled).toBe(true);
      expect(result.connected).toBe(true);
      expect(result.host).toBe('localhost');
      expect(result.database).toBe('testdb');
      expect(result.version).toBe('16.0');
      expect(result.tables).toEqual(['users', 'posts']);
      expect(result.size).toBe('16 MB');
    });

    it('should handle query errors gracefully', async () => {
      mockDatabaseService.enabled = true;
      mockDatabaseService.getStatus = vi.fn().mockResolvedValue({
        enabled: true,
        connected: true,
        host: 'localhost',
        database: 'testdb',
        version: '16.0',
      });
      mockDatabaseService.query = vi.fn().mockRejectedValue(new Error('Query failed'));

      const result = await appService.getDatabaseInfo();

      expect(result.enabled).toBe(true);
      expect(result.connected).toBe(true);
      expect(result.error).toBe('Query failed');
    });
  });
});
