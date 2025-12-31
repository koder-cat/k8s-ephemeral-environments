import { useState, useEffect, useCallback } from 'react';
import type { MetricsSummary as MetricsSummaryType } from '../types/simulator';

export function MetricsSummary() {
  const [summary, setSummary] = useState<MetricsSummaryType | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/metrics/summary');
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch {
      // Silently fail - metrics are optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    // Refresh every 5 seconds
    const interval = setInterval(fetchSummary, 5000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  if (loading || !summary) {
    return (
      <div className="metrics-summary loading">
        <div className="metrics-loading">Loading metrics...</div>
      </div>
    );
  }

  const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="metrics-summary">
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-value">{summary.requests.total.toLocaleString()}</span>
          <span className="metric-label">Total Requests</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{summary.requests.perMinute}</span>
          <span className="metric-label">Req/min</span>
        </div>
        <div className="metric-card">
          <span className={`metric-value ${summary.requests.errorRate > 5 ? 'error' : ''}`}>
            {summary.requests.errorRate}%
          </span>
          <span className="metric-label">Error Rate</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{summary.requests.avgLatencyMs}ms</span>
          <span className="metric-label">Avg Latency</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{summary.system.memoryUsedMb}MB</span>
          <span className="metric-label">Memory Used</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{formatUptime(summary.system.uptimeSeconds)}</span>
          <span className="metric-label">Uptime</span>
        </div>
      </div>

      {summary.recentErrors.length > 0 && (
        <div className="recent-errors">
          <h4 className="errors-title">Recent Errors</h4>
          <div className="errors-list">
            {summary.recentErrors.slice(0, 5).map((error, index) => (
              <div key={index} className="error-item">
                <span className="error-status">{error.status}</span>
                <span className="error-method">{error.method}</span>
                <span className="error-path">{error.path}</span>
                <span className="error-time">
                  {new Date(error.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
