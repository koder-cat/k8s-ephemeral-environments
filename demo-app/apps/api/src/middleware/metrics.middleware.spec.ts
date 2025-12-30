import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from '../metrics/metrics.service';

describe('MetricsMiddleware', () => {
  let middleware: MetricsMiddleware;
  let mockMetricsService: {
    httpRequestDuration: { observe: ReturnType<typeof vi.fn> };
    httpRequestTotal: { inc: ReturnType<typeof vi.fn> };
  };
  let mockRequest: {
    path: string;
    method: string;
    route?: { path: string };
  };
  let mockResponse: {
    statusCode: number;
    on: ReturnType<typeof vi.fn>;
  };
  let nextFunction: NextFunction;
  let finishCallback: (() => void) | null;

  beforeEach(() => {
    finishCallback = null;
    mockMetricsService = {
      httpRequestDuration: {
        observe: vi.fn(),
      },
      httpRequestTotal: {
        inc: vi.fn(),
      },
    };
    middleware = new MetricsMiddleware(
      mockMetricsService as unknown as MetricsService,
    );
    mockRequest = {
      path: '/api/test',
      method: 'GET',
      route: undefined,
    };
    mockResponse = {
      statusCode: 200,
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
        return mockResponse;
      }),
    };
    nextFunction = vi.fn();
  });

  it('should skip /metrics endpoint', () => {
    mockRequest.path = '/metrics';

    middleware.use(
      mockRequest as unknown as Request,
      mockResponse as unknown as Response,
      nextFunction,
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.on).not.toHaveBeenCalled();
  });

  it('should record request duration on response finish', () => {
    middleware.use(
      mockRequest as unknown as Request,
      mockResponse as unknown as Response,
      nextFunction,
    );

    expect(finishCallback).not.toBeNull();
    finishCallback!();

    expect(mockMetricsService.httpRequestDuration.observe).toHaveBeenCalled();
    const observeArgs = mockMetricsService.httpRequestDuration.observe.mock
      .calls[0] as unknown[];
    expect(observeArgs[0]).toEqual({
      method: 'GET',
      route: '/api/test',
      status_code: '200',
    });
    expect(typeof observeArgs[1]).toBe('number');
    expect(observeArgs[1] as number).toBeGreaterThanOrEqual(0);
  });

  it('should record request count with correct labels', () => {
    mockRequest.method = 'POST';
    mockRequest.path = '/api/users';
    mockResponse.statusCode = 201;

    middleware.use(
      mockRequest as unknown as Request,
      mockResponse as unknown as Response,
      nextFunction,
    );

    finishCallback!();

    expect(mockMetricsService.httpRequestTotal.inc).toHaveBeenCalledWith({
      method: 'POST',
      route: '/api/users',
      status_code: '201',
    });
  });

  it('should use route path when available', () => {
    mockRequest.route = { path: '/api/users/:id' };
    mockRequest.path = '/api/users/123';

    middleware.use(
      mockRequest as unknown as Request,
      mockResponse as unknown as Response,
      nextFunction,
    );

    finishCallback!();

    expect(mockMetricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/api/users/:id' }),
      expect.any(Number),
    );
  });

  it('should normalize UUIDs in path to prevent high cardinality', () => {
    mockRequest.path = '/api/users/a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    middleware.use(
      mockRequest as unknown as Request,
      mockResponse as unknown as Response,
      nextFunction,
    );

    finishCallback!();

    expect(mockMetricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/api/users/:uuid' }),
      expect.any(Number),
    );
  });

  it('should normalize numeric IDs in path to prevent high cardinality', () => {
    mockRequest.path = '/api/users/12345';

    middleware.use(
      mockRequest as unknown as Request,
      mockResponse as unknown as Response,
      nextFunction,
    );

    finishCallback!();

    expect(mockMetricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/api/users/:id' }),
      expect.any(Number),
    );
  });

  it('should normalize multiple numeric IDs in path', () => {
    mockRequest.path = '/api/orders/123/items/456';

    middleware.use(
      mockRequest as unknown as Request,
      mockResponse as unknown as Response,
      nextFunction,
    );

    finishCallback!();

    expect(mockMetricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/api/orders/:id/items/:id' }),
      expect.any(Number),
    );
  });

  it('should call next function', () => {
    middleware.use(
      mockRequest as unknown as Request,
      mockResponse as unknown as Response,
      nextFunction,
    );

    expect(nextFunction).toHaveBeenCalledTimes(1);
  });

  it('should not throw if metrics recording fails', () => {
    mockMetricsService.httpRequestDuration.observe = vi.fn(() => {
      throw new Error('Metrics error');
    });

    middleware.use(
      mockRequest as unknown as Request,
      mockResponse as unknown as Response,
      nextFunction,
    );

    expect(() => finishCallback!()).not.toThrow();
  });
});
