import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi, useDelete } from '../hooks/useApi';
import type {
  FilesResponse,
  FileMetadata,
  DownloadUrlResponse,
  StorageStatus,
} from '../types/simulator';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
];

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType === 'text/csv') return '📊';
  if (mimeType === 'application/json') return '📋';
  if (mimeType === 'text/plain') return '📝';
  return '📁';
}

export function FileManager() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [total, setTotal] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filesApi = useApi<FilesResponse>();
  const statusApi = useApi<StorageStatus>();
  const downloadApi = useApi<DownloadUrlResponse>();
  const deleteApi = useDelete<{ deleted: boolean }>();

  const refreshStatus = useCallback(async () => {
    const result = await statusApi.execute('/api/storage/status', { method: 'GET' });
    if (result) {
      setStatus(result);
    }
  }, [statusApi]);

  const refreshFiles = useCallback(async () => {
    const result = await filesApi.execute('/api/storage/files', { method: 'GET' });
    if (result) {
      setFiles(result.files);
      setTotal(result.total);
    }
  }, [filesApi]);

  useEffect(() => {
    refreshStatus();
    refreshFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type "${file.type}" not allowed. Allowed: images, PDF, TXT, CSV, JSON`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File too large (${formatFileSize(file.size)}). Maximum size is ${MAX_SIZE_MB}MB`;
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Upload failed: ${response.status}`);
      }

      await refreshFiles();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDownload = async (fileId: string) => {
    const result = await downloadApi.execute(`/api/storage/files/${fileId}/download`, {
      method: 'GET',
    });
    if (result?.downloadUrl) {
      window.open(result.downloadUrl, '_blank');
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Delete this file? This action cannot be undone.')) return;
    await deleteApi.del(`/api/storage/files/${fileId}`);
    await refreshFiles();
  };

  const isLoading = filesApi.loading || statusApi.loading;

  // Check if MinIO is not connected
  if (status && !status.connected) {
    return (
      <div className="service-disabled">
        <div className="disabled-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>
        <h4>MinIO Not Connected</h4>
        <p>Set MINIO_ENDPOINT to enable file storage</p>
      </div>
    );
  }

  return (
    <div className="file-manager">
      {/* Upload Zone */}
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div className="upload-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="upload-text">
          {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
        </p>
        <p className="upload-hint">
          Images, PDF, TXT, CSV, JSON • Max {MAX_SIZE_MB}MB
        </p>
      </div>

      {uploadError && <div className="form-error">{uploadError}</div>}

      {/* Files List */}
      <div className="records-list">
        <div className="list-header">
          <h4 className="form-title">Files ({total})</h4>
          <button
            className="sim-button small"
            onClick={refreshFiles}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>

        {filesApi.loading ? (
          <div className="list-loading">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="list-empty">No files uploaded</div>
        ) : (
          <div className="records-scroll files-scroll">
            {files.map((file) => (
              <div key={file.fileId} className="file-item">
                <div className="file-info">
                  <span className="file-icon">{getFileIcon(file.mimeType)}</span>
                  <div className="file-details">
                    <span className="file-name" title={file.originalName}>
                      {file.originalName}
                    </span>
                    <span className="file-meta">
                      {formatFileSize(file.size)} • {file.mimeType.split('/')[1]}
                    </span>
                  </div>
                </div>
                <div className="file-actions">
                  <button
                    className="sim-button small primary"
                    onClick={() => handleDownload(file.fileId)}
                    disabled={downloadApi.loading}
                    title="Download"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                  <button
                    className="sim-button small error"
                    onClick={() => handleDelete(file.fileId)}
                    disabled={deleteApi.loading}
                    title="Delete"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connection Info */}
      {status && status.connected && (
        <div className="connection-info">
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Endpoint</span>
              <span className="info-value">{status.endpoint || 'localhost:9000'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Bucket</span>
              <span className="info-value">{status.bucket || 'demo-app'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
