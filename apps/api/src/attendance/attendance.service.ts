import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceType, MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { VisitorsService } from '../visitors/visitors.service';
import { VisitorCheckInDto } from '../visitors/dto/visitor.dto';

const todayInclude = {
  member: {
    select: { id: true, firstName: true, lastName: true, status: true },
  },
  visitor: {
    select: { id: true, firstName: true, lastName: true, phone: true },
  },
  hostedByMember: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private visitors: VisitorsService,
  ) {}

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
        type: AttendanceType.MEMBER,
        memberId,
        recordedById: actor.id,
        checkInAt: new Date(),
      },
      include: todayInclude,
    });
  }

  async checkInVisitor(dto: VisitorCheckInDto, actor: AuthUser) {
    if (actor.role === Role.MEMBER) {
      throw new ForbiddenException();
    }

    const visitor = await this.visitors.findOrCreate({
      visitorId: dto.visitorId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
    });

    let hostedByMemberId: string | undefined;
    if (dto.hostedByMemberId) {
      const host = await this.prisma.memberProfile.findUnique({
        where: { id: dto.hostedByMemberId },
        select: { id: true },
      });
      if (!host) throw new NotFoundException('Host member not found');
      hostedByMemberId = host.id;
    }

    const open = await this.prisma.attendance.findFirst({
      where: { visitorId: visitor.id, checkOutAt: null },
    });
    if (open) {
      throw new BadRequestException('Already checked in; check out first');
    }

    return this.prisma.attendance.create({
      data: {
        type: AttendanceType.VISITOR,
        visitorId: visitor.id,
        hostedByMemberId,
        recordedById: actor.id,
        checkInAt: new Date(),
      },
      include: todayInclude,
    });
  }

  async checkOut(
    actor: AuthUser,
    memberId?: string,
    attendanceId?: string,
    visitorId?: string,
  ) {
    let attendance = attendanceId
      ? await this.prisma.attendance.findUnique({ where: { id: attendanceId } })
      : null;

    if (!attendance && memberId) {
      attendance = await this.prisma.attendance.findFirst({
        where: { memberId, checkOutAt: null },
        orderBy: { checkInAt: 'desc' },
      });
    }

    if (!attendance && visitorId) {
      attendance = await this.prisma.attendance.findFirst({
        where: { visitorId, checkOutAt: null },
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
      include: todayInclude,
    });
  }

  async today() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.prisma.attendance.findMany({
      where: {
        OR: [{ checkInAt: { gte: start } }, { checkOutAt: null }],
      },
      include: todayInclude,
      orderBy: [{ checkOutAt: 'asc' }, { checkInAt: 'desc' }],
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
