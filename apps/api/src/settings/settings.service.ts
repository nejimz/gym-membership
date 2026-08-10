import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const DEFAULT_ID = 'default';
const UPLOADS_ROOT = join(process.cwd(), 'uploads');
const LOGOS_DIR = join(UPLOADS_ROOT, 'logos');

function ensureLogosDir() {
  if (!existsSync(LOGOS_DIR)) {
    mkdirSync(LOGOS_DIR, { recursive: true });
  }
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {
    ensureLogosDir();
  }

  async get() {
    return this.prisma.appSettings.upsert({
      where: { id: DEFAULT_ID },
      update: {},
      create: {
        id: DEFAULT_ID,
        companyName: 'Ironleaf Gym',
        currency: 'PHP',
        logoUrl: null,
      },
    });
  }

  async update(dto: UpdateSettingsDto) {
    await this.get();
    const current = await this.prisma.appSettings.findUnique({
      where: { id: DEFAULT_ID },
    });

    if (
      dto.logoUrl !== undefined &&
      current?.logoUrl &&
      dto.logoUrl !== current.logoUrl
    ) {
      this.deleteLocalLogoFile(current.logoUrl);
    }

    return this.prisma.appSettings.update({
      where: { id: DEFAULT_ID },
      data: {
        ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.logoUrl !== undefined
          ? { logoUrl: dto.logoUrl === '' ? null : dto.logoUrl }
          : {}),
      },
    });
  }

  async uploadLogo(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Logo file is required');
    }

    const current = await this.get();
    this.deleteLocalLogoFile(current.logoUrl);

    const logoUrl = `/uploads/logos/${file.filename}`;
    return this.prisma.appSettings.update({
      where: { id: DEFAULT_ID },
      data: { logoUrl },
    });
  }

  async clearLogo() {
    const current = await this.get();
    if (!current.logoUrl) {
      throw new NotFoundException('No logo set');
    }
    this.deleteLocalLogoFile(current.logoUrl);
    return this.prisma.appSettings.update({
      where: { id: DEFAULT_ID },
      data: { logoUrl: null },
    });
  }

  private deleteLocalLogoFile(logoUrl: string | null | undefined) {
    if (!logoUrl || !logoUrl.startsWith('/uploads/logos/')) return;
    const filename = logoUrl.replace('/uploads/logos/', '');
    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      return;
    }
    const fullPath = join(LOGOS_DIR, filename);
    if (existsSync(fullPath)) {
      try {
        unlinkSync(fullPath);
      } catch {
        /* ignore missing file */
      }
    }
  }
}

export function logoUploadOptions() {
  ensureLogosDir();
  return {
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      if (!allowed.includes(file.mimetype)) {
        return cb(
          new BadRequestException('Only PNG, JPEG, WebP, or GIF images are allowed'),
          false,
        );
      }
      cb(null, true);
    },
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, LOGOS_DIR),
      filename: (_req, file, cb) => {
        const safeExt = extname(file.originalname).toLowerCase() || '.png';
        const name = `logo-${Date.now()}${safeExt}`;
        cb(null, name);
      },
    }),
  };
}
