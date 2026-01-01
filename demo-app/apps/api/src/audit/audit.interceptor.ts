import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { AuditService } from './audit.service';
import { AuditEvent } from './dto/audit-event.dto';

/**
 * Audit Interceptor
 *
 * Automatically logs all API requests to MongoDB.
 * Uses fire-and-forget pattern to never block requests.
 *
 * Skips logging for:
 * - /metrics endpoint (too noisy)
 * - /api/health endpoint (health checks)
 * - /api/audit/* endpoints (prevent recursion)
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly skipPaths = ['/metrics', '/api/health', '/api/audit'];

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.auditService.enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    // Skip logging for certain paths
    if (this.skipPaths.some((skip) => path.startsWith(skip))) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logRequest(request, context, startTime, 'success'),
        error: (error) =>
          this.logRequest(request, context, startTime, 'error', error),
      }),
    );
  }

  private logRequest(
    request: Request,
    context: ExecutionContext,
    startTime: number,
    result: 'success' | 'error',
    error?: Error,
  ): void {
    const response = context.switchToHttp().getResponse<Response>();
    const durationMs = Date.now() - startTime;

    const event: AuditEvent = {
      type: 'api_request',
      timestamp: new Date(),
      correlationId: request.correlationId || 'unknown',
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs,
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.headers['x-forwarded-for']?.toString(),
      metadata:
        result === 'error'
          ? { error: error?.message, stack: error?.stack?.split('\n')[0] }
          : undefined,
    };

    // Fire-and-forget - don't await
    this.auditService.logEvent(event).catch(() => {
      // Silently fail - audit should never break requests
    });
  }
}
