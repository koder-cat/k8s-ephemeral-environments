/**
 * Audit Event DTOs
 *
 * Defines the structure of audit events stored in MongoDB.
 * Events are automatically logged via AuditInterceptor and cleaned up via TTL index.
 */

export type AuditEventType =
  | 'api_request'
  | 'db_operation'
  | 'file_operation'
  | 'cache_operation';

export interface AuditEvent {
  _id?: string;
  type: AuditEventType;
  timestamp: Date;
  correlationId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  userAgent?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditStats {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  oldestEvent?: Date;
  newestEvent?: Date;
  storageBytes?: number;
}

export interface AuditStatus {
  enabled: boolean;
  connected: boolean;
  database?: string;
  collection?: string;
  ttlDays?: number;
}
