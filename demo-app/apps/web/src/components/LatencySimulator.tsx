import { useState } from 'react';
import { useGet } from '../hooks/useApi';
import { ResponseDisplay } from './ResponseDisplay';
import type { LatencyResponse } from '../types/simulator';

const MAX_TIMEOUT_MS = 10000;

const PRESETS = [
  { id: 'fast', label: 'Fast', range: '0-100ms' },
  { id: 'normal', label: 'Normal', range: '~500ms' },
  { id: 'slow', label: 'Slow', range: '~2s' },
  { id: 'very-slow', label: 'Very Slow', range: '~5s' },
  { id: 'timeout-risk', label: 'Timeout Risk', range: '~10s' },
];

export function LatencySimulator() {
  const { data, loading, error, get } = useGet<LatencyResponse>();
  const [customMs, setCustomMs] = useState(1000);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const handlePresetClick = async (preset: string) => {
    setActivePreset(preset);
    await get(`/api/simulator/latency/${preset}`);
  };

  const handleCustomTest = async () => {
    setActivePreset('custom');
    await get(`/api/simulator/latency/custom?ms=${customMs}`);
  };

  const getProgressPercent = () => {
    if (!data?.actualDelay) return 0;
    return Math.min((data.actualDelay / MAX_TIMEOUT_MS) * 100, 100);
  };

  return (
    <div className="latency-simulator">
      <div className="preset-buttons">
        {PRESETS.map(({ id, label, range }) => (
          <button
            key={id}
            className={`sim-button preset ${activePreset === id ? 'active' : ''}`}
            onClick={() => handlePresetClick(id)}
            disabled={loading}
          >
            <span className="preset-label">{label}</span>
            <span className="preset-range">{range}</span>
          </button>
        ))}
      </div>

      <div className="custom-latency">
        <label className="custom-label" htmlFor="custom-delay-slider" id="custom-delay-label">Custom Delay</label>
        <div className="slider-container">
          <input
            type="range"
            id="custom-delay-slider"
            min="0"
            max="15000"
            step="100"
            value={customMs}
            onChange={(e) => setCustomMs(parseInt(e.target.value, 10))}
            className="latency-slider"
            disabled={loading}
            aria-labelledby="custom-delay-label"
            aria-valuetext={`${customMs} milliseconds`}
          />
          <span className="slider-value">{customMs}ms</span>
        </div>
        <button
          className="sim-button primary"
          onClick={handleCustomTest}
          disabled={loading}
        >
          {loading ? 'Testing...' : 'Test Custom Delay'}
        </button>
      </div>

      {data && !loading && (
        <div className="latency-result">
          <div className="result-header">
            <span className="result-label">Actual Delay:</span>
            <span className="result-value">{data.actualDelay}ms</span>
          </div>
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuenow={data.actualDelay}
            aria-valuemin={0}
            aria-valuemax={MAX_TIMEOUT_MS}
            aria-label={`Latency: ${data.actualDelay}ms of ${MAX_TIMEOUT_MS / 1000}s timeout`}
          >
            <div
              className="progress-fill"
              style={{ width: `${getProgressPercent()}%` }}
            />
          </div>
          <div className="progress-labels">
            <span>0s</span>
            <span>10s timeout</span>
          </div>
        </div>
      )}

      <ResponseDisplay
        data={null}
        loading={loading}
        error={error}
      />
    </div>
  );
}
