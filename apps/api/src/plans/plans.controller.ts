import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlansController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  list() {
    return this.prisma.membershipPlan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });
  }
}
