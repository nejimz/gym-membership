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
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        memberId: user.member?.id ?? null,
        name: user.member
          ? `${user.member.firstName} ${user.member.lastName}`
          : user.email,
      },
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
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          memberId: user.member?.id ?? null,
          name: user.member
            ? `${user.member.firstName} ${user.member.lastName}`
            : user.email,
        },
        ...tokens,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: { include: { plan: true } } },
    });
    if (!user) throw new BadRequestException('User not found');
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      memberId: user.member?.id ?? null,
      name: user.member
        ? `${user.member.firstName} ${user.member.lastName}`
        : user.email,
      member: user.member,
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
