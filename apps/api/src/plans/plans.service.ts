import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  listActive() {
    return this.prisma.membershipPlan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });
  }

  listAll() {
    return this.prisma.membershipPlan.findMany({
      orderBy: { price: 'asc' },
    });
  }

  async create(dto: CreatePlanDto, actor: AuthUser) {
    const plan = await this.prisma.membershipPlan.create({
      data: {
        name: dto.name.trim(),
        durationDays: dto.durationDays,
        price: dto.price,
        description: dto.description?.trim() || null,
        active: dto.active ?? true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'PLAN_CREATE',
        entityType: 'MembershipPlan',
        entityId: plan.id,
        meta: { name: plan.name, price: Number(plan.price) },
      },
    });

    return plan;
  }

  async update(id: string, dto: UpdatePlanDto, actor: AuthUser) {
    const existing = await this.prisma.membershipPlan.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Plan not found');

    const plan = await this.prisma.membershipPlan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.durationDays !== undefined
          ? { durationDays: dto.durationDays }
          : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'PLAN_UPDATE',
        entityType: 'MembershipPlan',
        entityId: plan.id,
        meta: {
          name: plan.name,
          price: Number(plan.price),
          active: plan.active,
        },
      },
    });

    return plan;
  }
}
