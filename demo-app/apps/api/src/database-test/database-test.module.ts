import { Module } from '@nestjs/common';
import { DatabaseTestController } from './database-test.controller';
import { DatabaseTestService } from './database-test.service';

@Module({
  controllers: [DatabaseTestController],
  providers: [DatabaseTestService],
  exports: [DatabaseTestService],
})
export class DatabaseTestModule {}
