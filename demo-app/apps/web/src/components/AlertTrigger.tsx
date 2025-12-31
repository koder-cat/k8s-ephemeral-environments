import { useState, useEffect, useCallback, useRef } from 'react';
import type { AlertType, AlertDemoStatus, AlertTypesResponse } from '../types/simulator';

const ALERT_LABELS: Record<AlertType, { name: string; icon: string; color: string }> = {
  'high-error-rate': {
    name: 'High Error Rate',
    icon: '5xx',
    color: 'red',
  },
  'high-latency': {
    name: 'High Latency',
    icon: 'P99',
    color: 'amber',
  },
  'slow-database': {
    name: 'Slow Database',
    icon: 'DB',
    color: 'purple',
  },
};

// Number of consecutive failures before showing error
const MAX_POLL_FAILURES = 3;

export function AlertTrigger() {
  const [alertTypes, setAlertTypes] = useState<AlertTypesResponse['alertTypes'] | null>(null);
  const [status, setStatus] = useState<AlertDemoStatus | null>(null);
  const [loading, setLoading] = useState<AlertType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const pollFailuresRef = useRef(0);

  // Fetch alert types on mount
  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/simulator/alert-demo', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: AlertTypesResponse) => setAlertTypes(data.alertTypes))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Failed to load alert types');
        }
      })
      .finally(() => setInitialLoading(false));

    return () => controller.abort();
  }, []);

  // Poll status when running
  useEffect(() => {
    if (!status?.running) return;

    pollFailuresRef.current = 0;

    const interval = setInterval(() => {
      fetch('/api/simulator/alert-demo/status')
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data: AlertDemoStatus) => {
          pollFailuresRef.current = 0;
          setStatus(data);
          if (!data.running) {
            setLoading(null);
          }
        })
        .catch(() => {
          pollFailuresRef.current++;
          if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
            setError('Lost connection to server');
          }
        });
    }, 1000);

    return () => clearInterval(interval);
  }, [status?.running]);

  const startDemo = useCallback(async (alertType: AlertType) => {
    setLoading(alertType);
    setError(null);

    try {
      const response = await fetch(`/api/simulator/alert-demo/${alertType}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start demo');
      }

      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start demo');
      setLoading(null);
    }
  }, []);

  const stopDemo = useCallback(async () => {
    try {
      const response = await fetch('/api/simulator/alert-demo', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setStatus(data);
      setLoading(null);
    } catch {
      setError('Failed to stop demo');
    }
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get current alert type labels safely
  const getCurrentAlertLabel = () => {
    if (!status?.alertType) return null;
    return ALERT_LABELS[status.alertType];
  };

  const currentLabel = getCurrentAlertLabel();

  return (
    <div className="alert-trigger" role="region" aria-label="Alert Trigger">
      <div className="alert-trigger-header">
        <p className="alert-trigger-description">
          Trigger sustained load to fire Prometheus alerts. Each demo runs for ~5.5 minutes.
        </p>
        {status?.running && (
          <a
            href="/grafana/alerting/list"
            target="_blank"
            rel="noopener noreferrer"
            className="grafana-link"
            aria-label="View Alerts in Grafana (opens in new tab)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            View Alerts in Grafana
          </a>
        )}
      </div>

      {error && (
        <div className="alert-error" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {status?.running && currentLabel && (
        <div className="alert-progress-card" aria-live="polite">
          <div className="progress-header">
            <div className="progress-info">
              <span className={`alert-badge ${currentLabel.color}`} aria-hidden="true">
                {currentLabel.icon}
              </span>
              <span className="progress-title">
                {currentLabel.name}
              </span>
            </div>
            <button
              className="stop-button"
              onClick={stopDemo}
              aria-label="Stop alert demo"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </button>
          </div>

          <div className="progress-bar-container" role="progressbar" aria-valuenow={status.progress} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`progress-bar ${currentLabel.color}`}
              style={{ width: `${status.progress}%` }}
            />
          </div>

          <div className="progress-stats">
            <div className="stat">
              <span className="stat-value">{formatTime(status.remainingSeconds)}</span>
              <span className="stat-label">Remaining</span>
            </div>
            <div className="stat">
              <span className="stat-value">{status.progress}%</span>
              <span className="stat-label">Progress</span>
            </div>
            <div className="stat">
              <span className="stat-value">{status.requestsSent}</span>
              <span className="stat-label">Requests</span>
            </div>
          </div>

          <p className="progress-hint">
            Alert should fire in Grafana when progress reaches ~90%
          </p>
        </div>
      )}

      {initialLoading && (
        <div className="alert-loading" role="status" aria-label="Loading alert options">
          <div className="loading-spinner small" />
          <span>Loading alert options...</span>
        </div>
      )}

      {!status?.running && !initialLoading && alertTypes && (
        <div className="alert-buttons" role="group" aria-label="Alert demo options">
          {(Object.entries(alertTypes) as [AlertType, { description: string; durationMinutes: number }][]).map(
            ([type, info]) => (
              <button
                key={type}
                className={`alert-button ${ALERT_LABELS[type].color}`}
                onClick={() => startDemo(type)}
                disabled={loading !== null}
                aria-busy={loading === type}
                aria-label={`Start ${ALERT_LABELS[type].name} demo: ${info.description}`}
              >
                <span className={`alert-icon ${ALERT_LABELS[type].color}`} aria-hidden="true">
                  {ALERT_LABELS[type].icon}
                </span>
                <div className="alert-button-content">
                  <span className="alert-button-title">{ALERT_LABELS[type].name}</span>
                  <span className="alert-button-desc">{info.description}</span>
                </div>
                {loading === type && (
                  <div className="button-spinner" role="status" aria-label="Starting demo..." />
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
