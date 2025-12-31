import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../metrics/metrics.service';

// Regex patterns for path normalization to prevent high cardinality
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_ID_PATTERN = /\/\d+(?=\/|$)/g;
// Specific patterns for simulator routes to ensure consistent labels
const STATUS_CODE_PATTERN = /\/status\/\d+(?=\/|$)/;
const LATENCY_PRESET_PATTERN = /\/latency\/[\w-]+(?=\/|$)/;
const HEAVY_QUERY_PATTERN = /\/heavy-query\/[\w-]+(?=\/|$)/;
// Static assets pattern (webpack hashed filenames)
const STATIC_ASSET_PATTERN = /^\/assets\//;

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Normalize path to prevent high cardinality metrics.
   * Replaces UUIDs, numeric IDs, and route parameters with placeholders.
   */
  private normalizePath(path: string): string {
    return path
      .replace(UUID_PATTERN, ':uuid')
      .replace(STATUS_CODE_PATTERN, '/status/:code')
      .replace(LATENCY_PRESET_PATTERN, '/latency/:preset')
      .replace(HEAVY_QUERY_PATTERN, '/heavy-query/:intensity')
      .replace(NUMERIC_ID_PATTERN, '/:id');
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Skip metrics endpoint itself to avoid recursive metrics
    // Skip static assets to prevent high cardinality from hashed filenames
    if (req.path === '/metrics' || STATIC_ASSET_PATTERN.test(req.path)) {
      return next();
    }

    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      try {
        const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
        const durationMs = duration * 1000;
        // Use route pattern if available, otherwise normalize the path
        const route = req.route?.path || this.normalizePath(req.path.split('?')[0]);
        const labels = {
          method: req.method,
          route,
          status_code: res.statusCode.toString(),
        };

        this.metricsService.httpRequestDuration.observe(labels, duration);
        this.metricsService.httpRequestTotal.inc(labels);

        // Record for summary stats
        // Note: /metrics endpoint already returns early at line 35, so no duplicate check needed
        this.metricsService.recordRequest(
          req.method,
          route,
          res.statusCode,
          durationMs,
          res.statusMessage,
        );
      } catch (error) {
        // Log metrics recording errors but don't break requests
        // Using console.error to avoid circular dependency with logger
        console.error('[MetricsMiddleware] Error recording metrics:', error);
      }
    });

    next();
  }
}
