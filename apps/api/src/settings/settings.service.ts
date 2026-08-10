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
const FAVICONS_DIR = join(UPLOADS_ROOT, 'favicons');

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function ensureUploadDirs() {
  ensureDir(LOGOS_DIR);
  ensureDir(FAVICONS_DIR);
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {
    ensureUploadDirs();
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
        faviconUrl: null,
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
      this.deleteLocalUploadFile(current.logoUrl, '/uploads/logos/', LOGOS_DIR);
    }

    if (
      dto.faviconUrl !== undefined &&
      current?.faviconUrl &&
      dto.faviconUrl !== current.faviconUrl
    ) {
      this.deleteLocalUploadFile(
        current.faviconUrl,
        '/uploads/favicons/',
        FAVICONS_DIR,
      );
    }

    return this.prisma.appSettings.update({
      where: { id: DEFAULT_ID },
      data: {
        ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.logoUrl !== undefined
          ? { logoUrl: dto.logoUrl === '' ? null : dto.logoUrl }
          : {}),
        ...(dto.faviconUrl !== undefined
          ? { faviconUrl: dto.faviconUrl === '' ? null : dto.faviconUrl }
          : {}),
      },
    });
  }

  async uploadLogo(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Logo file is required');
    }

    const current = await this.get();
    this.deleteLocalUploadFile(current.logoUrl, '/uploads/logos/', LOGOS_DIR);

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
    this.deleteLocalUploadFile(current.logoUrl, '/uploads/logos/', LOGOS_DIR);
    return this.prisma.appSettings.update({
      where: { id: DEFAULT_ID },
      data: { logoUrl: null },
    });
  }

  async uploadFavicon(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Favicon file is required');
    }

    const current = await this.get();
    this.deleteLocalUploadFile(
      current.faviconUrl,
      '/uploads/favicons/',
      FAVICONS_DIR,
    );

    const faviconUrl = `/uploads/favicons/${file.filename}`;
    return this.prisma.appSettings.update({
      where: { id: DEFAULT_ID },
      data: { faviconUrl },
    });
  }

  async clearFavicon() {
    const current = await this.get();
    if (!current.faviconUrl) {
      throw new NotFoundException('No favicon set');
    }
    this.deleteLocalUploadFile(
      current.faviconUrl,
      '/uploads/favicons/',
      FAVICONS_DIR,
    );
    return this.prisma.appSettings.update({
      where: { id: DEFAULT_ID },
      data: { faviconUrl: null },
    });
  }

  private deleteLocalUploadFile(
    url: string | null | undefined,
    prefix: string,
    dir: string,
  ) {
    if (!url || !url.startsWith(prefix)) return;
    const filename = url.replace(prefix, '');
    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      return;
    }
    const fullPath = join(dir, filename);
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
  ensureUploadDirs();
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

export function faviconUploadOptions() {
  ensureUploadDirs();
  return {
    limits: { fileSize: 512 * 1024 },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const ext = extname(file.originalname).toLowerCase();
      const allowedExt = ['.ico', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
      const allowedMime = [
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'image/x-icon',
        'image/vnd.microsoft.icon',
        'image/ico',
        'application/octet-stream',
      ];
      if (!allowedExt.includes(ext) || !allowedMime.includes(file.mimetype)) {
        return cb(
          new BadRequestException(
            'Only ICO, PNG, JPEG, WebP, or GIF favicons are allowed',
          ),
          false,
        );
      }
      cb(null, true);
    },
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, FAVICONS_DIR),
      filename: (_req, file, cb) => {
        const safeExt = extname(file.originalname).toLowerCase() || '.ico';
        const name = `favicon-${Date.now()}${safeExt}`;
        cb(null, name);
      },
    }),
  };
}
