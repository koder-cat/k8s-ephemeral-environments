/**
 * Cache Statistics DTOs
 */

export interface CacheStats {
  enabled: boolean;
  connected: boolean;
  hits: number;
  misses: number;
  hitRate: number;
  keysCount: number;
  memoryUsedBytes?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
}

export interface CacheStatus {
  enabled: boolean;
  connected: boolean;
  host?: string;
  port?: number;
  memoryUsed?: string;
  connectedClients?: number;
}
