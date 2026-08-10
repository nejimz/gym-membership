import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MembershipStatus, Role } from '@prisma/client';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';

@Controller('members')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MembersController {
  constructor(private members: MembersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  list(
    @Query('q') q?: string,
    @Query('status') status?: MembershipStatus,
  ) {
    return this.members.list(q, status);
  }

  @Get('renewals')
  @Roles(Role.ADMIN, Role.STAFF)
  renewals(@Query('days') days?: string) {
    return this.members.renewalsDue(days ? Number(days) : 30);
  }

  @Get('birthdays')
  @Roles(Role.ADMIN, Role.STAFF)
  birthdays() {
    return this.members.birthdaysThisWeek();
  }

  @Get('me')
  @Roles(Role.MEMBER)
  me(@CurrentUser() user: AuthUser) {
    return this.members.get(user.memberId!, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.members.get(id, user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  create(@Body() dto: CreateMemberDto, @CurrentUser() user: AuthUser) {
    return this.members.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.MEMBER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.members.update(id, dto, user);
  }
}
