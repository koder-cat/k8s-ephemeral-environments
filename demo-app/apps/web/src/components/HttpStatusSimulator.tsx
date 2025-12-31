import { useState } from 'react';
import { useGet } from '../hooks/useApi';
import { ResponseDisplay } from './ResponseDisplay';
import type { StatusResponse } from '../types/simulator';

const STATUS_CODES = {
  success: [
    { code: 200, label: 'OK' },
    { code: 201, label: 'Created' },
    { code: 204, label: 'No Content' },
  ],
  clientError: [
    { code: 400, label: 'Bad Request' },
    { code: 401, label: 'Unauthorized' },
    { code: 403, label: 'Forbidden' },
    { code: 404, label: 'Not Found' },
    { code: 422, label: 'Unprocessable' },
    { code: 429, label: 'Too Many' },
  ],
  serverError: [
    { code: 500, label: 'Internal Error' },
    { code: 502, label: 'Bad Gateway' },
    { code: 503, label: 'Unavailable' },
    { code: 504, label: 'Timeout' },
  ],
};

export function HttpStatusSimulator() {
  const { data, loading, error, status, get } = useGet<StatusResponse>();
  const [lastCode, setLastCode] = useState<number | null>(null);

  const handleStatusClick = async (code: number) => {
    setLastCode(code);
    await get(`/api/simulator/status/${code}`);
  };

  const getVariant = (): 'default' | 'success' | 'error' => {
    if (!lastCode) return 'default';
    if (lastCode >= 200 && lastCode < 300) return 'success';
    return 'error';
  };

  // Network error occurred (timeout, connection failed, etc.)
  // This is different from intentional HTTP error status codes
  const isNetworkError = error && status === null;

  return (
    <div className="http-status-simulator">
      <div className="status-group">
        <h4 className="group-label success">Success (2xx)</h4>
        <div className="button-grid">
          {STATUS_CODES.success.map(({ code, label }) => (
            <button
              key={code}
              className="sim-button success"
              onClick={() => handleStatusClick(code)}
              disabled={loading}
            >
              <span className="button-code">{code}</span>
              <span className="button-label">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="status-group">
        <h4 className="group-label warning">Client Error (4xx)</h4>
        <div className="button-grid">
          {STATUS_CODES.clientError.map(({ code, label }) => (
            <button
              key={code}
              className="sim-button warning"
              onClick={() => handleStatusClick(code)}
              disabled={loading}
            >
              <span className="button-code">{code}</span>
              <span className="button-label">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="status-group">
        <h4 className="group-label error">Server Error (5xx)</h4>
        <div className="button-grid">
          {STATUS_CODES.serverError.map(({ code, label }) => (
            <button
              key={code}
              className="sim-button error"
              onClick={() => handleStatusClick(code)}
              disabled={loading}
            >
              <span className="button-code">{code}</span>
              <span className="button-label">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <ResponseDisplay
        data={data}
        loading={loading}
        error={isNetworkError ? error : null}
        variant={getVariant()}
      />
    </div>
  );
}
