import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AuditEventType } from './audit-event.dto';

/**
 * Query parameters for filtering audit events.
 */
export class QueryAuditDto {
  @IsOptional()
  @IsEnum(['api_request', 'db_operation', 'file_operation', 'cache_operation'])
  type?: AuditEventType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pathPattern?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(100)
  @Max(599)
  statusCode?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(0)
  @Max(10000)
  offset?: number = 0;
}
