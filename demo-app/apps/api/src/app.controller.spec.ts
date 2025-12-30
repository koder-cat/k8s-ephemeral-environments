import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let mockAppService: {
    getHealth: ReturnType<typeof vi.fn>;
    getInfo: ReturnType<typeof vi.fn>;
    getDatabaseInfo: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAppService = {
      getHealth: vi.fn(),
      getInfo: vi.fn(),
      getDatabaseInfo: vi.fn(),
    };

    // Create controller with mocked service directly
    controller = new AppController(mockAppService as unknown as AppService);
  });

  describe('getHealth', () => {
    it('should return health status with ok status', async () => {
      const healthResult = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: 123,
        database: { enabled: false, connected: false },
      };
      mockAppService.getHealth.mockResolvedValue(healthResult);

      const result = await controller.getHealth();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('database');
    });

    it('should call appService.getHealth', async () => {
      mockAppService.getHealth.mockResolvedValue({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: 0,
        database: { enabled: true, connected: true },
      });

      await controller.getHealth();

      expect(mockAppService.getHealth).toHaveBeenCalledOnce();
    });
  });

  describe('getInfo', () => {
    it('should return environment info', () => {
      const infoResult = {
        pr: '42',
        commit: 'abc123',
        branch: 'feature/test',
        version: '1.0.0',
        previewUrl: 'https://test.example.com',
      };
      mockAppService.getInfo.mockReturnValue(infoResult);

      const result = controller.getInfo();

      expect(result).toHaveProperty('pr');
      expect(result).toHaveProperty('commit');
      expect(result).toHaveProperty('branch');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('previewUrl');
    });

    it('should call appService.getInfo', () => {
      mockAppService.getInfo.mockReturnValue({
        pr: 'unknown',
        commit: 'unknown',
        branch: 'unknown',
        version: '1.0.0',
        previewUrl: 'unknown',
      });

      controller.getInfo();

      expect(mockAppService.getInfo).toHaveBeenCalledOnce();
    });
  });

  describe('getDatabaseInfo', () => {
    it('should return database disabled message when DATABASE_URL not set', async () => {
      mockAppService.getDatabaseInfo.mockResolvedValue({
        enabled: false,
        message: 'Database is not configured (DATABASE_URL not set)',
      });

      const result = await controller.getDatabaseInfo();

      expect(result).toHaveProperty('enabled', false);
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('not configured');
    });

    it('should call appService.getDatabaseInfo', async () => {
      mockAppService.getDatabaseInfo.mockResolvedValue({
        enabled: false,
        message: 'Database is not configured',
      });

      await controller.getDatabaseInfo();

      expect(mockAppService.getDatabaseInfo).toHaveBeenCalledOnce();
    });
  });
});
