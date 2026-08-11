import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BodyMetric, Role, Sex } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { CreateBodyMetricDto } from './dto/progress.dto';
import {
  effectiveLeanMassKg,
  estimateLeanMassKg,
} from './lean-mass';

export type BodyMetricWithEstimate = BodyMetric & {
  estimatedLeanMassKg: number | null;
  effectiveLeanMassKg: number | null;
};

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  private assertMemberAccess(memberId: string, actor: AuthUser) {
    if (actor.role === Role.MEMBER && actor.memberId !== memberId) {
      throw new ForbiddenException();
    }
  }

  private enrich(
    metric: BodyMetric,
    profile: { heightCm: number | null; sex: Sex | null },
  ): BodyMetricWithEstimate {
    const estimatedLeanMassKg = estimateLeanMassKg({
      sex: profile.sex,
      heightCm: profile.heightCm,
      weightKg: metric.weightKg,
      neckCm: metric.neckCm,
      waistCm: metric.waistCm,
      hipsCm: metric.hipsCm,
    });
    return {
      ...metric,
      estimatedLeanMassKg,
      effectiveLeanMassKg: effectiveLeanMassKg(
        metric.leanMassKg,
        estimatedLeanMassKg,
      ),
    };
  }

  async create(dto: CreateBodyMetricDto, actor: AuthUser) {
    const memberId =
      actor.role === Role.MEMBER ? actor.memberId! : dto.memberId;
    if (!memberId) throw new NotFoundException('memberId required');
    this.assertMemberAccess(memberId, actor);

    const member = await this.prisma.memberProfile.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    const created = await this.prisma.bodyMetric.create({
      data: {
        memberId,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
        weightKg: dto.weightKg,
        bodyFatPct: dto.bodyFatPct,
        chestCm: dto.chestCm,
        waistCm: dto.waistCm,
        hipsCm: dto.hipsCm,
        armsCm: dto.armsCm,
        thighsCm: dto.thighsCm,
        neckCm: dto.neckCm,
        restingHrBpm: dto.restingHrBpm,
        leanMassKg: dto.leanMassKg,
        notes: dto.notes,
        photoUrl: dto.photoUrl,
      },
    });

    return this.enrich(created, member);
  }

  async list(memberId: string, actor: AuthUser) {
    this.assertMemberAccess(memberId, actor);

    const member = await this.prisma.memberProfile.findUnique({
      where: { id: memberId },
      select: { heightCm: true, sex: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    const rows = await this.prisma.bodyMetric.findMany({
      where: { memberId },
      orderBy: { recordedAt: 'asc' },
    });

    return rows.map((row) => this.enrich(row, member));
  }

  async activityCorrelation(
    memberId: string,
    actor: AuthUser,
    months = 6,
  ) {
    this.assertMemberAccess(memberId, actor);

    const member = await this.prisma.memberProfile.findUnique({
      where: { id: memberId },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    const monthCount = Math.min(Math.max(months || 6, 1), 24);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1);
    start.setHours(0, 0, 0, 0);

    const [attendances, metrics] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { memberId, checkInAt: { gte: start } },
        select: { checkInAt: true },
      }),
      this.prisma.bodyMetric.findMany({
        where: {
          memberId,
          recordedAt: { gte: start },
          weightKg: { not: null },
        },
        select: { recordedAt: true, weightKg: true },
      }),
    ]);

    const buckets: {
      month: string;
      visitCount: number;
      avgWeightKg: number | null;
      weightDeltaKg: number | null;
    }[] = [];

    let prevAvg: number | null = null;
    for (let i = 0; i < monthCount; i++) {
      const monthDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const nextMonth = new Date(start.getFullYear(), start.getMonth() + i + 1, 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      const visitCount = attendances.filter(
        (a) => a.checkInAt >= monthDate && a.checkInAt < nextMonth,
      ).length;

      const monthWeights = metrics
        .filter((m) => m.recordedAt >= monthDate && m.recordedAt < nextMonth)
        .map((m) => m.weightKg!)
        .filter((w) => w != null);

      const avgWeightKg =
        monthWeights.length > 0
          ? Math.round(
              (monthWeights.reduce((s, w) => s + w, 0) / monthWeights.length) *
                10,
            ) / 10
          : null;

      const weightDeltaKg =
        avgWeightKg != null && prevAvg != null
          ? Math.round((avgWeightKg - prevAvg) * 10) / 10
          : null;

      if (avgWeightKg != null) prevAvg = avgWeightKg;

      buckets.push({
        month: key,
        visitCount,
        avgWeightKg,
        weightDeltaKg,
      });
    }

    return buckets;
  }
}
