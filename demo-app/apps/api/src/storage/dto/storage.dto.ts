import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsArray,
  IsInt,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * File metadata stored in PostgreSQL
 */
export interface FileMetadataDto {
  id: number;
  fileId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  bucket: string;
  key: string;
  uploadedAt: Date;
}

/**
 * Upload response
 */
export interface UploadResponse {
  fileId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  downloadUrl: string;
  expiresAt: string;
}

/**
 * Presigned URL response
 */
export interface PresignedUrlResponse {
  fileId: string;
  downloadUrl: string;
  expiresAt: string;
  expiresInSeconds: number;
}

/**
 * Export response
 */
export interface ExportResponse {
  fileId: string;
  filename: string;
  format: 'csv' | 'json';
  recordCount: number;
  size: number;
  downloadUrl: string;
  expiresAt: string;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  enabled: boolean;
  connected: boolean;
  fileCount: number;
  totalSizeBytes: number;
  byMimeType: Record<string, { count: number; sizeBytes: number }>;
}

/**
 * Storage status
 */
export interface StorageStatus {
  enabled: boolean;
  connected: boolean;
  endpoint?: string;
  bucket?: string;
}

/**
 * Query params for listing files
 */
export class FileFiltersDto {
  @IsOptional()
  @IsEnum(['image', 'document', 'all'])
  type?: 'image' | 'document' | 'all' = 'all';

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(0)
  @Max(10000)
  offset?: number = 0;
}

/**
 * Export request body
 */
export class ExportRequestDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) return value.map(Number).filter((n) => !isNaN(n) && n > 0);
    if (typeof value === 'string')
      return value
        .split(',')
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0);
    return [];
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayMaxSize(1000)
  recordIds?: number[];
}
