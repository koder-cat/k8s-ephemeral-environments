import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { SimulatorService } from './simulator.service';

describe('SimulatorService', () => {
  let service: SimulatorService;

  beforeEach(() => {
    service = new SimulatorService();
  });

  describe('getStatusResponse', () => {
    it('should return a response with correct code', () => {
      const response = service.getStatusResponse(200);

      expect(response.code).toBe(200);
      expect(response.message).toBe('OK - Request succeeded');
      expect(response.timestamp).toBeDefined();
    });

    it('should return appropriate message for each status code', () => {
      expect(service.getStatusResponse(400).message).toContain('Bad Request');
      expect(service.getStatusResponse(401).message).toContain('Unauthorized');
      expect(service.getStatusResponse(403).message).toContain('Forbidden');
      expect(service.getStatusResponse(404).message).toContain('Not Found');
      expect(service.getStatusResponse(500).message).toContain('Internal Server Error');
      expect(service.getStatusResponse(503).message).toContain('Service Unavailable');
    });

    it('should return generic message for unknown codes', () => {
      const response = service.getStatusResponse(418);

      expect(response.code).toBe(418);
      expect(response.message).toContain('HTTP 418');
    });
  });

  describe('getSupportedStatusCodes', () => {
    it('should return all status code categories', () => {
      const codes = service.getSupportedStatusCodes();

      expect(codes.success).toEqual([200, 201, 204]);
      expect(codes.clientError).toEqual([400, 401, 403, 404, 422, 429]);
      expect(codes.serverError).toEqual([500, 502, 503, 504]);
    });
  });

  describe('simulateLatency', () => {
    it('should simulate fast latency preset (0-100ms)', async () => {
      const startTime = Date.now();
      const result = await service.simulateLatency('fast');
      const elapsed = Date.now() - startTime;

      expect(result.preset).toBe('fast');
      expect(result.requestedDelay).toBeGreaterThanOrEqual(0);
      expect(result.requestedDelay).toBeLessThanOrEqual(100);
      expect(elapsed).toBeLessThan(200); // Allow some tolerance
    });

    it('should simulate custom latency', async () => {
      const startTime = Date.now();
      const result = await service.simulateLatency('custom', 50);
      const elapsed = Date.now() - startTime;

      expect(result.preset).toBe('custom');
      expect(result.requestedDelay).toBe(50);
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    it('should throw error for unknown preset', async () => {
      await expect(service.simulateLatency('unknown')).rejects.toThrow(
        'Unknown latency preset: unknown',
      );
    });
  });

  describe('getLatencyPresets', () => {
    it('should return all presets', () => {
      const presets = service.getLatencyPresets();

      expect(presets.fast).toEqual({ min: 0, max: 100 });
      expect(presets.normal).toEqual({ min: 450, max: 550 });
      expect(presets.slow).toEqual({ min: 1900, max: 2100 });
      expect(presets['very-slow']).toEqual({ min: 4800, max: 5200 });
      expect(presets['timeout-risk']).toEqual({ min: 9500, max: 10500 });
    });
  });

  describe('stressCpu', () => {
    it('should return stress result with before/after metrics', async () => {
      const result = await service.stressCpu(100, 10); // Very short duration

      expect(result.type).toBe('cpu');
      expect(result.duration).toBe(100);
      expect(result.intensity).toBe(10);
      expect(result.before).toHaveProperty('memoryUsedMb');
      expect(result.after).toHaveProperty('memoryUsedMb');
      expect(result.timestamp).toBeDefined();
    });

    it('should cap intensity at 100', async () => {
      const result = await service.stressCpu(100, 150);

      expect(result.intensity).toBe(100);
    });
  });

  describe('stressMemory', () => {
    it('should return stress result with before/after metrics', async () => {
      const result = await service.stressMemory(10, 100); // Small allocation, short duration

      expect(result.type).toBe('memory');
      expect(result.duration).toBe(100);
      expect(result.sizeMb).toBe(10);
      expect(result.before).toHaveProperty('memoryUsedMb');
      expect(result.after).toHaveProperty('memoryUsedMb');
      expect(result.timestamp).toBeDefined();
    });

    it('should cap size at max value', async () => {
      const result = await service.stressMemory(500, 100);

      expect(result.sizeMb).toBe(256); // MAX_MEMORY_SIZE
    });
  });
});
