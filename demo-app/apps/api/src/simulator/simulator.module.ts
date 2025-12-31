import { Module, forwardRef } from '@nestjs/common';
import { SimulatorController } from './simulator.controller';
import { SimulatorService } from './simulator.service';
import { AlertDemoController } from './alert-demo.controller';
import { AlertDemoService } from './alert-demo.service';
import { DatabaseTestModule } from '../database-test/database-test.module';

@Module({
  imports: [forwardRef(() => DatabaseTestModule)],
  controllers: [SimulatorController, AlertDemoController],
  providers: [SimulatorService, AlertDemoService],
  exports: [SimulatorService, AlertDemoService],
})
export class SimulatorModule {}
