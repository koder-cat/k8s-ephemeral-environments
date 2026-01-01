import { Global, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

/**
 * Storage Module - MinIO/S3-compatible file storage
 *
 * Features:
 * - File upload with validation (5MB max, type whitelist)
 * - Presigned download URLs
 * - Metadata stored in PostgreSQL
 * - Export database records to CSV/JSON
 * - Graceful degradation when MinIO unavailable
 *
 * @Global() decorator makes StorageService available throughout the app
 * without needing to import StorageModule in every module.
 */
@Global()
@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  ],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
