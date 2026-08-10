import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { CreateBodyMetricDto } from './dto/progress.dto';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBodyMetricDto, actor: AuthUser) {
    const memberId =
      actor.role === Role.MEMBER ? actor.memberId! : dto.memberId;
    if (!memberId) throw new NotFoundException('memberId required');
    if (actor.role === Role.MEMBER && actor.memberId !== memberId) {
      throw new ForbiddenException();
    }
    const member = await this.prisma.memberProfile.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.bodyMetric.create({
      data: {
        memberId,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
        weightKg: dto.weightKg,
        bodyFatPct: dto.bodyFatPct,
        chestCm: dto.chestCm,
        waistCm: dto.waistCm,
        hipsCm: dto.hipsCm,
        armsCm: dto.armsCm,
        notes: dto.notes,
        photoUrl: dto.photoUrl,
      },
    });
  }

  async list(memberId: string, actor: AuthUser) {
    if (actor.role === Role.MEMBER && actor.memberId !== memberId) {
      throw new ForbiddenException();
    }
    return this.prisma.bodyMetric.findMany({
      where: { memberId },
      orderBy: { recordedAt: 'asc' },
    });
  }
}
