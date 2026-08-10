import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async list(q?: string, status?: MembershipStatus) {
    return this.prisma.memberProfile.findMany({
      where: {
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
      },
      include: { plan: true, user: { select: { id: true, email: true, role: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
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
    if (actor.role === Role.MEMBER) {
      const { firstName, lastName, phone, emergencyContact, photoUrl } = dto;
      return this.prisma.memberProfile.update({
        where: { id },
        data: { firstName, lastName, phone, emergencyContact, photoUrl },
        include: { plan: true, user: { select: { email: true } } },
      });
    }

    const data: Record<string, unknown> = { ...dto };
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
    const in7 = new Date();
    in7.setDate(today.getDate() + 7);
    return members.filter((m) => {
      if (!m.dateOfBirth) return false;
      const dob = new Date(m.dateOfBirth);
      const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        next.setFullYear(today.getFullYear() + 1);
      }
      return next >= today && next <= in7;
    });
  }
}
