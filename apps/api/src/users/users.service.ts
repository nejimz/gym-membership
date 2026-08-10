import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { MembershipStatus, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';

const userSelect = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  member: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(q?: string, role?: Role, page = 1, pageSize = 25) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const currentPage = Math.max(page, 1);
    const skip = (currentPage - 1) * take;

    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              {
                member: {
                  OR: [
                    { firstName: { contains: q, mode: 'insensitive' } },
                    { lastName: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page: currentPage, pageSize: take };
  }

  async create(dto: CreateUserDto, actor: AuthUser) {
    if (dto.role === Role.MEMBER) {
      if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
        throw new BadRequestException(
          'firstName and lastName are required for MEMBER accounts',
        );
      }
    }

    const email = dto.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    if (dto.role === Role.MEMBER) {
      let endDate = dto.endDate ? new Date(dto.endDate) : undefined;
      const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
      if (dto.planId && !endDate) {
        const plan = await this.prisma.membershipPlan.findUnique({
          where: { id: dto.planId },
        });
        if (!plan) throw new BadRequestException('Invalid plan');
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + plan.durationDays);
      }

      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          role: Role.MEMBER,
          member: {
            create: {
              firstName: dto.firstName!,
              lastName: dto.lastName!,
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
        select: userSelect,
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'USER_CREATE',
          entityType: 'User',
          entityId: user.id,
          meta: { role: Role.MEMBER },
        },
      });

      return user;
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: dto.role,
      },
      select: userSelect,
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'USER_CREATE',
        entityType: 'User',
        entityId: user.id,
        meta: { role: dto.role },
      },
    });

    return user;
  }
}
