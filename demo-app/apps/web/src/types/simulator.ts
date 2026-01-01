// HTTP Status Simulator types
export interface StatusResponse {
  code: number;
  message: string;
  timestamp: string;
  correlationId?: string;
}

export interface StatusCodesResponse {
  success: number[];
  clientError: number[];
  serverError: number[];
  timestamp: string;
}

// Latency Simulator types
export interface LatencyResponse {
  preset: string;
  requestedDelay: number;
  actualDelay: number;
  timestamp: string;
}

export interface LatencyPresetsResponse {
  presets: Record<string, { min: number; max: number }>;
  maxCustomMs: number;
  timestamp: string;
}

// Stress Test types
export interface StressResult {
  type: 'cpu' | 'memory';
  duration: number;
  intensity?: number;
  sizeMb?: number;
  before: {
    memoryUsedMb: number;
    cpuUsage: number;
  };
  after: {
    memoryUsedMb: number;
    cpuUsage: number;
  };
  timestamp: string;
}

// Database Test types
export interface TestRecord {
  id: number;
  name: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RecordsResponse {
  records: TestRecord[];
  count: number;
  timestamp: string;
}

export interface HeavyQueryResult {
  preset: string;
  rowCount: number;
  durationMs: number;
  timestamp: string;
}

export interface HeavyQueryPresetsResponse {
  presets: Record<string, { sleepSeconds: number; rows: number }>;
  timestamp: string;
}

export interface DbStats {
  poolStats: {
    total: number;
    idle: number;
    active: number;
    waiting: number;
  };
  recordCount: number;
  tableSize: string;
}

// Metrics Summary types
export interface RecentError {
  timestamp: string;
  status: number;
  method: string;
  path: string;
  message?: string;
}

export interface MetricsSummary {
  requests: {
    total: number;
    perMinute: number;
    errorRate: number;
    avgLatencyMs: number;
  };
  system: {
    uptimeSeconds: number;
    memoryUsedMb: number;
    memoryTotalMb: number;
  };
  recentErrors: RecentError[];
  timestamp: string;
}

// Alert Demo types
export type AlertType = 'high-error-rate' | 'high-latency' | 'slow-database';

export interface AlertTypeInfo {
  description: string;
  durationMinutes: number;
}

export interface AlertTypesResponse {
  alertTypes: Record<AlertType, AlertTypeInfo>;
  timestamp: string;
}

export interface AlertDemoStatus {
  running: boolean;
  alertType: AlertType | null;
  startedAt: string | null;
  endsAt: string | null;
  remainingSeconds: number;
  requestsSent: number;
  progress: number;
  message?: string;
  timestamp: string;
}

// Audit types
export interface AuditEvent {
  _id: string;
  type: 'api_request' | 'db_operation' | 'file_operation' | 'cache_operation';
  timestamp: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  userAgent?: string;
  ip?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEventsResponse {
  events: AuditEvent[];
  total: number;
  filters?: Record<string, unknown>;
}

export interface AuditStats {
  totalEvents: number;
  eventsLast24h?: number;
  eventsByType: Record<string, number>;
  storageBytes?: number;
  oldestEvent?: string | null;
  newestEvent?: string | null;
  timestamp?: string;
}

// Cache types
export interface CacheStats {
  enabled?: boolean;
  connected?: boolean;
  hits: number;
  misses: number;
  hitRate: number;
  keys?: number;
  keysCount?: number;
  memoryUsed?: string;
  memoryUsedBytes?: number;
  uptime?: number;
  timestamp?: string;
}

export interface CacheStatus {
  enabled: boolean;
  connected: boolean;
  host?: string;
  port?: number;
  timestamp: string;
}

export interface CacheFlushResponse {
  flushed: boolean;
  keysCleared: number;
  timestamp: string;
}

// Storage types
export interface FileMetadata {
  fileId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  bucket: string;
  uploadedAt: string;
}

export interface FilesResponse {
  files: FileMetadata[];
  total: number;
  page: number;
  limit: number;
  timestamp: string;
}

export interface UploadResponse {
  fileId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  timestamp: string;
}

export interface DownloadUrlResponse {
  fileId: string;
  downloadUrl: string;
  expiresIn: number;
  timestamp: string;
}

export interface StorageStatus {
  enabled: boolean;
  connected: boolean;
  endpoint?: string;
  bucket?: string;
  timestamp: string;
}

// API Response wrapper
export interface ApiError {
  message: string;
  error?: string;
  code?: number;
}
