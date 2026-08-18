import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitorDto } from './dto/visitor.dto';

const visitorListInclude = {
  attendances: {
    orderBy: { checkInAt: 'desc' as const },
    take: 1,
    select: { checkInAt: true },
  },
  _count: { select: { attendances: true } },
};

@Injectable()
export class VisitorsService {
  constructor(private prisma: PrismaService) {}

  async list(q?: string, page = 1, pageSize = 20) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const currentPage = Math.max(page, 1);
    const skip = (currentPage - 1) * take;
    const query = q?.trim();

    const where: Prisma.VisitorWhereInput = query
      ? {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      this.prisma.visitor.findMany({
        where,
        include: visitorListInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take,
      }),
      this.prisma.visitor.count({ where }),
    ]);

    return {
      data: rows.map((v) => this.toListItem(v)),
      total,
      page: currentPage,
      pageSize: take,
    };
  }

  async create(dto: CreateVisitorDto) {
    const visitor = await this.prisma.visitor.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
      include: visitorListInclude,
    });
    return this.toListItem(visitor);
  }

  async findOrCreate(input: {
    visitorId?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    const firstName = input.firstName?.trim();
    const lastName = input.lastName?.trim();
    const phone = input.phone?.trim() || undefined;

    if (input.visitorId) {
      const existing = await this.prisma.visitor.findUnique({
        where: { id: input.visitorId },
      });
      if (!existing) throw new NotFoundException('Visitor not found');
      if (!firstName && !lastName && !phone) return existing;
      return this.prisma.visitor.update({
        where: { id: existing.id },
        data: {
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(phone ? { phone } : {}),
        },
      });
    }

    if (phone) {
      const byPhone = await this.prisma.visitor.findFirst({
        where: { phone: { equals: phone, mode: 'insensitive' } },
        orderBy: { updatedAt: 'desc' },
      });
      if (byPhone) {
        return this.prisma.visitor.update({
          where: { id: byPhone.id },
          data: {
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            phone,
          },
        });
      }
    }

    if (firstName && lastName) {
      const byName = await this.prisma.visitor.findFirst({
        where: {
          firstName: { equals: firstName, mode: 'insensitive' },
          lastName: { equals: lastName, mode: 'insensitive' },
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (byName && !phone) return byName;
    }

    if (!firstName || !lastName) {
      throw new BadRequestException('First name and last name are required');
    }

    return this.prisma.visitor.create({
      data: {
        firstName,
        lastName,
        phone: phone ?? null,
      },
    });
  }

  private toListItem(
    v: Prisma.VisitorGetPayload<{ include: typeof visitorListInclude }>,
  ) {
    return {
      id: v.id,
      firstName: v.firstName,
      lastName: v.lastName,
      phone: v.phone,
      notes: v.notes,
      visitCount: v._count.attendances,
      lastVisitAt: v.attendances[0]?.checkInAt ?? null,
    };
  }
}
