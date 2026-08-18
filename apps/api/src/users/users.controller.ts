import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('role') role?: Role,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.users.list(
      q,
      role,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 25,
    );
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.update(id, dto, user);
  }
}
