import { useState } from 'react';
import { usePost } from '../hooks/useApi';
import { ResponseDisplay } from './ResponseDisplay';
import type { StressResult } from '../types/simulator';

export function StressTester() {
  const [cpuDuration, setCpuDuration] = useState(5000);
  const [cpuIntensity, setCpuIntensity] = useState(50);
  const [memorySize, setMemorySize] = useState(50);
  const [memoryDuration, setMemoryDuration] = useState(5000);

  const cpuApi = usePost<StressResult>();
  const memoryApi = usePost<StressResult>();

  const handleCpuStress = async () => {
    await cpuApi.post('/api/simulator/stress/cpu', {
      duration: cpuDuration,
      intensity: cpuIntensity,
    });
  };

  const handleMemoryStress = async () => {
    await memoryApi.post('/api/simulator/stress/memory', {
      sizeMb: memorySize,
      duration: memoryDuration,
    });
  };

  const renderMetricsComparison = (result: StressResult | null) => {
    if (!result) return null;

    return (
      <div className="metrics-comparison">
        <div className="metric-box">
          <span className="metric-title">Before</span>
          <div className="metric-value">
            <span className="metric-label">Memory:</span>
            <span>{result.before.memoryUsedMb} MB</span>
          </div>
        </div>
        <div className="metric-arrow" aria-hidden="true">→</div>
        <div className="metric-box after">
          <span className="metric-title">After</span>
          <div className="metric-value">
            <span className="metric-label">Memory:</span>
            <span>{result.after.memoryUsedMb} MB</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="stress-tester">
      {/* CPU Stress Section */}
      <div className="stress-section">
        <h4 className="section-title">CPU Stress</h4>
        <div className="stress-controls">
          <div className="control-row">
            <label className="control-label" htmlFor="cpu-intensity-slider" id="cpu-intensity-label">Intensity</label>
            <div className="slider-container">
              <input
                type="range"
                id="cpu-intensity-slider"
                min="1"
                max="100"
                value={cpuIntensity}
                onChange={(e) => setCpuIntensity(parseInt(e.target.value, 10))}
                className="stress-slider"
                disabled={cpuApi.loading}
                aria-labelledby="cpu-intensity-label"
                aria-valuetext={`${cpuIntensity} percent`}
              />
              <span className="slider-value">{cpuIntensity}%</span>
            </div>
          </div>
          <div className="control-row">
            <label className="control-label" htmlFor="cpu-duration-slider" id="cpu-duration-label">Duration</label>
            <div className="slider-container">
              <input
                type="range"
                id="cpu-duration-slider"
                min="1000"
                max="30000"
                step="1000"
                value={cpuDuration}
                onChange={(e) => setCpuDuration(parseInt(e.target.value, 10))}
                className="stress-slider"
                disabled={cpuApi.loading}
                aria-labelledby="cpu-duration-label"
                aria-valuetext={`${cpuDuration / 1000} seconds`}
              />
              <span className="slider-value">{cpuDuration / 1000}s</span>
            </div>
          </div>
          <button
            className="sim-button primary"
            onClick={handleCpuStress}
            disabled={cpuApi.loading}
          >
            {cpuApi.loading ? 'Running...' : 'Start CPU Stress'}
          </button>
        </div>

        {renderMetricsComparison(cpuApi.data)}

        <ResponseDisplay
          data={null}
          loading={cpuApi.loading}
          error={cpuApi.error}
        />
      </div>

      {/* Memory Stress Section */}
      <div className="stress-section">
        <h4 className="section-title">Memory Stress</h4>
        <div className="stress-controls">
          <div className="control-row">
            <label className="control-label" htmlFor="memory-size-slider" id="memory-size-label">Size</label>
            <div className="slider-container">
              <input
                type="range"
                id="memory-size-slider"
                min="10"
                max="256"
                step="10"
                value={memorySize}
                onChange={(e) => setMemorySize(parseInt(e.target.value, 10))}
                className="stress-slider"
                disabled={memoryApi.loading}
                aria-labelledby="memory-size-label"
                aria-valuetext={`${memorySize} megabytes`}
              />
              <span className="slider-value">{memorySize} MB</span>
            </div>
          </div>
          <div className="control-row">
            <label className="control-label" htmlFor="memory-duration-slider" id="memory-duration-label">Duration</label>
            <div className="slider-container">
              <input
                type="range"
                id="memory-duration-slider"
                min="1000"
                max="30000"
                step="1000"
                value={memoryDuration}
                onChange={(e) => setMemoryDuration(parseInt(e.target.value, 10))}
                className="stress-slider"
                disabled={memoryApi.loading}
                aria-labelledby="memory-duration-label"
                aria-valuetext={`${memoryDuration / 1000} seconds`}
              />
              <span className="slider-value">{memoryDuration / 1000}s</span>
            </div>
          </div>
          <button
            className="sim-button primary"
            onClick={handleMemoryStress}
            disabled={memoryApi.loading}
          >
            {memoryApi.loading ? 'Running...' : 'Start Memory Stress'}
          </button>
        </div>

        {renderMetricsComparison(memoryApi.data)}

        <ResponseDisplay
          data={null}
          loading={memoryApi.loading}
          error={memoryApi.error}
        />
      </div>
    </div>
  );
}
