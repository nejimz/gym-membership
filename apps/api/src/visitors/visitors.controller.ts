import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CreateVisitorDto } from './dto/visitor.dto';
import { VisitorsService } from './visitors.service';

@Controller('visitors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisitorsController {
  constructor(private visitors: VisitorsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  list(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.visitors.list(q, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  create(@Body() dto: CreateVisitorDto) {
    return this.visitors.create(dto);
  }
}
