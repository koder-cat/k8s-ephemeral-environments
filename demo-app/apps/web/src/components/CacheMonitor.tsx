import { useState, useEffect, useCallback } from 'react';
import { useApi, useDelete } from '../hooks/useApi';
import type { CacheStats, CacheStatus, CacheFlushResponse } from '../types/simulator';

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function CacheMonitor() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [status, setStatus] = useState<CacheStatus | null>(null);

  const statsApi = useApi<CacheStats>();
  const statusApi = useApi<CacheStatus>();
  const flushApi = useDelete<CacheFlushResponse>();

  const refreshStatus = useCallback(async () => {
    const result = await statusApi.execute('/api/cache/status', { method: 'GET' });
    if (result) {
      setStatus(result);
    }
  }, [statusApi]);

  const refreshStats = useCallback(async () => {
    const result = await statsApi.execute('/api/cache/stats', { method: 'GET' });
    if (result) {
      setStats(result);
    }
  }, [statsApi]);

  useEffect(() => {
    refreshStatus();
    refreshStats();
    // Set up auto-refresh every 5 seconds
    const interval = setInterval(() => {
      refreshStats();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFlush = async () => {
    if (!confirm('Clear all cached data? This action cannot be undone.')) return;
    await flushApi.del('/api/cache/flush');
    await refreshStats();
  };

  const isLoading = statsApi.loading || statusApi.loading;

  // Check if Redis is not connected
  if (status && !status.connected) {
    return (
      <div className="service-disabled">
        <div className="disabled-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>
        <h4>Redis Not Connected</h4>
        <p>Set REDIS_URL to enable caching</p>
      </div>
    );
  }

  return (
    <div className="cache-monitor">
      {/* Stats Bar */}
      {stats && (
        <div className="db-stats-bar">
          <div className="stat-item">
            <span className="stat-value success">{stats.hits.toLocaleString()}</span>
            <span className="stat-label">Hits</span>
          </div>
          <div className="stat-item">
            <span className="stat-value warning">{stats.misses.toLocaleString()}</span>
            <span className="stat-label">Misses</span>
          </div>
          <div className="stat-item">
            <span className="stat-value active">
              {stats.hitRate.toFixed(1)}%
            </span>
            <span className="stat-label">Hit Rate</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{(stats.keys ?? stats.keysCount ?? 0).toLocaleString()}</span>
            <span className="stat-label">Keys</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.memoryUsed ?? formatBytes(stats.memoryUsedBytes ?? 0)}</span>
            <span className="stat-label">Memory</span>
          </div>
          {stats.uptime !== undefined && (
          <div className="stat-item">
            <span className="stat-value">{formatUptime(stats.uptime)}</span>
            <span className="stat-label">Uptime</span>
          </div>
          )}
        </div>
      )}

      <div className="cache-content">
        {/* Hit Rate Visualization */}
        {stats && (
          <div className="hit-rate-section">
            <h4 className="form-title">Cache Performance</h4>
            <div className="hit-rate-bar">
              <div
                className="hit-rate-fill"
                style={{ width: `${stats.hitRate}%` }}
              />
              <span className="hit-rate-label">
                {stats.hitRate.toFixed(1)}% Hit Rate
              </span>
            </div>
            <div className="hit-rate-legend">
              <span className="legend-item hits">
                <span className="legend-dot"></span>
                {stats.hits.toLocaleString()} Hits
              </span>
              <span className="legend-item misses">
                <span className="legend-dot"></span>
                {stats.misses.toLocaleString()} Misses
              </span>
            </div>
          </div>
        )}

        {/* Connection Info */}
        {status && status.connected && (
          <div className="connection-info">
            <h4 className="form-title">Connection</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Host</span>
                <span className="info-value">{status.host || 'localhost'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Port</span>
                <span className="info-value">{status.port || 6379}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status</span>
                <span className="info-value status-connected">Connected</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="cache-actions">
          <button
            className="sim-button"
            onClick={() => { refreshStatus(); refreshStats(); }}
            disabled={isLoading}
          >
            Refresh Stats
          </button>
          <button
            className="sim-button error"
            onClick={handleFlush}
            disabled={flushApi.loading || isLoading}
          >
            {flushApi.loading ? 'Flushing...' : 'Flush Cache'}
          </button>
        </div>

        {flushApi.data && (
          <div className="flush-result">
            Cleared {flushApi.data.keysCleared} keys
          </div>
        )}

        {flushApi.error && (
          <div className="form-error">{flushApi.error}</div>
        )}
      </div>
    </div>
  );
}
