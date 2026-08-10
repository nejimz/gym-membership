import { IsOptional, IsString } from 'class-validator';

export class CheckInDto {
  @IsString()
  memberId!: string;
}

export class CheckOutDto {
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsString()
  attendanceId?: string;
}
