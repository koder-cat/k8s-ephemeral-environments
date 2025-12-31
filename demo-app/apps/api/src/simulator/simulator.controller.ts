import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SimulatorService } from './simulator.service';
import { StressCpuDto, StressMemoryDto } from './dto/stress.dto';

@Controller('simulator')
export class SimulatorController {
  private readonly logger = new Logger(SimulatorController.name);

  constructor(private readonly simulatorService: SimulatorService) {}

  /**
   * Get all supported status codes grouped by category
   */
  @Get('status')
  getStatusCodes(@Req() req: Request) {
    this.logger.log({
      message: 'Fetching supported status codes',
      correlationId: req.correlationId,
    });

    return {
      ...this.simulatorService.getSupportedStatusCodes(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Simulate a specific HTTP status code response
   */
  @Get('status/:code')
  simulateStatus(@Param('code') codeStr: string, @Req() req: Request) {
    const code = parseInt(codeStr, 10);

    if (isNaN(code) || code < 100 || code > 599) {
      this.logger.warn({
        message: 'Invalid status code requested',
        code: codeStr,
        correlationId: req.correlationId,
      });
      throw new HttpException(
        {
          code: 400,
          message: 'Invalid status code. Must be between 100 and 599.',
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log({
      message: 'Simulating HTTP status code',
      code,
      correlationId: req.correlationId,
    });

    const response = this.simulatorService.getStatusResponse(code);
    response.correlationId = req.correlationId;

    // For 2xx status codes, return normally
    if (code >= 200 && code < 300) {
      return response;
    }

    // For error status codes, throw appropriate exceptions
    throw new HttpException(response, code);
  }

  /**
   * Get available latency presets
   */
  @Get('latency')
  getLatencyPresets(@Req() req: Request) {
    this.logger.log({
      message: 'Fetching latency presets',
      correlationId: req.correlationId,
    });

    return {
      presets: this.simulatorService.getLatencyPresets(),
      maxCustomMs: 15000,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Simulate latency with a preset or custom delay
   */
  @Get('latency/:preset')
  async simulateLatency(
    @Param('preset') preset: string,
    @Query('ms') msStr: string | undefined,
    @Req() req: Request,
  ) {
    const customMs = msStr ? parseInt(msStr, 10) : undefined;

    this.logger.log({
      message: 'Starting latency simulation',
      preset,
      customMs,
      correlationId: req.correlationId,
    });

    try {
      const result = await this.simulatorService.simulateLatency(
        preset,
        customMs,
      );

      this.logger.log({
        message: 'Latency simulation completed',
        preset,
        requestedDelay: result.requestedDelay,
        actualDelay: result.actualDelay,
        correlationId: req.correlationId,
      });

      return result;
    } catch (error) {
      this.logger.error({
        message: 'Latency simulation failed',
        preset,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId,
      });

      throw new HttpException(
        {
          code: 400,
          message: error instanceof Error ? error.message : 'Unknown error',
          validPresets: Object.keys(
            this.simulatorService.getLatencyPresets(),
          ).concat('custom'),
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Start CPU stress test
   */
  @Post('stress/cpu')
  @HttpCode(HttpStatus.OK)
  async stressCpu(@Body() body: StressCpuDto, @Req() req: Request) {
    const { duration = 5000, intensity = 50 } = body;

    this.logger.log({
      message: 'Starting CPU stress test',
      duration,
      intensity,
      correlationId: req.correlationId,
    });

    const result = await this.simulatorService.stressCpu(duration, intensity);

    this.logger.log({
      message: 'CPU stress test completed',
      duration: result.duration,
      intensity: result.intensity,
      memoryBefore: result.before.memoryUsedMb,
      memoryAfter: result.after.memoryUsedMb,
      correlationId: req.correlationId,
    });

    return result;
  }

  /**
   * Start memory stress test
   */
  @Post('stress/memory')
  @HttpCode(HttpStatus.OK)
  async stressMemory(@Body() body: StressMemoryDto, @Req() req: Request) {
    const { sizeMb = 50, duration = 5000 } = body;

    this.logger.log({
      message: 'Starting memory stress test',
      sizeMb,
      duration,
      correlationId: req.correlationId,
    });

    const result = await this.simulatorService.stressMemory(sizeMb, duration);

    this.logger.log({
      message: 'Memory stress test completed',
      sizeMb: result.sizeMb,
      duration: result.duration,
      memoryBefore: result.before.memoryUsedMb,
      memoryAfter: result.after.memoryUsedMb,
      correlationId: req.correlationId,
    });

    return result;
  }
}
