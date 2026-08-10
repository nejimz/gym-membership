import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.listForUser(user.id);
  }

  @Get('unread-count')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  unread(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id).then((count) => ({ count }));
  }

  @Post('read-all')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  markAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(id, user.id);
  }

  @Post('run-jobs')
  @Roles(Role.ADMIN)
  runJobs() {
    return this.notifications.runNow();
  }
}
