import { Controller, Get, Res, Logger, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response) {
    res.set('Content-Type', this.metricsService.getContentType());
    res.send(await this.metricsService.getMetrics());
  }

  /**
   * Get metrics summary for the frontend dashboard
   */
  @Get('summary')
  getSummary(@Req() req: Request) {
    this.logger.log({
      message: 'GET /metrics/summary',
      correlationId: req.correlationId,
    });
    return this.metricsService.getSummary();
  }
}
