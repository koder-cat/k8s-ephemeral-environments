import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, NotFoundException } from '@nestjs/common';
import { DatabaseTestController } from './database-test.controller';
import { DatabaseTestService, TestRecord } from './database-test.service';

describe('DatabaseTestController', () => {
  let controller: DatabaseTestController;
  let mockService: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    removeAll: ReturnType<typeof vi.fn>;
    getStats: ReturnType<typeof vi.fn>;
    getHeavyQueryPresets: ReturnType<typeof vi.fn>;
    runHeavyQuery: ReturnType<typeof vi.fn>;
  };
  let mockRequest: { correlationId: string };

  const mockRecord: TestRecord = {
    id: 1,
    name: 'Test Record',
    data: { foo: 'bar' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    mockService = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      removeAll: vi.fn(),
      getStats: vi.fn(),
      getHeavyQueryPresets: vi.fn(),
      runHeavyQuery: vi.fn(),
    };
    mockRequest = { correlationId: 'test-123' };

    controller = new DatabaseTestController(mockService as unknown as DatabaseTestService);
  });

  describe('findAll', () => {
    it('should return all records', async () => {
      mockService.findAll.mockResolvedValue([mockRecord]);

      const result = await controller.findAll(mockRequest as any);

      expect(result.records).toEqual([mockRecord]);
      expect(result.count).toBe(1);
      expect(result.timestamp).toBeDefined();
    });

    it('should throw HttpException on error', async () => {
      mockService.findAll.mockRejectedValue(new Error('Database error'));

      await expect(controller.findAll(mockRequest as any)).rejects.toThrow(HttpException);
    });
  });

  describe('findOne', () => {
    it('should return a single record', async () => {
      mockService.findOne.mockResolvedValue(mockRecord);

      const result = await controller.findOne('1', mockRequest as any);

      expect(result).toEqual(mockRecord);
      expect(mockService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw HttpException for invalid ID', async () => {
      await expect(controller.findOne('invalid', mockRequest as any)).rejects.toThrow(HttpException);
    });
  });

  describe('create', () => {
    it('should create a new record', async () => {
      mockService.create.mockResolvedValue(mockRecord);

      const result = await controller.create({ name: 'Test' }, mockRequest as any);

      expect(result).toEqual(mockRecord);
      expect(mockService.create).toHaveBeenCalledWith({ name: 'Test' });
    });

    it('should throw HttpException for empty name', async () => {
      await expect(controller.create({ name: '' }, mockRequest as any)).rejects.toThrow(HttpException);
    });

    it('should throw HttpException for missing name', async () => {
      await expect(controller.create({} as any, mockRequest as any)).rejects.toThrow(HttpException);
    });

    it('should throw HttpException on service error', async () => {
      mockService.create.mockRejectedValue(new Error('Database error'));

      await expect(controller.create({ name: 'Test' }, mockRequest as any)).rejects.toThrow(HttpException);
    });
  });

  describe('update', () => {
    it('should update a record', async () => {
      mockService.update.mockResolvedValue({ ...mockRecord, name: 'Updated' });

      const result = await controller.update('1', { name: 'Updated' }, mockRequest as any);

      expect(result.name).toBe('Updated');
      expect(mockService.update).toHaveBeenCalledWith(1, { name: 'Updated' });
    });

    it('should throw HttpException for invalid ID', async () => {
      await expect(controller.update('invalid', { name: 'Test' }, mockRequest as any)).rejects.toThrow(HttpException);
    });

    it('should rethrow HttpException from service', async () => {
      mockService.update.mockRejectedValue(new NotFoundException('Not found'));

      await expect(controller.update('999', { name: 'Test' }, mockRequest as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a record', async () => {
      mockService.remove.mockResolvedValue({ deleted: true, id: 1 });

      const result = await controller.remove('1', mockRequest as any);

      expect(result).toEqual({ deleted: true, id: 1 });
    });

    it('should throw HttpException for invalid ID', async () => {
      await expect(controller.remove('invalid', mockRequest as any)).rejects.toThrow(HttpException);
    });

    it('should rethrow HttpException from service', async () => {
      mockService.remove.mockRejectedValue(new NotFoundException('Not found'));

      await expect(controller.remove('999', mockRequest as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeAll', () => {
    it('should delete all records', async () => {
      mockService.removeAll.mockResolvedValue({ deleted: 5 });

      const result = await controller.removeAll(mockRequest as any);

      expect(result).toEqual({ deleted: 5 });
    });

    it('should throw HttpException on error', async () => {
      mockService.removeAll.mockRejectedValue(new Error('Database error'));

      await expect(controller.removeAll(mockRequest as any)).rejects.toThrow(HttpException);
    });
  });

  describe('getStats', () => {
    it('should return database stats', async () => {
      const stats = {
        poolStats: { total: 10, idle: 8, active: 2, waiting: 0 },
        recordCount: 100,
        tableSize: '16 kB',
      };
      mockService.getStats.mockResolvedValue(stats);

      const result = await controller.getStats(mockRequest as any);

      expect(result).toEqual(stats);
    });

    it('should throw HttpException on error', async () => {
      mockService.getStats.mockRejectedValue(new Error('Database error'));

      await expect(controller.getStats(mockRequest as any)).rejects.toThrow(HttpException);
    });
  });

  describe('getHeavyQueryPresets', () => {
    it('should return heavy query presets', () => {
      const presets = {
        light: { sleepSeconds: 0.5, rows: 100 },
        medium: { sleepSeconds: 1, rows: 1000 },
      };
      mockService.getHeavyQueryPresets.mockReturnValue(presets);

      const result = controller.getHeavyQueryPresets(mockRequest as any);

      expect(result.presets).toEqual(presets);
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('runHeavyQuery', () => {
    it('should run heavy query', async () => {
      const queryResult = {
        preset: 'light',
        rowCount: 100,
        durationMs: 550,
        timestamp: new Date().toISOString(),
      };
      mockService.runHeavyQuery.mockResolvedValue(queryResult);

      const result = await controller.runHeavyQuery('light', mockRequest as any);

      expect(result).toEqual(queryResult);
    });

    it('should throw HttpException with 400 for unknown preset', async () => {
      mockService.runHeavyQuery.mockRejectedValue(new Error('Unknown preset: invalid'));
      mockService.getHeavyQueryPresets.mockReturnValue({ light: {}, medium: {} });

      try {
        await controller.runHeavyQuery('invalid', mockRequest as any);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(400);
      }
    });

    it('should throw HttpException with 500 for other errors', async () => {
      mockService.runHeavyQuery.mockRejectedValue(new Error('Database connection failed'));

      try {
        await controller.runHeavyQuery('light', mockRequest as any);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(500);
      }
    });
  });
});
