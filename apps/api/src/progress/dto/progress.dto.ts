import {
  IsDateString,
  IsInt,
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
  @IsNumber()
  @Min(0)
  thighsCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  neckCm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  restingHrBpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  leanMassKg?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
