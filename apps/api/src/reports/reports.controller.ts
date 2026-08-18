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
    return this.reports.attendanceByDay(this.parseDays(days));
  }

  @Get('membership-summary')
  @Roles(Role.ADMIN, Role.STAFF)
  membershipSummary(@Query('days') days?: string) {
    return this.reports.membershipSummary(this.parseDays(days));
  }

  @Get('peak-hours')
  @Roles(Role.ADMIN, Role.STAFF)
  peakHours(@Query('days') days?: string) {
    return this.reports.peakHours(this.parseDays(days));
  }

  @Get('inactive-members')
  @Roles(Role.ADMIN, Role.STAFF)
  inactiveMembers(@Query('days') days?: string) {
    return this.reports.inactiveMembers(this.parseDays(days));
  }

  @Get('attendance.csv')
  @Roles(Role.ADMIN, Role.STAFF)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="attendance.csv"')
  exportAttendanceCsv(@Query('days') days?: string) {
    return this.reports.exportAttendanceCsv(this.parseDays(days));
  }

  @Get('members.csv')
  @Roles(Role.ADMIN, Role.STAFF)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="members.csv"')
  exportMembersCsv() {
    return this.reports.exportMembersCsv();
  }

  @Get('renewals.csv')
  @Roles(Role.ADMIN, Role.STAFF)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="renewals.csv"')
  exportRenewalsCsv(@Query('days') days?: string) {
    return this.reports.exportRenewalsCsv(this.parseDays(days));
  }

  @Get('inactive-members.csv')
  @Roles(Role.ADMIN, Role.STAFF)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="inactive-members.csv"')
  exportInactiveCsv(@Query('days') days?: string) {
    return this.reports.exportInactiveCsv(this.parseDays(days));
  }

  private parseDays(days?: string, fallback = 30) {
    const n = days ? Number(days) : fallback;
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(Math.floor(n), 365);
  }
}
