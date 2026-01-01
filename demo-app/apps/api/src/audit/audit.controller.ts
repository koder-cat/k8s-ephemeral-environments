import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { AuditEvent, AuditStats, AuditStatus } from './dto/audit-event.dto';

interface DisabledResponse {
  enabled: false;
  message: string;
}

/**
 * Audit Controller
 *
 * Provides endpoints for querying audit logs and statistics.
 * All endpoints gracefully degrade when MongoDB is disabled.
 */
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Query audit events with filters
   *
   * @example GET /api/audit/events?type=api_request&limit=20
   * @example GET /api/audit/events?from=2024-01-01&to=2024-01-31
   * @example GET /api/audit/events?pathPattern=/api/db-test/*
   */
  @Get('events')
  async queryEvents(
    @Query() filters: QueryAuditDto,
  ): Promise<
    { events: AuditEvent[]; total: number; filters: QueryAuditDto } | DisabledResponse
  > {
    if (!this.auditService.enabled) {
      return {
        enabled: false,
        message: 'Audit service not configured (MONGODB_URL not set)',
      };
    }

    try {
      // Run query and count in parallel for pagination support
      const [events, total] = await Promise.all([
        this.auditService.queryEvents(filters),
        this.auditService.countEvents(filters),
      ]);
      return { events, total, filters };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to query audit events',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get audit statistics
   *
   * Returns event counts by type, date range, and storage usage.
   */
  @Get('stats')
  async getStats(): Promise<AuditStats | DisabledResponse> {
    if (!this.auditService.enabled) {
      return {
        enabled: false,
        message: 'Audit service not configured (MONGODB_URL not set)',
      };
    }

    try {
      return await this.auditService.getStats();
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to get audit statistics',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get audit service status
   *
   * Used for health checks and dashboard status display.
   */
  @Get('status')
  async getStatus(): Promise<AuditStatus> {
    return this.auditService.getStatus();
  }
}
