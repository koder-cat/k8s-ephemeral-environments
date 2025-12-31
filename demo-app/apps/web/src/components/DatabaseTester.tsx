import { useState, useEffect, useCallback } from 'react';
import { useApi, usePost, useDelete } from '../hooks/useApi';
import { ResponseDisplay } from './ResponseDisplay';
import type {
  RecordsResponse,
  TestRecord,
  DbStats,
  HeavyQueryResult,
} from '../types/simulator';

const HEAVY_PRESETS = [
  { id: 'light', label: 'Light', desc: '0.5s, 100 rows' },
  { id: 'medium', label: 'Medium', desc: '1s, 1K rows' },
  { id: 'heavy', label: 'Heavy', desc: '3s, 5K rows' },
  { id: 'extreme', label: 'Extreme', desc: '5s, 10K rows' },
];

export function DatabaseTester() {
  const [newRecordName, setNewRecordName] = useState('');
  const [stats, setStats] = useState<DbStats | null>(null);
  const [records, setRecords] = useState<TestRecord[]>([]);

  const recordsApi = useApi<RecordsResponse>();
  const statsApi = useApi<DbStats>();
  const createApi = usePost<TestRecord>();
  const deleteApi = useDelete<{ deleted: boolean; id: number }>();
  const deleteAllApi = useDelete<{ deleted: number }>();
  const heavyQueryApi = usePost<HeavyQueryResult>();

  const refreshRecords = useCallback(async () => {
    const result = await recordsApi.execute('/api/db-test/records', { method: 'GET' });
    if (result) {
      setRecords(result.records);
    }
  }, [recordsApi]);

  const refreshStats = useCallback(async () => {
    const result = await statsApi.execute('/api/db-test/stats', { method: 'GET' });
    if (result) {
      setStats(result);
    }
  }, [statsApi]);

  useEffect(() => {
    refreshRecords();
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!newRecordName.trim()) return;

    await createApi.post('/api/db-test/records', {
      name: newRecordName,
      data: { createdFrom: 'simulator', timestamp: new Date().toISOString() },
    });

    setNewRecordName('');
    await refreshRecords();
    await refreshStats();
  };

  const handleDelete = async (id: number) => {
    await deleteApi.del(`/api/db-test/records/${id}`);
    await refreshRecords();
    await refreshStats();
  };

  const handleDeleteAll = async () => {
    if (!confirm('Delete all test records?')) return;
    await deleteAllApi.del('/api/db-test/records');
    await refreshRecords();
    await refreshStats();
  };

  const handleHeavyQuery = async (preset: string) => {
    await heavyQueryApi.post(`/api/db-test/heavy-query/${preset}`);
  };

  const isLoading =
    recordsApi.loading ||
    createApi.loading ||
    deleteApi.loading ||
    deleteAllApi.loading;

  return (
    <div className="database-tester">
      {/* Pool Stats */}
      {stats && (
        <div className="db-stats-bar">
          <div className="stat-item">
            <span className="stat-value">{stats.poolStats.total}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-item">
            <span className="stat-value active">{stats.poolStats.active}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.poolStats.idle}</span>
            <span className="stat-label">Idle</span>
          </div>
          <div className="stat-item">
            <span className="stat-value warning">{stats.poolStats.waiting}</span>
            <span className="stat-label">Waiting</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.recordCount}</span>
            <span className="stat-label">Records</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.tableSize}</span>
            <span className="stat-label">Size</span>
          </div>
        </div>
      )}

      <div className="db-content">
        {/* Create Form */}
        <div className="create-form">
          <h4 className="form-title">Create Record</h4>
          <div className="form-row">
            <input
              type="text"
              placeholder="Record name..."
              value={newRecordName}
              onChange={(e) => setNewRecordName(e.target.value)}
              className="form-input"
              disabled={isLoading}
            />
            <button
              className="sim-button primary"
              onClick={handleCreate}
              disabled={isLoading || !newRecordName.trim()}
            >
              Create
            </button>
          </div>
          {createApi.error && (
            <div className="form-error">{createApi.error}</div>
          )}
        </div>

        {/* Records List */}
        <div className="records-list">
          <div className="list-header">
            <h4 className="form-title">Records ({records.length})</h4>
            {records.length > 0 && (
              <button
                className="sim-button error small"
                onClick={handleDeleteAll}
                disabled={isLoading}
              >
                Delete All
              </button>
            )}
          </div>

          {recordsApi.loading ? (
            <div className="list-loading">Loading records...</div>
          ) : records.length === 0 ? (
            <div className="list-empty">No records found</div>
          ) : (
            <div className="records-scroll">
              {records.map((record) => (
                <div key={record.id} className="record-item">
                  <div className="record-info">
                    <span className="record-id">#{record.id}</span>
                    <span className="record-name">{record.name}</span>
                  </div>
                  <button
                    className="sim-button error small"
                    onClick={() => handleDelete(record.id)}
                    disabled={isLoading}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Heavy Query Section */}
      <div className="heavy-query-section">
        <h4 className="form-title">Heavy Query Simulation</h4>
        <div className="heavy-buttons">
          {HEAVY_PRESETS.map(({ id, label, desc }) => (
            <button
              key={id}
              className="sim-button preset"
              onClick={() => handleHeavyQuery(id)}
              disabled={heavyQueryApi.loading}
            >
              <span className="preset-label">{label}</span>
              <span className="preset-range">{desc}</span>
            </button>
          ))}
        </div>

        <ResponseDisplay
          data={heavyQueryApi.data}
          loading={heavyQueryApi.loading}
          error={heavyQueryApi.error}
          variant="success"
        />
      </div>
    </div>
  );
}
