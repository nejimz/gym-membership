import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MembershipStatus, NotificationType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private async createAndEmail(params: {
    userId: string;
    email: string;
    type: NotificationType;
    title: string;
    body: string;
    meta?: object;
  }) {
    const existing = await this.prisma.notification.findFirst({
      where: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });
    if (existing) return existing;

    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        meta: params.meta,
      },
    });

    const sent = await this.mail.send(params.email, params.title, params.body);
    if (sent) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true },
      });
    }
    return notification;
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailyJobs() {
    this.logger.log('Running renewal & birthday notification jobs');
    await Promise.all([this.notifyRenewals(), this.notifyBirthdays()]);
  }

  async notifyRenewals() {
    const windows = [7, 3, 1];
    for (const days of windows) {
      const target = new Date();
      target.setHours(0, 0, 0, 0);
      target.setDate(target.getDate() + days);
      const next = new Date(target);
      next.setDate(next.getDate() + 1);

      const members = await this.prisma.memberProfile.findMany({
        where: {
          status: MembershipStatus.ACTIVE,
          endDate: { gte: target, lt: next },
        },
        include: { user: true, plan: true },
      });

      for (const m of members) {
        await this.createAndEmail({
          userId: m.userId,
          email: m.user.email,
          type: NotificationType.RENEWAL,
          title: `Membership renews in ${days} day(s)`,
          body: `Hi ${m.firstName}, your ${m.plan?.name ?? 'membership'} ends on ${m.endDate?.toDateString()}. Please renew at the front desk.`,
          meta: { days, memberId: m.id },
        });
      }

      if (members.length) {
        const staff = await this.prisma.user.findMany({
          where: { role: { in: [Role.ADMIN, Role.STAFF] } },
        });
        const names = members.map((m) => `${m.firstName} ${m.lastName}`).join(', ');
        for (const s of staff) {
          await this.createAndEmail({
            userId: s.id,
            email: s.email,
            type: NotificationType.RENEWAL,
            title: `${members.length} renewal(s) in ${days} day(s)`,
            body: `Follow up with: ${names}`,
            meta: { days, count: members.length },
          });
        }
      }
    }
  }

  async notifyBirthdays() {
    const members = await this.prisma.memberProfile.findMany({
      where: { dateOfBirth: { not: null } },
      include: { user: true },
    });
    const today = new Date();
    const birthdayMembers = members.filter((m) => {
      if (!m.dateOfBirth) return false;
      const dob = new Date(m.dateOfBirth);
      return (
        dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate()
      );
    });

    for (const m of birthdayMembers) {
      await this.createAndEmail({
        userId: m.userId,
        email: m.user.email,
        type: NotificationType.BIRTHDAY,
        title: 'Happy Birthday!',
        body: `Happy birthday, ${m.firstName}! Enjoy a great workout on us today.`,
        meta: { memberId: m.id },
      });
    }

    if (birthdayMembers.length) {
      const staff = await this.prisma.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.STAFF] } },
      });
      const names = birthdayMembers
        .map((m) => `${m.firstName} ${m.lastName}`)
        .join(', ');
      for (const s of staff) {
        await this.createAndEmail({
          userId: s.id,
          email: s.email,
          type: NotificationType.BIRTHDAY,
          title: `Birthdays today (${birthdayMembers.length})`,
          body: `Wish a happy birthday to: ${names}`,
          meta: { count: birthdayMembers.length },
        });
      }
    }
  }

  /** Manual trigger for local testing */
  async runNow() {
    await this.notifyRenewals();
    await this.notifyBirthdays();
    return { ok: true };
  }
}
