import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { CreateBodyMetricDto } from './dto/progress.dto';

@Controller('progress')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressController {
  constructor(private progress: ProgressService) {}

  @Post()
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  create(@Body() dto: CreateBodyMetricDto, @CurrentUser() user: AuthUser) {
    return this.progress.create(dto, user);
  }

  @Get(':memberId/activity-correlation')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  activityCorrelation(
    @Param('memberId') memberId: string,
    @Query('months') months: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    const id = user.role === Role.MEMBER ? user.memberId! : memberId;
    return this.progress.activityCorrelation(
      id,
      user,
      months ? Number(months) : 6,
    );
  }

  @Get(':memberId')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  list(@Param('memberId') memberId: string, @CurrentUser() user: AuthUser) {
    const id = user.role === Role.MEMBER ? user.memberId! : memberId;
    return this.progress.list(id, user);
  }
}
