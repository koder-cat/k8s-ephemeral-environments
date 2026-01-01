import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import { eq, sql, desc, inArray } from 'drizzle-orm';
import { DatabaseService } from '../database.service';
import { MetricsService } from '../metrics/metrics.service';
import { AuditService } from '../audit/audit.service';
import { fileMetadata, testRecords } from '../db/schema';
import {
  FileMetadataDto,
  UploadResponse,
  PresignedUrlResponse,
  ExportResponse,
  StorageStats,
  StorageStatus,
  FileFiltersDto,
} from './dto/storage.dto';

/**
 * Storage Service - MinIO/S3-compatible file storage
 *
 * Features:
 * - File upload with validation
 * - Presigned download URLs
 * - Metadata stored in PostgreSQL
 * - Export database records to CSV/JSON
 * - Graceful degradation when disabled
 *
 * File validation:
 * - Max size: 5MB
 * - Allowed types: images (JPEG, PNG, GIF, WebP), documents (PDF, TXT, CSV, JSON)
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private s3Client: S3Client | null = null;
  private bucket: string = 'demo-app';
  private isConnected = false;

  // Validation constants
  private readonly MAX_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json',
  ];
  private readonly IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  private readonly DOCUMENT_TYPES = [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json',
  ];

  // Default presigned URL expiry (1 hour)
  private readonly DEFAULT_EXPIRY_SECONDS = 3600;

  constructor(
    @InjectPinoLogger(StorageService.name)
    private readonly logger: PinoLogger,
    private readonly database: DatabaseService,
    private readonly metrics: MetricsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Log a file operation to audit trail (fire-and-forget)
   */
  private logFileOperation(
    operation: string,
    fileId?: string,
    filename?: string,
    size?: number,
    durationMs?: number,
  ): void {
    this.audit.logEvent({
      type: 'file_operation',
      timestamp: new Date(),
      metadata: {
        operation,
        fileId,
        filename,
        size,
        durationMs,
      },
    });
  }

  /**
   * Check if MinIO is configured
   */
  get enabled(): boolean {
    return !!(
      process.env.MINIO_ENDPOINT &&
      process.env.MINIO_ACCESS_KEY &&
      process.env.MINIO_SECRET_KEY
    );
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.info('MinIO not configured, storage features disabled');
      return;
    }

    try {
      this.bucket = process.env.MINIO_BUCKET || 'demo-app';
      const port = process.env.MINIO_PORT || '9000';

      this.s3Client = new S3Client({
        endpoint: `http://${process.env.MINIO_ENDPOINT}:${port}`,
        region: 'us-east-1', // Required but ignored by MinIO
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY!,
          secretAccessKey: process.env.MINIO_SECRET_KEY!,
        },
        forcePathStyle: true, // Required for MinIO
      });

      await this.waitForMinio();
      await this.ensureBucketExists();

      this.isConnected = true;
      this.logger.info({ bucket: this.bucket }, 'Storage service initialized');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize storage service');
      throw error;
    }
  }

  /**
   * Wait for MinIO with short retry logic.
   */
  private async waitForMinio(maxRetries = 3, delayMs = 1000): Promise<void> {
    if (!this.s3Client) return;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.s3Client.send(new ListBucketsCommand({}));
        if (attempt > 1) {
          this.logger.info({ attempt }, 'MinIO connection established');
        }
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          this.logger.warn(
            { attempt, maxRetries, error: lastError.message },
            'MinIO not ready, retrying...',
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw new Error(
      `MinIO not available after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Ensure bucket exists, create if not
   */
  private async ensureBucketExists(): Promise<void> {
    if (!this.s3Client) return;

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.info({ bucket: this.bucket }, 'Bucket exists');
    } catch (error) {
      if ((error as Error).name === 'NotFound') {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.info({ bucket: this.bucket }, 'Bucket created');
      } else {
        throw error;
      }
    }
  }

  /**
   * Validate uploaded file using both size and magic bytes
   */
  private async validateFile(file: Express.Multer.File): Promise<void> {
    // Size check first (fast)
    if (file.size > this.MAX_SIZE) {
      throw new BadRequestException(
        `File too large. Max size: ${this.MAX_SIZE / 1024 / 1024}MB`,
      );
    }

    // Validate actual file content via magic bytes
    const fileType = await fileTypeFromBuffer(file.buffer);
    // Use detected type if available, fallback to client-provided for text files
    const actualMimeType = fileType?.mime || file.mimetype;

    if (!this.ALLOWED_TYPES.includes(actualMimeType)) {
      throw new BadRequestException(
        `File type not allowed: ${actualMimeType}. Allowed: ${this.ALLOWED_TYPES.join(', ')}`,
      );
    }

    // Log warning if client-provided type doesn't match actual type (potential attack)
    if (fileType && file.mimetype !== actualMimeType) {
      this.logger.warn(
        { claimed: file.mimetype, actual: actualMimeType, filename: file.originalname },
        'MIME type mismatch detected - potential file type spoofing',
      );
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(file: Express.Multer.File): Promise<UploadResponse> {
    if (!this.enabled || !this.isConnected || !this.s3Client) {
      throw new BadRequestException('Storage service not available');
    }

    await this.validateFile(file);

    this.logger.info(
      { originalName: file.originalname, size: file.size, mimeType: file.mimetype },
      'File upload started',
    );

    const startTime = Date.now();
    const endTimer = this.metrics.storageOperationDuration.startTimer({
      operation: 'upload',
    });
    let success = true;

    try {
      const fileId = uuidv4();
      const extension = file.originalname.split('.').pop() || '';
      const filename = `${fileId}.${extension}`;
      const key = `uploads/${filename}`;

      // Upload to MinIO
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      this.metrics.storageUploadsTotal.inc();
      this.metrics.storageBytesReceived.inc(file.size);

      // Store metadata in PostgreSQL
      await this.database.db.insert(fileMetadata).values({
        fileId,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        bucket: this.bucket,
        key,
      });

      // Generate initial presigned URL
      const expiresAt = new Date(Date.now() + this.DEFAULT_EXPIRY_SECONDS * 1000);
      const downloadUrl = await this.generatePresignedUrl(key);

      this.logger.info(
        { fileId, filename, size: file.size },
        'File uploaded successfully',
      );

      // Log to audit trail
      this.logFileOperation('UPLOAD', fileId, file.originalname, file.size, Date.now() - startTime);

      return {
        fileId,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        downloadUrl,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      success = false;
      this.logger.error({ error }, 'Failed to upload file');
      throw error;
    } finally {
      endTimer({ success: String(success) });
    }
  }

  /**
   * Generate presigned download URL
   */
  private async generatePresignedUrl(
    key: string,
    expiresIn = this.DEFAULT_EXPIRY_SECONDS,
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Get presigned URL for a file
   */
  async getPresignedUrl(
    fileId: string,
    expiresInSeconds = this.DEFAULT_EXPIRY_SECONDS,
  ): Promise<PresignedUrlResponse> {
    if (!this.enabled || !this.isConnected) {
      throw new BadRequestException('Storage service not available');
    }

    // Limit expiry to max 24 hours
    const expiresIn = Math.min(expiresInSeconds, 86400);

    const endTimer = this.metrics.storageOperationDuration.startTimer({
      operation: 'presign',
    });
    let success = true;

    try {
      const [file] = await this.database.db
        .select()
        .from(fileMetadata)
        .where(eq(fileMetadata.fileId, fileId))
        .limit(1);

      if (!file) {
        throw new BadRequestException(`File not found: ${fileId}`);
      }

      const downloadUrl = await this.generatePresignedUrl(file.key, expiresIn);
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      this.metrics.storageDownloadsTotal.inc();

      return {
        fileId,
        downloadUrl,
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds: expiresIn,
      };
    } catch (error) {
      success = false;
      throw error;
    } finally {
      endTimer({ success: String(success) });
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    if (!this.enabled || !this.isConnected || !this.s3Client) {
      throw new BadRequestException('Storage service not available');
    }

    const startTime = Date.now();
    const endTimer = this.metrics.storageOperationDuration.startTimer({
      operation: 'delete',
    });
    let success = true;

    try {
      const [file] = await this.database.db
        .select()
        .from(fileMetadata)
        .where(eq(fileMetadata.fileId, fileId))
        .limit(1);

      if (!file) {
        throw new BadRequestException(`File not found: ${fileId}`);
      }

      // Delete from MinIO
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: file.key,
        }),
      );

      // Delete metadata from PostgreSQL
      await this.database.db
        .delete(fileMetadata)
        .where(eq(fileMetadata.fileId, fileId));

      this.logger.info({ fileId }, 'File deleted');

      // Log to audit trail
      this.logFileOperation('DELETE', fileId, file.originalName, file.size, Date.now() - startTime);
    } catch (error) {
      success = false;
      throw error;
    } finally {
      endTimer({ success: String(success) });
    }
  }

  /**
   * List files with filters
   */
  async listFiles(filters: FileFiltersDto): Promise<FileMetadataDto[]> {
    if (!this.enabled || !this.isConnected) {
      return [];
    }

    try {
      let query = this.database.db.select().from(fileMetadata);

      // Filter by type
      if (filters.type === 'image') {
        query = query.where(inArray(fileMetadata.mimeType, this.IMAGE_TYPES)) as typeof query;
      } else if (filters.type === 'document') {
        query = query.where(inArray(fileMetadata.mimeType, this.DOCUMENT_TYPES)) as typeof query;
      }

      const files = await query
        .orderBy(desc(fileMetadata.uploadedAt))
        .offset(filters.offset || 0)
        .limit(filters.limit || 20);

      return files;
    } catch (error) {
      this.logger.error({ error }, 'Failed to list files');
      throw error;
    }
  }

  /**
   * Get file metadata by ID
   */
  async getFile(fileId: string): Promise<FileMetadataDto | null> {
    try {
      const [file] = await this.database.db
        .select()
        .from(fileMetadata)
        .where(eq(fileMetadata.fileId, fileId))
        .limit(1);

      return file || null;
    } catch (error) {
      this.logger.error({ error, fileId }, 'Failed to get file');
      throw error;
    }
  }

  /**
   * Export database records to file (CSV or JSON)
   */
  async exportRecords(
    format: 'csv' | 'json',
    recordIds?: number[],
  ): Promise<ExportResponse> {
    if (!this.enabled || !this.isConnected || !this.s3Client) {
      throw new BadRequestException('Storage service not available');
    }

    const startTime = Date.now();
    const endTimer = this.metrics.storageOperationDuration.startTimer({
      operation: 'export',
    });
    let success = true;

    try {
      // Fetch records from testRecords table
      let query = this.database.db.select().from(testRecords);

      if (recordIds && recordIds.length > 0) {
        query = query.where(inArray(testRecords.id, recordIds)) as typeof query;
      }

      const records = await query;

      // Format data
      let content: string;
      let mimeType: string;
      let extension: string;

      if (format === 'json') {
        content = JSON.stringify(records, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      } else {
        // CSV format
        const headers = ['id', 'name', 'data', 'created_at', 'updated_at'];
        const rows = records.map((r) => [
          r.id,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${JSON.stringify(r.data).replace(/"/g, '""')}"`,
          r.createdAt.toISOString(),
          r.updatedAt.toISOString(),
        ]);
        content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
      }

      // Generate file
      const fileId = uuidv4();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `export-${timestamp}.${extension}`;
      const key = `exports/${filename}`;

      // Upload to MinIO
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: Buffer.from(content),
          ContentType: mimeType,
        }),
      );

      // Store metadata
      const size = Buffer.byteLength(content);
      await this.database.db.insert(fileMetadata).values({
        fileId,
        filename,
        originalName: filename,
        mimeType,
        size,
        bucket: this.bucket,
        key,
      });

      // Generate presigned URL
      const downloadUrl = await this.generatePresignedUrl(key);
      const expiresAt = new Date(Date.now() + this.DEFAULT_EXPIRY_SECONDS * 1000);

      // Log to audit trail
      this.logFileOperation('EXPORT', fileId, filename, size, Date.now() - startTime);

      return {
        fileId,
        filename,
        format,
        recordCount: records.length,
        size,
        downloadUrl,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      success = false;
      this.logger.error({ error, format }, 'Failed to export records');
      throw error;
    } finally {
      endTimer({ success: String(success) });
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    if (!this.enabled || !this.isConnected) {
      return {
        enabled: this.enabled,
        connected: false,
        fileCount: 0,
        totalSizeBytes: 0,
        byMimeType: {},
      };
    }

    try {
      // Get file count and total size
      const [countResult] = await this.database.db
        .select({
          count: sql<number>`count(*)::int`,
          totalSize: sql<number>`coalesce(sum(size), 0)::bigint`,
        })
        .from(fileMetadata);

      // Get breakdown by mime type
      const byTypeResult = await this.database.db
        .select({
          mimeType: fileMetadata.mimeType,
          count: sql<number>`count(*)::int`,
          totalSize: sql<number>`coalesce(sum(size), 0)::bigint`,
        })
        .from(fileMetadata)
        .groupBy(fileMetadata.mimeType);

      const byMimeType: Record<string, { count: number; sizeBytes: number }> = {};
      byTypeResult.forEach((row) => {
        byMimeType[row.mimeType] = {
          count: row.count,
          sizeBytes: Number(row.totalSize),
        };
      });

      return {
        enabled: true,
        connected: this.isConnected,
        fileCount: countResult?.count || 0,
        totalSizeBytes: Number(countResult?.totalSize) || 0,
        byMimeType,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get storage stats');
      throw error;
    }
  }

  /**
   * Get service status for health checks
   */
  async getStatus(): Promise<StorageStatus> {
    if (!this.enabled) {
      return { enabled: false, connected: false };
    }

    return {
      enabled: true,
      connected: this.isConnected,
      endpoint: process.env.MINIO_ENDPOINT,
      bucket: this.bucket,
    };
  }
}
