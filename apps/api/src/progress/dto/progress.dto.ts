import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateBodyMetricDto {
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bodyFatPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  chestCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  waistCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hipsCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  armsCm?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
