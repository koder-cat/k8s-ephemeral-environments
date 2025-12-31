import { IsString, IsOptional, IsObject, MinLength, MaxLength } from 'class-validator';

export class CreateRecordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}

export class UpdateRecordDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}
