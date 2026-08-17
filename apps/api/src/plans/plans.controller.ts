import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { PlansService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlansController {
  constructor(private plans: PlansService) {}

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  list() {
    return this.plans.listActive();
  }

  @Get('all')
  @Roles(Role.ADMIN)
  listAll() {
    return this.plans.listAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthUser) {
    return this.plans.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.plans.update(id, dto, user);
  }
}
