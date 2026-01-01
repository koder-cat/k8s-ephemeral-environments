import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  HttpException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { RateLimit } from '../cache/rate-limit/rate-limit.decorator';
import {
  FileFiltersDto,
  ExportRequestDto,
  UploadResponse,
  PresignedUrlResponse,
  ExportResponse,
  StorageStats,
  StorageStatus,
  FileMetadataDto,
} from './dto/storage.dto';

interface DisabledResponse {
  enabled: false;
  message: string;
}

/**
 * Storage Controller
 *
 * Provides endpoints for file upload, download, and management.
 * All endpoints gracefully degrade when MinIO is disabled.
 */
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Upload a file
   *
   * Rate limited to 10 requests per minute.
   * Max file size: 5MB
   * Allowed types: JPEG, PNG, GIF, WebP, PDF, TXT, CSV, JSON
   */
  @Post('upload')
  @RateLimit(10, 60) // 10 requests per minute
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponse | DisabledResponse> {
    if (!this.storageService.enabled) {
      return {
        enabled: false,
        message: 'Storage service not configured (MINIO_ENDPOINT not set)',
      };
    }

    if (!file) {
      throw new HttpException(
        { message: 'No file provided' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.storageService.uploadFile(file);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Failed to upload file',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List files with filters
   *
   * @param type - Filter by type: 'image', 'document', or 'all'
   * @param limit - Max files to return (default: 20, max: 100)
   * @param offset - Pagination offset (default: 0)
   */
  @Get('files')
  async listFiles(
    @Query() filters: FileFiltersDto,
  ): Promise<{ files: FileMetadataDto[]; filters: FileFiltersDto } | DisabledResponse> {
    if (!this.storageService.enabled) {
      return {
        enabled: false,
        message: 'Storage service not configured (MINIO_ENDPOINT not set)',
      };
    }

    try {
      const files = await this.storageService.listFiles(filters);
      return { files, filters };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to list files',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get file metadata by ID
   */
  @Get('files/:fileId')
  async getFile(
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<FileMetadataDto | DisabledResponse> {
    if (!this.storageService.enabled) {
      return {
        enabled: false,
        message: 'Storage service not configured (MINIO_ENDPOINT not set)',
      };
    }

    const file = await this.storageService.getFile(fileId);
    if (!file) {
      throw new HttpException(
        { message: `File not found: ${fileId}` },
        HttpStatus.NOT_FOUND,
      );
    }

    return file;
  }

  /**
   * Get presigned download URL
   *
   * @param expiresIn - URL expiry in seconds (default: 3600, max: 86400)
   */
  @Get('files/:fileId/download')
  async getDownloadUrl(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('expiresIn') expiresIn?: string,
  ): Promise<PresignedUrlResponse | DisabledResponse> {
    if (!this.storageService.enabled) {
      return {
        enabled: false,
        message: 'Storage service not configured (MINIO_ENDPOINT not set)',
      };
    }

    try {
      const expiresInSeconds = expiresIn ? parseInt(expiresIn, 10) : 3600;
      return await this.storageService.getPresignedUrl(fileId, expiresInSeconds);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Failed to generate download URL',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a file
   */
  @Delete('files/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(@Param('fileId', ParseUUIDPipe) fileId: string): Promise<void> {
    if (!this.storageService.enabled) {
      return;
    }

    try {
      await this.storageService.deleteFile(fileId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Failed to delete file',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Export database records to file
   *
   * @param format - 'csv' or 'json'
   * @param recordIds - Optional list of specific record IDs to export
   */
  @Post('export/:format')
  async exportRecords(
    @Param('format') format: string,
    @Body() body: ExportRequestDto,
  ): Promise<ExportResponse | DisabledResponse> {
    if (!this.storageService.enabled) {
      return {
        enabled: false,
        message: 'Storage service not configured (MINIO_ENDPOINT not set)',
      };
    }

    if (format !== 'csv' && format !== 'json') {
      throw new HttpException(
        { message: 'Invalid format. Use "csv" or "json"' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.storageService.exportRecords(format, body.recordIds);
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to export records',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get storage statistics
   */
  @Get('stats')
  async getStats(): Promise<StorageStats | DisabledResponse> {
    if (!this.storageService.enabled) {
      return {
        enabled: false,
        message: 'Storage service not configured (MINIO_ENDPOINT not set)',
      };
    }

    try {
      return await this.storageService.getStats();
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to get storage statistics',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get storage service status
   */
  @Get('status')
  async getStatus(): Promise<StorageStatus> {
    return this.storageService.getStatus();
  }
}
