import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class StressCpuDto {
  @IsNumber()
  @IsOptional()
  @Min(100)
  @Max(30000)
  duration?: number = 5000;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  intensity?: number = 50;
}

export class StressMemoryDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(256)
  sizeMb?: number = 50;

  @IsNumber()
  @IsOptional()
  @Min(100)
  @Max(30000)
  duration?: number = 5000;
}
