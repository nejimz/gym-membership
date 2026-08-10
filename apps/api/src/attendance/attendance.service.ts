import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async checkIn(memberId: string, actor: AuthUser) {
    if (actor.role === Role.MEMBER && actor.memberId !== memberId) {
      throw new ForbiddenException();
    }
    const member = await this.prisma.memberProfile.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.status !== MembershipStatus.ACTIVE) {
      throw new BadRequestException('Membership is not active');
    }
    if (member.endDate && member.endDate < new Date()) {
      throw new BadRequestException('Membership expired');
    }

    const open = await this.prisma.attendance.findFirst({
      where: { memberId, checkOutAt: null },
    });
    if (open) {
      throw new BadRequestException('Already checked in; check out first');
    }

    return this.prisma.attendance.create({
      data: {
        memberId,
        recordedById: actor.id,
        checkInAt: new Date(),
      },
      include: {
        member: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async checkOut(actor: AuthUser, memberId?: string, attendanceId?: string) {
    let attendance = attendanceId
      ? await this.prisma.attendance.findUnique({ where: { id: attendanceId } })
      : null;

    if (!attendance && memberId) {
      attendance = await this.prisma.attendance.findFirst({
        where: { memberId, checkOutAt: null },
        orderBy: { checkInAt: 'desc' },
      });
    }

    if (!attendance && actor.role === Role.MEMBER) {
      attendance = await this.prisma.attendance.findFirst({
        where: { memberId: actor.memberId!, checkOutAt: null },
        orderBy: { checkInAt: 'desc' },
      });
    }

    if (!attendance) throw new NotFoundException('No open check-in found');
    if (actor.role === Role.MEMBER && attendance.memberId !== actor.memberId) {
      throw new ForbiddenException();
    }
    if (attendance.checkOutAt) {
      throw new BadRequestException('Already checked out');
    }

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: { checkOutAt: new Date() },
      include: {
        member: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async today() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.prisma.attendance.findMany({
      where: { checkInAt: { gte: start } },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, status: true },
        },
      },
      orderBy: { checkInAt: 'desc' },
    });
  }

  async history(memberId: string, actor: AuthUser, take = 50) {
    if (actor.role === Role.MEMBER && actor.memberId !== memberId) {
      throw new ForbiddenException();
    }
    return this.prisma.attendance.findMany({
      where: { memberId },
      orderBy: { checkInAt: 'desc' },
      take,
    });
  }

  async openSession(memberId: string, actor: AuthUser) {
    if (actor.role === Role.MEMBER && actor.memberId !== memberId) {
      throw new ForbiddenException();
    }
    return this.prisma.attendance.findFirst({
      where: { memberId, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
    });
  }
}
