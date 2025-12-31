import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { DatabaseTestService } from './database-test.service';
import { CreateRecordDto, UpdateRecordDto } from './dto/record.dto';

@Controller('db-test')
export class DatabaseTestController {
  private readonly logger = new Logger(DatabaseTestController.name);

  constructor(private readonly dbTestService: DatabaseTestService) {}

  /**
   * Get all test records
   */
  @Get('records')
  async findAll(@Req() req: Request) {
    this.logger.log({
      message: 'GET /db-test/records',
      correlationId: req.correlationId,
    });

    try {
      const records = await this.dbTestService.findAll();
      return {
        records,
        count: records.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        message: 'Failed to fetch records',
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId,
      });
      throw new HttpException(
        {
          message: 'Failed to fetch records',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a single test record
   */
  @Get('records/:id')
  async findOne(@Param('id') idStr: string, @Req() req: Request) {
    const id = parseInt(idStr, 10);

    this.logger.log({
      message: 'GET /db-test/records/:id',
      id,
      correlationId: req.correlationId,
    });

    if (isNaN(id)) {
      this.logger.warn({
        message: 'Invalid ID format',
        id: idStr,
        correlationId: req.correlationId,
      });
      throw new HttpException(
        { message: 'Invalid ID format' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.dbTestService.findOne(id);
  }

  /**
   * Create a new test record
   */
  @Post('records')
  async create(@Body() dto: CreateRecordDto, @Req() req: Request) {
    this.logger.log({
      message: 'POST /db-test/records',
      name: dto.name,
      correlationId: req.correlationId,
    });

    try {
      const record = await this.dbTestService.create(dto);
      this.logger.log({
        message: 'Record created',
        id: record.id,
        correlationId: req.correlationId,
      });
      return record;
    } catch (error) {
      this.logger.error({
        message: 'Failed to create record',
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId,
      });
      throw new HttpException(
        {
          message: 'Failed to create record',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update a test record
   */
  @Put('records/:id')
  async update(
    @Param('id') idStr: string,
    @Body() dto: UpdateRecordDto,
    @Req() req: Request,
  ) {
    const id = parseInt(idStr, 10);

    this.logger.log({
      message: 'PUT /db-test/records/:id',
      id,
      updates: dto,
      correlationId: req.correlationId,
    });

    if (isNaN(id)) {
      this.logger.warn({
        message: 'Invalid ID format',
        id: idStr,
        correlationId: req.correlationId,
      });
      throw new HttpException(
        { message: 'Invalid ID format' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const record = await this.dbTestService.update(id, dto);
      this.logger.log({
        message: 'Record updated',
        id,
        correlationId: req.correlationId,
      });
      return record;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error({
        message: 'Failed to update record',
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId,
      });
      throw new HttpException(
        {
          message: 'Failed to update record',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a test record
   */
  @Delete('records/:id')
  async remove(@Param('id') idStr: string, @Req() req: Request) {
    const id = parseInt(idStr, 10);

    this.logger.log({
      message: 'DELETE /db-test/records/:id',
      id,
      correlationId: req.correlationId,
    });

    if (isNaN(id)) {
      this.logger.warn({
        message: 'Invalid ID format',
        id: idStr,
        correlationId: req.correlationId,
      });
      throw new HttpException(
        { message: 'Invalid ID format' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.dbTestService.remove(id);
      this.logger.log({
        message: 'Record deleted',
        id,
        correlationId: req.correlationId,
      });
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error({
        message: 'Failed to delete record',
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId,
      });
      throw new HttpException(
        {
          message: 'Failed to delete record',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete all test records
   */
  @Delete('records')
  async removeAll(@Req() req: Request) {
    this.logger.log({
      message: 'DELETE /db-test/records (all)',
      correlationId: req.correlationId,
    });

    try {
      const result = await this.dbTestService.removeAll();
      this.logger.log({
        message: 'All records deleted',
        count: result.deleted,
        correlationId: req.correlationId,
      });
      return result;
    } catch (error) {
      this.logger.error({
        message: 'Failed to delete all records',
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId,
      });
      throw new HttpException(
        {
          message: 'Failed to delete all records',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get database stats (pool, record count, table size)
   */
  @Get('stats')
  async getStats(@Req() req: Request) {
    this.logger.log({
      message: 'GET /db-test/stats',
      correlationId: req.correlationId,
    });

    try {
      return await this.dbTestService.getStats();
    } catch (error) {
      this.logger.error({
        message: 'Failed to get database stats',
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId,
      });
      throw new HttpException(
        {
          message: 'Failed to get database stats',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get available heavy query presets
   */
  @Get('heavy-query')
  getHeavyQueryPresets(@Req() req: Request) {
    this.logger.log({
      message: 'GET /db-test/heavy-query (presets)',
      correlationId: req.correlationId,
    });

    return {
      presets: this.dbTestService.getHeavyQueryPresets(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run a heavy query simulation
   */
  @Post('heavy-query/:preset')
  @HttpCode(HttpStatus.OK)
  async runHeavyQuery(@Param('preset') preset: string, @Req() req: Request) {
    this.logger.log({
      message: 'POST /db-test/heavy-query/:preset',
      preset,
      correlationId: req.correlationId,
    });

    try {
      const result = await this.dbTestService.runHeavyQuery(preset);
      this.logger.log({
        message: 'Heavy query completed',
        preset,
        durationMs: result.durationMs,
        rowCount: result.rowCount,
        correlationId: req.correlationId,
      });
      return result;
    } catch (error) {
      this.logger.error({
        message: 'Heavy query failed',
        preset,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId,
      });

      const message = error instanceof Error ? error.message : 'Unknown error';
      const isClientError = message.includes('Unknown preset');

      throw new HttpException(
        {
          message: 'Heavy query failed',
          error: message,
          presets: isClientError
            ? Object.keys(this.dbTestService.getHeavyQueryPresets())
            : undefined,
        },
        isClientError ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
