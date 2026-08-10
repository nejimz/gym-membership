import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('dashboard')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  dashboard(@CurrentUser() user: AuthUser) {
    return this.reports.dashboard(user);
  }

  @Get('attendance-series')
  @Roles(Role.ADMIN, Role.STAFF)
  attendanceSeries(@Query('days') days?: string) {
    return this.reports.attendanceByDay(days ? Number(days) : 30);
  }

  @Get('attendance.csv')
  @Roles(Role.ADMIN, Role.STAFF)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="attendance.csv"')
  exportCsv(@Query('days') days?: string) {
    return this.reports.exportAttendanceCsv(days ? Number(days) : 30);
  }
}
