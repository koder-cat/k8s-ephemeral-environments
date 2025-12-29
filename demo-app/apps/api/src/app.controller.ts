import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  async getHealth() {
    return this.appService.getHealth();
  }

  @Get('info')
  getInfo() {
    return this.appService.getInfo();
  }

  @Get('db')
  async getDatabaseInfo() {
    return this.appService.getDatabaseInfo();
  }
}
