import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { MetricsModule } from './metrics/metrics.module';

/**
 * DatabaseModule provides a shared DatabaseService instance across the application.
 *
 * The @Global() decorator ensures only one DatabaseService instance (and thus one
 * connection pool) is created, even when imported by multiple modules.
 */
@Global()
@Module({
  imports: [MetricsModule],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
