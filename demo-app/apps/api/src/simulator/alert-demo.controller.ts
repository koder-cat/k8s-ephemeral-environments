import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AlertDemoService, AlertType, VALID_ALERT_TYPES } from './alert-demo.service';

@Controller('simulator/alert-demo')
export class AlertDemoController {
  private readonly logger = new Logger(AlertDemoController.name);

  constructor(private readonly alertDemoService: AlertDemoService) {}

  /**
   * Get available alert types
   */
  @Get()
  getAlertTypes(@Req() req: Request) {
    this.logger.log({
      message: 'GET /simulator/alert-demo',
      correlationId: req.correlationId,
    });

    return {
      alertTypes: this.alertDemoService.getAlertTypes(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get current status of alert demo
   */
  @Get('status')
  getStatus(@Req() req: Request) {
    this.logger.log({
      message: 'GET /simulator/alert-demo/status',
      correlationId: req.correlationId,
    });

    return {
      ...this.alertDemoService.getStatus(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Start an alert demo
   */
  @Post(':alertType')
  @HttpCode(HttpStatus.OK)
  async startAlertDemo(
    @Param('alertType') alertType: string,
    @Req() req: Request,
  ) {
    this.logger.log({
      message: 'POST /simulator/alert-demo/:alertType',
      alertType,
      correlationId: req.correlationId,
    });

    if (!VALID_ALERT_TYPES.includes(alertType as AlertType)) {
      this.logger.warn({
        message: 'Invalid alert type',
        alertType,
        validTypes: VALID_ALERT_TYPES,
        correlationId: req.correlationId,
      });
      throw new HttpException(
        {
          message: `Invalid alert type: ${alertType}`,
          validTypes: VALID_ALERT_TYPES,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const status = await this.alertDemoService.start(alertType as AlertType);
      this.logger.log({
        message: 'Alert demo started',
        alertType,
        endsAt: status.endsAt,
        correlationId: req.correlationId,
      });
      return {
        ...status,
        message: `Alert demo started. The ${alertType} alert should fire in approximately 5-6 minutes.`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        message: 'Failed to start alert demo',
        alertType,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId,
      });
      throw new HttpException(
        {
          message: error instanceof Error ? error.message : 'Failed to start alert demo',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * Stop the current alert demo
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  stopAlertDemo(@Req() req: Request) {
    this.logger.log({
      message: 'DELETE /simulator/alert-demo',
      correlationId: req.correlationId,
    });

    const status = this.alertDemoService.stop();
    this.logger.log({
      message: 'Alert demo stopped',
      requestsSent: status.requestsSent,
      correlationId: req.correlationId,
    });

    return {
      ...status,
      message: 'Alert demo stopped',
      timestamp: new Date().toISOString(),
    };
  }
}
