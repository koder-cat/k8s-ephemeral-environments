import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageService } from './storage.service';
import { DatabaseService } from '../database.service';
import { MetricsService } from '../metrics/metrics.service';
import { AuditService } from '../audit/audit.service';
import { PinoLogger } from 'nestjs-pino';
import { BadRequestException } from '@nestjs/common';

// Mock @aws-sdk/client-s3
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  HeadBucketCommand: vi.fn(),
  CreateBucketCommand: vi.fn(),
  ListBucketsCommand: vi.fn(),
}));

// Mock @aws-sdk/s3-request-presigner
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://minio.example.com/file'),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid'),
}));

describe('StorageService', () => {
  let service: StorageService;
  let mockLogger: PinoLogger;
  let mockDatabase: DatabaseService;
  let mockMetrics: MetricsService;
  let mockAudit: AuditService;

  beforeEach(() => {
    vi.stubEnv('MINIO_ENDPOINT', 'localhost');
    vi.stubEnv('MINIO_ACCESS_KEY', 'minioadmin');
    vi.stubEnv('MINIO_SECRET_KEY', 'minioadmin');
    vi.stubEnv('MINIO_BUCKET', 'test-bucket');

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as PinoLogger;

    mockDatabase = {
      db: {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  fileId: 'test-uuid',
                  filename: 'test.txt',
                  originalName: 'test.txt',
                  mimeType: 'text/plain',
                  size: 100,
                  bucket: 'test-bucket',
                  key: 'uploads/test.txt',
                  uploadedAt: new Date(),
                },
              ]),
            }),
            groupBy: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      },
    } as unknown as DatabaseService;

    mockMetrics = {
      storageOperationDuration: {
        startTimer: vi.fn().mockReturnValue(() => {}),
      },
      storageUploadsTotal: {
        inc: vi.fn(),
      },
      storageBytesReceived: {
        inc: vi.fn(),
      },
      storageDownloadsTotal: {
        inc: vi.fn(),
      },
    } as unknown as MetricsService;

    mockAudit = {
      logEvent: vi.fn(),
    } as unknown as AuditService;

    service = new StorageService(mockLogger, mockDatabase, mockMetrics, mockAudit);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('enabled', () => {
    it('should return true when MinIO is configured', () => {
      expect(service.enabled).toBe(true);
    });

    it('should return false when MinIO is not configured', () => {
      vi.stubEnv('MINIO_ENDPOINT', '');
      const newService = new StorageService(mockLogger, mockDatabase, mockMetrics, mockAudit);
      expect(newService.enabled).toBe(false);
    });
  });

  describe('onModuleInit', () => {
    it('should initialize when enabled', async () => {
      await service.onModuleInit();
      expect(mockLogger.info).toHaveBeenCalledWith(
        { bucket: 'test-bucket' },
        'Storage service initialized',
      );
    });

    it('should skip initialization when disabled', async () => {
      vi.stubEnv('MINIO_ENDPOINT', '');
      const newService = new StorageService(mockLogger, mockDatabase, mockMetrics, mockAudit);
      await newService.onModuleInit();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MinIO not configured, storage features disabled',
      );
    });
  });

  describe('getStatus', () => {
    it('should return disabled status when not configured', async () => {
      vi.stubEnv('MINIO_ENDPOINT', '');
      const newService = new StorageService(mockLogger, mockDatabase, mockMetrics, mockAudit);
      const status = await newService.getStatus();
      expect(status).toEqual({ enabled: false, connected: false });
    });

    it('should return connected status when initialized', async () => {
      await service.onModuleInit();
      const status = await service.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.connected).toBe(true);
      expect(status.bucket).toBe('test-bucket');
    });
  });

  describe('uploadFile', () => {
    it('should throw when not available', async () => {
      vi.stubEnv('MINIO_ENDPOINT', '');
      const newService = new StorageService(mockLogger, mockDatabase, mockMetrics, mockAudit);
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 4,
      } as Express.Multer.File;

      await expect(newService.uploadFile(file)).rejects.toThrow(BadRequestException);
    });

    it('should reject files that are too large', async () => {
      await service.onModuleInit();
      const file = {
        buffer: Buffer.alloc(10 * 1024 * 1024), // 10MB
        originalname: 'large.txt',
        mimetype: 'text/plain',
        size: 10 * 1024 * 1024,
      } as Express.Multer.File;

      await expect(service.uploadFile(file)).rejects.toThrow('File too large');
    });

    it('should reject files with invalid mime types', async () => {
      await service.onModuleInit();
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.exe',
        mimetype: 'application/x-msdownload',
        size: 4,
      } as Express.Multer.File;

      await expect(service.uploadFile(file)).rejects.toThrow('File type not allowed');
    });

    it('should upload valid files', async () => {
      await service.onModuleInit();
      const file = {
        buffer: Buffer.from('test content'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 12,
      } as Express.Multer.File;

      const result = await service.uploadFile(file);
      expect(result.fileId).toBe('test-uuid');
      expect(result.originalName).toBe('test.txt');
      expect(mockMetrics.storageUploadsTotal.inc).toHaveBeenCalled();
    });
  });

  describe('getPresignedUrl', () => {
    it('should throw when not available', async () => {
      vi.stubEnv('MINIO_ENDPOINT', '');
      const newService = new StorageService(mockLogger, mockDatabase, mockMetrics, mockAudit);
      await expect(newService.getPresignedUrl('test-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should generate presigned URL for existing file', async () => {
      await service.onModuleInit();
      const result = await service.getPresignedUrl('test-uuid');
      expect(result.fileId).toBe('test-uuid');
      expect(result.downloadUrl).toBe('https://minio.example.com/file');
      expect(mockMetrics.storageDownloadsTotal.inc).toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should throw when not available', async () => {
      vi.stubEnv('MINIO_ENDPOINT', '');
      const newService = new StorageService(mockLogger, mockDatabase, mockMetrics, mockAudit);
      await expect(newService.deleteFile('test-id')).rejects.toThrow(BadRequestException);
    });

    it('should delete existing file', async () => {
      await service.onModuleInit();
      await service.deleteFile('test-uuid');
      expect(mockLogger.info).toHaveBeenCalledWith(
        { fileId: 'test-uuid' },
        'File deleted',
      );
    });
  });

  describe('listFiles', () => {
    it('should return empty array when disabled', async () => {
      vi.stubEnv('MINIO_ENDPOINT', '');
      const newService = new StorageService(mockLogger, mockDatabase, mockMetrics, mockAudit);
      const files = await newService.listFiles({});
      expect(files).toEqual([]);
    });

    it('should list files when connected', async () => {
      await service.onModuleInit();
      const files = await service.listFiles({ limit: 10 });
      expect(Array.isArray(files)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return zero stats when disabled', async () => {
      vi.stubEnv('MINIO_ENDPOINT', '');
      const newService = new StorageService(mockLogger, mockDatabase, mockMetrics, mockAudit);
      const stats = await newService.getStats();
      expect(stats.connected).toBe(false);
      expect(stats.fileCount).toBe(0);
    });
  });
});
