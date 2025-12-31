import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException } from '@nestjs/common';
import { SimulatorController } from './simulator.controller';
import { SimulatorService } from './simulator.service';

describe('SimulatorController', () => {
  let controller: SimulatorController;
  let mockService: {
    getStatusResponse: ReturnType<typeof vi.fn>;
    getSupportedStatusCodes: ReturnType<typeof vi.fn>;
    simulateLatency: ReturnType<typeof vi.fn>;
    getLatencyPresets: ReturnType<typeof vi.fn>;
    stressCpu: ReturnType<typeof vi.fn>;
    stressMemory: ReturnType<typeof vi.fn>;
  };
  let mockRequest: { correlationId: string };

  beforeEach(() => {
    mockService = {
      getStatusResponse: vi.fn(),
      getSupportedStatusCodes: vi.fn(),
      simulateLatency: vi.fn(),
      getLatencyPresets: vi.fn(),
      stressCpu: vi.fn(),
      stressMemory: vi.fn(),
    };
    mockRequest = { correlationId: 'test-123' };

    controller = new SimulatorController(mockService as unknown as SimulatorService);
  });

  describe('getStatusCodes', () => {
    it('should return supported status codes', () => {
      mockService.getSupportedStatusCodes.mockReturnValue({
        success: [200, 201, 204],
        clientError: [400, 401, 403, 404, 422, 429],
        serverError: [500, 502, 503, 504],
      });

      const result = controller.getStatusCodes(mockRequest as any);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('clientError');
      expect(result).toHaveProperty('serverError');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('simulateStatus', () => {
    it('should return success response for 2xx codes', () => {
      mockService.getStatusResponse.mockReturnValue({
        code: 200,
        message: 'OK',
        timestamp: new Date().toISOString(),
      });

      const result = controller.simulateStatus('200', mockRequest as any);

      expect(result.code).toBe(200);
      expect(result.correlationId).toBe('test-123');
    });

    it('should throw HttpException for 4xx/5xx codes', () => {
      mockService.getStatusResponse.mockReturnValue({
        code: 500,
        message: 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });

      expect(() => controller.simulateStatus('500', mockRequest as any)).toThrow(
        HttpException,
      );
    });

    it('should throw for invalid status code', () => {
      expect(() => controller.simulateStatus('invalid', mockRequest as any)).toThrow(
        HttpException,
      );
    });

    it('should throw for out of range status code', () => {
      expect(() => controller.simulateStatus('999', mockRequest as any)).toThrow(
        HttpException,
      );
    });
  });

  describe('getLatencyPresets', () => {
    it('should return latency presets', () => {
      mockService.getLatencyPresets.mockReturnValue({
        fast: { min: 0, max: 100 },
        normal: { min: 450, max: 550 },
      });

      const result = controller.getLatencyPresets(mockRequest as any);

      expect(result).toHaveProperty('presets');
      expect(result).toHaveProperty('maxCustomMs');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('simulateLatency', () => {
    it('should return latency result for preset', async () => {
      mockService.simulateLatency.mockResolvedValue({
        preset: 'fast',
        requestedDelay: 50,
        actualDelay: 52,
        timestamp: new Date().toISOString(),
      });

      const result = await controller.simulateLatency('fast', undefined, mockRequest as any);

      expect(result.preset).toBe('fast');
      expect(result.actualDelay).toBeDefined();
    });

    it('should handle custom ms parameter', async () => {
      mockService.simulateLatency.mockResolvedValue({
        preset: 'custom',
        requestedDelay: 500,
        actualDelay: 502,
        timestamp: new Date().toISOString(),
      });

      const result = await controller.simulateLatency('custom', '500', mockRequest as any);

      expect(result.preset).toBe('custom');
    });

    it('should throw HttpException for invalid preset', async () => {
      mockService.simulateLatency.mockRejectedValue(new Error('Unknown preset'));
      mockService.getLatencyPresets.mockReturnValue({});

      await expect(
        controller.simulateLatency('invalid', undefined, mockRequest as any),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('stressCpu', () => {
    it('should return stress result', async () => {
      mockService.stressCpu.mockResolvedValue({
        type: 'cpu',
        duration: 5000,
        intensity: 50,
        before: { memoryUsedMb: 100, cpuUsage: 10 },
        after: { memoryUsedMb: 105, cpuUsage: 90 },
        timestamp: new Date().toISOString(),
      });

      const result = await controller.stressCpu(
        { duration: 5000, intensity: 50 },
        mockRequest as any,
      );

      expect(result.type).toBe('cpu');
      expect(result.intensity).toBe(50);
    });

    it('should use default values', async () => {
      mockService.stressCpu.mockResolvedValue({
        type: 'cpu',
        duration: 5000,
        intensity: 50,
        before: { memoryUsedMb: 100, cpuUsage: 10 },
        after: { memoryUsedMb: 105, cpuUsage: 90 },
        timestamp: new Date().toISOString(),
      });

      await controller.stressCpu({} as any, mockRequest as any);

      expect(mockService.stressCpu).toHaveBeenCalledWith(5000, 50);
    });
  });

  describe('stressMemory', () => {
    it('should return stress result', async () => {
      mockService.stressMemory.mockResolvedValue({
        type: 'memory',
        duration: 5000,
        sizeMb: 100,
        before: { memoryUsedMb: 100, cpuUsage: 10 },
        after: { memoryUsedMb: 200, cpuUsage: 15 },
        timestamp: new Date().toISOString(),
      });

      const result = await controller.stressMemory(
        { sizeMb: 100, duration: 5000 },
        mockRequest as any,
      );

      expect(result.type).toBe('memory');
      expect(result.sizeMb).toBe(100);
    });

    it('should use default values', async () => {
      mockService.stressMemory.mockResolvedValue({
        type: 'memory',
        duration: 5000,
        sizeMb: 50,
        before: { memoryUsedMb: 100, cpuUsage: 10 },
        after: { memoryUsedMb: 150, cpuUsage: 15 },
        timestamp: new Date().toISOString(),
      });

      await controller.stressMemory({} as any, mockRequest as any);

      expect(mockService.stressMemory).toHaveBeenCalledWith(50, 5000);
    });
  });
});
