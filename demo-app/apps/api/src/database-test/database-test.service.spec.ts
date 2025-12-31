import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DatabaseTestService } from './database-test.service';
import { DatabaseService } from '../database.service';

describe('DatabaseTestService', () => {
  let service: DatabaseTestService;
  let mockDatabase: {
    query: ReturnType<typeof vi.fn>;
    getPoolStats: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDatabase = {
      query: vi.fn(),
      getPoolStats: vi.fn().mockReturnValue({
        total: 10,
        idle: 8,
        active: 2,
        waiting: 0,
      }),
    };

    service = new DatabaseTestService(mockDatabase as unknown as DatabaseService);
  });

  describe('findAll', () => {
    it('should return all test records', async () => {
      const mockRecords = [
        { id: 1, name: 'Test 1', data: {}, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Test 2', data: {}, created_at: '2024-01-02', updated_at: '2024-01-02' },
      ];
      mockDatabase.query.mockResolvedValue(mockRecords);

      const result = await service.findAll();

      expect(result).toEqual(mockRecords);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, data'),
        undefined,
        'read_record',
      );
    });
  });

  describe('findOne', () => {
    it('should return a single record', async () => {
      const mockRecord = { id: 1, name: 'Test', data: {}, created_at: '2024-01-01', updated_at: '2024-01-01' };
      mockDatabase.query.mockResolvedValue([mockRecord]);

      const result = await service.findOne(1);

      expect(result).toEqual(mockRecord);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        [1],
        'read_record',
      );
    });

    it('should throw NotFoundException when record not found', async () => {
      mockDatabase.query.mockResolvedValue([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new record', async () => {
      const mockRecord = { id: 1, name: 'Test', data: { foo: 'bar' }, created_at: '2024-01-01', updated_at: '2024-01-01' };
      mockDatabase.query.mockResolvedValue([mockRecord]);

      const result = await service.create({ name: 'Test', data: { foo: 'bar' } });

      expect(result).toEqual(mockRecord);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_records'),
        ['Test', JSON.stringify({ foo: 'bar' })],
        'create_record',
      );
    });

    it('should handle empty data', async () => {
      const mockRecord = { id: 1, name: 'Test', data: {}, created_at: '2024-01-01', updated_at: '2024-01-01' };
      mockDatabase.query.mockResolvedValue([mockRecord]);

      await service.create({ name: 'Test' });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_records'),
        ['Test', '{}'],
        'create_record',
      );
    });
  });

  describe('update', () => {
    it('should update a record with name', async () => {
      const mockRecord = { id: 1, name: 'Updated', data: {}, created_at: '2024-01-01', updated_at: '2024-01-01' };
      mockDatabase.query.mockResolvedValue([mockRecord]);

      const result = await service.update(1, { name: 'Updated' });

      expect(result).toEqual(mockRecord);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_records'),
        ['Updated', 1],
        'update_record',
      );
    });

    it('should update a record with data', async () => {
      const mockRecord = { id: 1, name: 'Test', data: { foo: 'baz' }, created_at: '2024-01-01', updated_at: '2024-01-01' };
      mockDatabase.query.mockResolvedValue([mockRecord]);

      const result = await service.update(1, { data: { foo: 'baz' } });

      expect(result).toEqual(mockRecord);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_records'),
        [JSON.stringify({ foo: 'baz' }), 1],
        'update_record',
      );
    });

    it('should return existing record when no updates provided', async () => {
      const mockRecord = { id: 1, name: 'Test', data: {}, created_at: '2024-01-01', updated_at: '2024-01-01' };
      mockDatabase.query.mockResolvedValue([mockRecord]);

      const result = await service.update(1, {});

      expect(result).toEqual(mockRecord);
    });

    it('should throw NotFoundException when record not found', async () => {
      mockDatabase.query.mockResolvedValue([]);

      await expect(service.update(999, { name: 'Updated' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a record', async () => {
      mockDatabase.query.mockResolvedValue([{ id: 1 }]);

      const result = await service.remove(1);

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM test_records'),
        [1],
        'delete_record',
      );
    });

    it('should throw NotFoundException when record not found', async () => {
      mockDatabase.query.mockResolvedValue([]);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeAll', () => {
    it('should delete all records', async () => {
      mockDatabase.query.mockResolvedValue([{ count: '5' }]);

      const result = await service.removeAll();

      expect(result).toEqual({ deleted: 5 });
    });

    it('should handle empty result', async () => {
      mockDatabase.query.mockResolvedValue([{}]);

      const result = await service.removeAll();

      expect(result).toEqual({ deleted: 0 });
    });
  });

  describe('count', () => {
    it('should return record count', async () => {
      mockDatabase.query.mockResolvedValue([{ count: '42' }]);

      const result = await service.count();

      expect(result).toEqual({ count: 42 });
    });
  });

  describe('runHeavyQuery', () => {
    it('should run heavy query with valid preset', async () => {
      mockDatabase.query.mockResolvedValue([]);

      const result = await service.runHeavyQuery('light');

      expect(result.preset).toBe('light');
      expect(result.rowCount).toBe(100);
      expect(result.durationMs).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should throw error for unknown preset', async () => {
      await expect(service.runHeavyQuery('invalid')).rejects.toThrow('Unknown preset: invalid');
    });
  });

  describe('getHeavyQueryPresets', () => {
    it('should return all presets', () => {
      const presets = service.getHeavyQueryPresets();

      expect(presets.light).toEqual({ sleepSeconds: 0.5, rows: 100 });
      expect(presets.medium).toEqual({ sleepSeconds: 1, rows: 1000 });
      expect(presets.heavy).toEqual({ sleepSeconds: 3, rows: 5000 });
      expect(presets.extreme).toEqual({ sleepSeconds: 5, rows: 10000 });
    });
  });

  describe('getStats', () => {
    it('should return database stats', async () => {
      mockDatabase.query
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce([{ size: '8 kB' }]);

      const result = await service.getStats();

      expect(result.poolStats).toEqual({
        total: 10,
        idle: 8,
        active: 2,
        waiting: 0,
      });
      expect(result.recordCount).toBe(10);
      expect(result.tableSize).toBe('8 kB');
    });

    it('should handle unknown table size', async () => {
      mockDatabase.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);

      const result = await service.getStats();

      expect(result.tableSize).toBe('unknown');
    });
  });
});
