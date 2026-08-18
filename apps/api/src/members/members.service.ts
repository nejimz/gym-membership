import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';

const UPLOADS_ROOT = join(process.cwd(), 'uploads');
const PHOTOS_DIR = join(UPLOADS_ROOT, 'photos');
const PHOTO_URL_PREFIX = '/uploads/photos/';
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/webp',
  'image/gif',
  'image/x-png',
];
const PHOTO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

function ensurePhotosDir() {
  if (!existsSync(PHOTOS_DIR)) {
    mkdirSync(PHOTOS_DIR, { recursive: true });
  }
}

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {
    ensurePhotosDir();
  }

  async list(
    q?: string,
    status?: MembershipStatus,
    page = 1,
    pageSize = 25,
  ) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const currentPage = Math.max(page, 1);
    const skip = (currentPage - 1) * take;

    const where: Prisma.MemberProfileWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { user: { email: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.memberProfile.findMany({
        where,
        include: { plan: true, user: { select: { id: true, email: true, role: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take,
      }),
      this.prisma.memberProfile.count({ where }),
    ]);

    return { data, total, page: currentPage, pageSize: take };
  }

  async get(id: string, actor: AuthUser) {
    const member = await this.prisma.memberProfile.findUnique({
      where: { id },
      include: {
        plan: true,
        user: { select: { id: true, email: true, role: true } },
        attendances: { orderBy: { checkInAt: 'desc' }, take: 20 },
        bodyMetrics: { orderBy: { recordedAt: 'desc' }, take: 10 },
      },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (actor.role === Role.MEMBER && actor.memberId !== id) {
      throw new ForbiddenException();
    }
    return member;
  }

  async create(dto: CreateMemberDto, actor: AuthUser) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new BadRequestException('Email already in use');

    let endDate = dto.endDate ? new Date(dto.endDate) : undefined;
    let startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    if (dto.planId && !endDate) {
      const plan = await this.prisma.membershipPlan.findUnique({
        where: { id: dto.planId },
      });
      if (!plan) throw new BadRequestException('Invalid plan');
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.durationDays);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: Role.MEMBER,
        member: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            emergencyContact: dto.emergencyContact,
            heightCm: dto.heightCm,
            sex: dto.sex,
            photoUrl: dto.photoUrl,
            planId: dto.planId,
            startDate,
            endDate,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
      include: { member: { include: { plan: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'MEMBER_CREATE',
        entityType: 'MemberProfile',
        entityId: user.member!.id,
      },
    });

    return user.member;
  }

  async update(id: string, dto: UpdateMemberDto, actor: AuthUser) {
    if (actor.role === Role.MEMBER && actor.memberId !== id) {
      throw new ForbiddenException();
    }
    await this.replacePhotoUrlIfChanged(id, dto.photoUrl);

    if (actor.role === Role.MEMBER) {
      const {
        firstName,
        lastName,
        phone,
        emergencyContact,
        photoUrl,
        heightCm,
        sex,
      } = dto;
      return this.prisma.memberProfile.update({
        where: { id },
        data: {
          firstName,
          lastName,
          phone,
          emergencyContact,
          photoUrl: photoUrl === '' ? null : photoUrl,
          heightCm,
          sex,
        },
        include: { plan: true, user: { select: { email: true } } },
      });
    }

    const data: Record<string, unknown> = { ...dto };
    if (dto.photoUrl === '') data.photoUrl = null;
    if (dto.dateOfBirth) data.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    if (dto.planId && !dto.endDate) {
      const member = await this.prisma.memberProfile.findUnique({ where: { id } });
      const plan = await this.prisma.membershipPlan.findUnique({
        where: { id: dto.planId },
      });
      if (plan) {
        const start = dto.startDate
          ? new Date(dto.startDate)
          : member?.startDate || new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + plan.durationDays);
        data.startDate = start;
        data.endDate = end;
        data.status = MembershipStatus.ACTIVE;
      }
    }

    const updated = await this.prisma.memberProfile.update({
      where: { id },
      data,
      include: { plan: true, user: { select: { email: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'MEMBER_UPDATE',
        entityType: 'MemberProfile',
        entityId: id,
        meta: dto as object,
      },
    });

    return updated;
  }

  async uploadPhoto(id: string, file: Express.Multer.File | undefined, actor: AuthUser) {
    try {
      this.assertMemberAccess(id, actor);
    } catch (err) {
      this.deleteUploadedFile(file);
      throw err;
    }
    if (!file) {
      throw new BadRequestException('Photo file is required');
    }

    const member = await this.prisma.memberProfile.findUnique({ where: { id } });
    if (!member) {
      this.deleteUploadedFile(file);
      throw new NotFoundException('Member not found');
    }

    this.deleteLocalPhoto(member.photoUrl);
    const photoUrl = `${PHOTO_URL_PREFIX}${file.filename}`;
    return this.prisma.memberProfile.update({
      where: { id },
      data: { photoUrl },
      include: { plan: true, user: { select: { email: true } } },
    });
  }

  async clearPhoto(id: string, actor: AuthUser) {
    this.assertMemberAccess(id, actor);
    const member = await this.prisma.memberProfile.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');
    if (!member.photoUrl) {
      throw new NotFoundException('No profile photo set');
    }
    this.deleteLocalPhoto(member.photoUrl);
    return this.prisma.memberProfile.update({
      where: { id },
      data: { photoUrl: null },
      include: { plan: true, user: { select: { email: true } } },
    });
  }

  private assertMemberAccess(id: string, actor: AuthUser) {
    if (actor.role === Role.MEMBER && actor.memberId !== id) {
      throw new ForbiddenException();
    }
  }

  private async replacePhotoUrlIfChanged(id: string, nextUrl?: string) {
    if (nextUrl === undefined) return;
    const current = await this.prisma.memberProfile.findUnique({ where: { id } });
    const normalized = nextUrl === '' ? null : nextUrl;
    if (current?.photoUrl && current.photoUrl !== normalized) {
      this.deleteLocalPhoto(current.photoUrl);
    }
  }

  private deleteLocalPhoto(url: string | null | undefined) {
    if (!url || !url.startsWith(PHOTO_URL_PREFIX)) return;
    const filename = url.replace(PHOTO_URL_PREFIX, '');
    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      return;
    }
    const fullPath = join(PHOTOS_DIR, filename);
    if (existsSync(fullPath)) {
      try {
        unlinkSync(fullPath);
      } catch {
        /* ignore missing file */
      }
    }
  }

  private deleteUploadedFile(file?: Express.Multer.File) {
    if (!file?.path || !existsSync(file.path)) return;
    try {
      unlinkSync(file.path);
    } catch {
      /* ignore missing file */
    }
  }

  async renewalsDue(withinDays = 30) {
    const now = new Date();
    const until = new Date();
    until.setDate(until.getDate() + withinDays);
    return this.prisma.memberProfile.findMany({
      where: {
        status: MembershipStatus.ACTIVE,
        endDate: { gte: now, lte: until },
      },
      include: { plan: true, user: { select: { email: true } } },
      orderBy: { endDate: 'asc' },
    });
  }

  async birthdaysThisWeek() {
    const members = await this.prisma.memberProfile.findMany({
      where: { dateOfBirth: { not: null } },
      include: { user: { select: { email: true } } },
    });
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekEnd = new Date(startOfToday);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return members
      .map((m) => {
        if (!m.dateOfBirth) return null;
        const dob = new Date(m.dateOfBirth);
        const next = new Date(startOfToday.getFullYear(), dob.getMonth(), dob.getDate());
        if (next < startOfToday) {
          next.setFullYear(startOfToday.getFullYear() + 1);
        }
        if (next < startOfToday || next > weekEnd) return null;
        return { ...m, nextBirthday: next };
      })
      .filter((m): m is NonNullable<typeof m> => m != null)
      .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime())
      .map(({ nextBirthday: _next, ...m }) => m);
  }
}

export function photoUploadOptions() {
  ensurePhotosDir();
  return {
    limits: { fileSize: PHOTO_MAX_BYTES },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const ext = extname(file.originalname).toLowerCase();
      const mimeOk = PHOTO_MIME_TYPES.includes(file.mimetype);
      const extOk = PHOTO_EXTENSIONS.includes(ext);
      if (!mimeOk && !extOk) {
        return cb(
          new BadRequestException('Only PNG, JPEG, WebP, or GIF images are allowed'),
          false,
        );
      }
      cb(null, true);
    },
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, PHOTOS_DIR),
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const mimeExt: Record<string, string> = {
          'image/png': '.png',
          'image/x-png': '.png',
          'image/jpeg': '.jpg',
          'image/jpg': '.jpg',
          'image/pjpeg': '.jpg',
          'image/webp': '.webp',
          'image/gif': '.gif',
        };
        const safeExt = PHOTO_EXTENSIONS.includes(ext)
          ? ext
          : mimeExt[file.mimetype] || '.jpg';
        const name = `photo-${Date.now()}${safeExt}`;
        cb(null, name);
      },
    }),
  };
}
