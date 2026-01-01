import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DatabaseTestService } from './database-test.service';
import { DatabaseService } from '../database.service';
import { PinoLogger } from 'nestjs-pino';

// Mock record data
const mockRecord = {
  id: 1,
  name: 'Test',
  data: {},
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('DatabaseTestService', () => {
  let service: DatabaseTestService;
  let mockDatabase: {
    db: {
      select: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    query: ReturnType<typeof vi.fn>;
    getPoolStats: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  // Helper to create chainable mock for Drizzle queries
  const createChainableMock = (result: unknown) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue(result);
    chain.values = vi.fn().mockReturnValue(chain);
    chain.set = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockResolvedValue(result);
    return chain;
  };

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockDatabase = {
      db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      query: vi.fn(),
      getPoolStats: vi.fn().mockReturnValue({
        total: 10,
        idle: 8,
        active: 2,
        waiting: 0,
      }),
    };

    service = new DatabaseTestService(
      mockDatabase as unknown as DatabaseService,
      mockLogger as unknown as PinoLogger,
    );
  });

  describe('findAll', () => {
    it('should return all test records', async () => {
      const mockRecords = [mockRecord, { ...mockRecord, id: 2, name: 'Test 2' }];
      const chain = createChainableMock(mockRecords);
      mockDatabase.db.select.mockReturnValue(chain);

      const result = await service.findAll();

      expect(result).toEqual(mockRecords);
      expect(mockDatabase.db.select).toHaveBeenCalled();
      expect(chain.from).toHaveBeenCalled();
      expect(chain.orderBy).toHaveBeenCalled();
      expect(chain.limit).toHaveBeenCalledWith(100);
    });
  });

  describe('findOne', () => {
    it('should return a single record', async () => {
      const chain = createChainableMock([mockRecord]);
      // For findOne, we need to mock the full chain without limit
      chain.where = vi.fn().mockResolvedValue([mockRecord]);
      mockDatabase.db.select.mockReturnValue(chain);

      const result = await service.findOne(1);

      expect(result).toEqual(mockRecord);
    });

    it('should throw NotFoundException when record not found', async () => {
      const chain = createChainableMock([]);
      chain.where = vi.fn().mockResolvedValue([]);
      mockDatabase.db.select.mockReturnValue(chain);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new record', async () => {
      // create() now uses raw SQL via database.query()
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
      mockDatabase.query.mockResolvedValue([mockRecord]);

      await service.create({ name: 'Test' });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_records'),
        ['Test', JSON.stringify({})],
        'create_record',
      );
    });

    it('should throw error when insert returns empty', async () => {
      mockDatabase.query.mockResolvedValue([]);

      await expect(service.create({ name: 'Test' })).rejects.toThrow('Insert did not return a record');
    });
  });

  describe('update', () => {
    it('should update a record with name', async () => {
      const updatedRecord = { ...mockRecord, name: 'Updated' };
      const chain = createChainableMock([updatedRecord]);
      mockDatabase.db.update.mockReturnValue(chain);

      const result = await service.update(1, { name: 'Updated' });

      expect(result).toEqual(updatedRecord);
      expect(mockDatabase.db.update).toHaveBeenCalled();
    });

    it('should update a record with data', async () => {
      const updatedRecord = { ...mockRecord, data: { foo: 'baz' } };
      const chain = createChainableMock([updatedRecord]);
      mockDatabase.db.update.mockReturnValue(chain);

      const result = await service.update(1, { data: { foo: 'baz' } });

      expect(result).toEqual(updatedRecord);
    });

    it('should return existing record when no updates provided', async () => {
      // For empty updates, it calls findOne
      const chain = createChainableMock([mockRecord]);
      chain.where = vi.fn().mockResolvedValue([mockRecord]);
      mockDatabase.db.select.mockReturnValue(chain);

      const result = await service.update(1, {});

      expect(result).toEqual(mockRecord);
      expect(mockDatabase.db.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when record not found', async () => {
      const chain = createChainableMock([]);
      mockDatabase.db.update.mockReturnValue(chain);

      await expect(service.update(999, { name: 'Updated' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a record', async () => {
      const chain = createChainableMock([{ id: 1 }]);
      mockDatabase.db.delete.mockReturnValue(chain);

      const result = await service.remove(1);

      expect(result).toEqual({ deleted: true, id: 1 });
    });

    it('should throw NotFoundException when record not found', async () => {
      const chain = createChainableMock([]);
      mockDatabase.db.delete.mockReturnValue(chain);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeAll', () => {
    it('should delete all records', async () => {
      const chain = createChainableMock([{ id: 1 }, { id: 2 }, { id: 3 }]);
      mockDatabase.db.delete.mockReturnValue(chain);

      const result = await service.removeAll();

      expect(result).toEqual({ deleted: 3 });
    });
  });

  describe('count', () => {
    it('should return record count', async () => {
      // count() uses db.select({ count }).from() - from is the terminal call
      const chain = {
        from: vi.fn().mockResolvedValue([{ count: 42 }]),
      };
      mockDatabase.db.select.mockReturnValue(chain);

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
      // count() uses db.select({ count }).from() - from is the terminal call
      const countChain = {
        from: vi.fn().mockResolvedValue([{ count: 10 }]),
      };
      mockDatabase.db.select.mockReturnValue(countChain);

      // Mock raw SQL query for table size
      mockDatabase.query.mockResolvedValue([{ size: '8 kB' }]);

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
      const countChain = {
        from: vi.fn().mockResolvedValue([{ count: 0 }]),
      };
      mockDatabase.db.select.mockReturnValue(countChain);
      mockDatabase.query.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.tableSize).toBe('unknown');
    });
  });
});
