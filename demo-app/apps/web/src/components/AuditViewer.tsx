import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import type { AuditEventsResponse, AuditStats, AuditEvent } from '../types/simulator';

const EVENT_TYPES = ['all', 'api_request', 'db_operation', 'file_operation', 'cache_operation'] as const;

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusClass(code: number | undefined): string {
  if (!code) return '';
  if (code >= 200 && code < 300) return 'status-success';
  if (code >= 400 && code < 500) return 'status-warning';
  if (code >= 500) return 'status-error';
  return '';
}

function getMethodClass(method: string | undefined): string {
  if (!method) return '';
  switch (method.toUpperCase()) {
    case 'GET': return 'method-get';
    case 'POST': return 'method-post';
    case 'PUT': return 'method-put';
    case 'DELETE': return 'method-delete';
    default: return '';
  }
}

export function AuditViewer() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const eventsApi = useApi<AuditEventsResponse>();
  const statsApi = useApi<AuditStats>();

  const refreshStats = useCallback(async () => {
    const result = await statsApi.execute('/api/audit/stats', { method: 'GET' });
    if (result) {
      setStats(result);
    }
  }, [statsApi]);

  const refreshEvents = useCallback(async () => {
    const typeParam = selectedType !== 'all' ? `&type=${selectedType}` : '';
    const offset = (page - 1) * 20;
    const result = await eventsApi.execute(
      `/api/audit/events?limit=20&offset=${offset}${typeParam}`,
      { method: 'GET' }
    );
    if (result) {
      setEvents(result.events);
      setTotal(result.total);
    }
  }, [eventsApi, page, selectedType]);

  useEffect(() => {
    refreshStats();
    refreshEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedType]);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setPage(1);
  };

  const totalPages = Math.ceil(total / 20);
  const isLoading = eventsApi.loading || statsApi.loading;

  // Check if MongoDB is not connected
  if (statsApi.error?.includes('not configured') || statsApi.error?.includes('not connected')) {
    return (
      <div className="service-disabled">
        <div className="disabled-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>
        <h4>MongoDB Not Connected</h4>
        <p>Set MONGODB_URL to enable audit logging</p>
      </div>
    );
  }

  return (
    <div className="audit-viewer">
      {/* Stats Bar */}
      {stats && (
        <div className="db-stats-bar">
          <div className="stat-item">
            <span className="stat-value">{stats.totalEvents.toLocaleString()}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-item">
            <span className="stat-value active">{(stats.eventsLast24h ?? stats.totalEvents).toLocaleString()}</span>
            <span className="stat-label">Last 24h</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{formatBytes(stats.storageBytes ?? 0)}</span>
            <span className="stat-label">Storage</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.eventsByType['api_request'] || 0}</span>
            <span className="stat-label">API</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.eventsByType['db_operation'] || 0}</span>
            <span className="stat-label">DB</span>
          </div>
        </div>
      )}

      <div className="audit-content">
        {/* Filter Tabs */}
        <div className="filter-tabs">
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              className={`filter-tab ${selectedType === type ? 'active' : ''}`}
              onClick={() => handleTypeChange(type)}
            >
              {type === 'all' ? 'All Events' : type.replace('_', ' ')}
            </button>
          ))}
          <button
            className="sim-button small"
            onClick={() => { refreshStats(); refreshEvents(); }}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>

        {/* Events List */}
        <div className="records-list">
          <div className="list-header">
            <h4 className="form-title">
              Events ({total.toLocaleString()})
            </h4>
          </div>

          {eventsApi.loading ? (
            <div className="list-loading">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="list-empty">No audit events found</div>
          ) : (
            <div className="records-scroll audit-scroll">
              {events.map((event) => (
                <div key={event._id} className="audit-item">
                  <div className="audit-row">
                    <span className={`audit-method ${getMethodClass(event.method)}`}>
                      {event.method || event.type.split('_')[0].toUpperCase()}
                    </span>
                    <span className="audit-path">{event.path || event.type}</span>
                    <span className={`audit-status ${getStatusClass(event.statusCode)}`}>
                      {event.statusCode || '-'}
                    </span>
                    <span className="audit-duration">{formatDuration(event.durationMs)}</span>
                    <span className="audit-time">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="sim-button small"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
            >
              Previous
            </button>
            <span className="page-info">
              Page {page} of {totalPages}
            </span>
            <button
              className="sim-button small"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
