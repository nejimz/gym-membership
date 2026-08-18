import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { member: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; role: string }>(
        refreshToken,
        { secret: this.config.get('JWT_REFRESH_SECRET') },
      );
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { member: true },
      });
      if (!user) throw new UnauthorizedException();
      const tokens = await this.issueTokens(user.id, user.email, user.role);
      return {
        user: this.toPublicUser(user),
        ...tokens,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'PASSWORD_CHANGE',
        entityType: 'User',
        entityId: userId,
      },
    });

    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: { include: { plan: true } } },
    });
    if (!user) throw new BadRequestException('User not found');
    return {
      ...this.toPublicUser(user),
      member: user.member,
    };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    role: string;
    member?: {
      id: string;
      firstName: string;
      lastName: string;
      photoUrl?: string | null;
    } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      memberId: user.member?.id ?? null,
      name: user.member
        ? `${user.member.firstName} ${user.member.lastName}`
        : user.email,
      photoUrl: user.member?.photoUrl ?? null,
    };
  }

  private async issueTokens(sub: string, email: string, role: string) {
    const payload = { sub, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
