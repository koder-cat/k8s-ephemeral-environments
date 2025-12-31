import { Module } from '@nestjs/common';
import { DatabaseTestController } from './database-test.controller';
import { DatabaseTestService } from './database-test.service';
import { DatabaseService } from '../database.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  controllers: [DatabaseTestController],
  providers: [DatabaseTestService, DatabaseService],
  exports: [DatabaseTestService],
})
export class DatabaseTestModule {}
