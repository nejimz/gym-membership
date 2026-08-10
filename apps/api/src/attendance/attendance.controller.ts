import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { CheckInDto, CheckOutDto } from './dto/attendance.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  @Post('check-in')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  checkIn(@Body() dto: CheckInDto, @CurrentUser() user: AuthUser) {
    const memberId =
      user.role === Role.MEMBER ? user.memberId! : dto.memberId;
    return this.attendance.checkIn(memberId, user);
  }

  @Post('check-out')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  checkOut(@Body() dto: CheckOutDto, @CurrentUser() user: AuthUser) {
    return this.attendance.checkOut(user, dto.memberId, dto.attendanceId);
  }

  @Get('today')
  @Roles(Role.ADMIN, Role.STAFF)
  today() {
    return this.attendance.today();
  }

  @Get('open/:memberId')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  open(@Param('memberId') memberId: string, @CurrentUser() user: AuthUser) {
    const id = user.role === Role.MEMBER ? user.memberId! : memberId;
    return this.attendance.openSession(id, user);
  }

  @Get('member/:memberId')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  history(
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthUser,
    @Query('take') take?: string,
  ) {
    return this.attendance.history(memberId, user, take ? Number(take) : 50);
  }
}
