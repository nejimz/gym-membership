import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v != null)
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https?:\/\/.+|\/uploads\/.+)$/i, {
    message: 'logoUrl must be an http(s) URL or an /uploads/... path',
  })
  logoUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v != null)
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https?:\/\/.+|\/uploads\/.+)$/i, {
    message: 'faviconUrl must be an http(s) URL or an /uploads/... path',
  })
  faviconUrl?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['PHP', 'USD', 'EUR'])
  currency?: string;
}
