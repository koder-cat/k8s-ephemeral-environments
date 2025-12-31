import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../metrics/metrics.service';

// Regex patterns for path normalization to prevent high cardinality
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_ID_PATTERN = /\/\d+(?=\/|$)/g;

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Normalize path to prevent high cardinality metrics.
   * Replaces UUIDs and numeric IDs with placeholders.
   */
  private normalizePath(path: string): string {
    return path
      .replace(UUID_PATTERN, ':uuid')
      .replace(NUMERIC_ID_PATTERN, '/:id');
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Skip metrics endpoint itself to avoid recursive metrics
    if (req.path === '/metrics') {
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

        // Record for summary stats (skip metrics endpoints to avoid skewing data)
        if (!req.path.startsWith('/metrics')) {
          this.metricsService.recordRequest(
            req.method,
            route,
            res.statusCode,
            durationMs,
            res.statusMessage,
          );
        }
      } catch {
        // Silently ignore metrics recording errors - they should never break requests
      }
    });

    next();
  }
}
