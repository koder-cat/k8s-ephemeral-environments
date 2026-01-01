import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';

/**
 * Audit Module - MongoDB-based activity logging
 *
 * Features:
 * - Automatic API request logging via global interceptor
 * - TTL-based cleanup (7 days)
 * - Query API with filters
 * - Graceful degradation when MongoDB unavailable
 *
 * @Global() decorator makes AuditService available throughout the app
 * without needing to import AuditModule in every module.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
