import { Injectable } from '@nestjs/common';
import { MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async dashboard(actor: AuthUser) {
    if (actor.role === Role.MEMBER) {
      return this.memberDashboard(actor.memberId!);
    }
    return this.staffDashboard();
  }

  private async staffDashboard() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);

    const [
      activeMembers,
      checkInsToday,
      renewals7,
      renewals30,
      openSessions,
      statusGroups,
      plans,
    ] = await Promise.all([
      this.prisma.memberProfile.count({ where: { status: MembershipStatus.ACTIVE } }),
      this.prisma.attendance.count({ where: { checkInAt: { gte: start } } }),
      this.prisma.memberProfile.count({
        where: {
          status: MembershipStatus.ACTIVE,
          endDate: { gte: new Date(), lte: in7 },
        },
      }),
      this.prisma.memberProfile.count({
        where: {
          status: MembershipStatus.ACTIVE,
          endDate: { gte: new Date(), lte: in30 },
        },
      }),
      this.prisma.attendance.count({ where: { checkOutAt: null } }),
      this.prisma.memberProfile.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.memberProfile.findMany({
        where: { status: MembershipStatus.ACTIVE, planId: { not: null } },
        include: { plan: true },
      }),
    ]);

    const revenueSnapshot = plans.reduce((sum, m) => {
      return sum + Number(m.plan?.price ?? 0);
    }, 0);

    const members = await this.prisma.memberProfile.findMany({
      where: { dateOfBirth: { not: null } },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
    });
    const today = new Date();
    const weekEnd = new Date();
    weekEnd.setDate(today.getDate() + 7);
    const birthdaysThisWeek = members.filter((m) => {
      if (!m.dateOfBirth) return false;
      const dob = new Date(m.dateOfBirth);
      const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        next.setFullYear(today.getFullYear() + 1);
      }
      return next >= today && next <= weekEnd;
    });

    const attendanceSeries = await this.attendanceByDay(14);

    return {
      role: 'STAFF',
      kpis: {
        activeMembers,
        checkInsToday,
        renewals7,
        renewals30,
        openSessions,
        birthdaysThisWeek: birthdaysThisWeek.length,
        revenueSnapshot,
      },
      statusMix: statusGroups.map((g) => ({
        status: g.status,
        count: g._count._all,
      })),
      attendanceSeries,
      birthdays: birthdaysThisWeek,
      suggestions: [
        renewals7 > 0
          ? `${renewals7} membership(s) renew within 7 days — follow up today.`
          : null,
        checkInsToday < Math.max(5, Math.floor(activeMembers * 0.1))
          ? 'Visit volume is soft today — consider a walk-in promo or class reminder.'
          : null,
        birthdaysThisWeek.length > 0
          ? `${birthdaysThisWeek.length} birthday(s) this week — send a greeting.`
          : null,
      ].filter(Boolean),
    };
  }

  private async memberDashboard(memberId: string) {
    const member = await this.prisma.memberProfile.findUnique({
      where: { id: memberId },
      include: { plan: true },
    });
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [visitsThisMonth, open, metrics, recentAttendance] = await Promise.all([
      this.prisma.attendance.count({
        where: { memberId, checkInAt: { gte: monthStart } },
      }),
      this.prisma.attendance.findFirst({
        where: { memberId, checkOutAt: null },
      }),
      this.prisma.bodyMetric.findMany({
        where: { memberId },
        orderBy: { recordedAt: 'desc' },
        take: 8,
      }),
      this.prisma.attendance.findMany({
        where: { memberId },
        orderBy: { checkInAt: 'desc' },
        take: 30,
      }),
    ]);

    const daysUntilRenewal = member?.endDate
      ? Math.ceil(
          (new Date(member.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )
      : null;

    const streak = this.calcStreak(recentAttendance.map((a) => a.checkInAt));
    const suggestions = this.memberSuggestions(
      visitsThisMonth,
      daysUntilRenewal,
      metrics,
    );

    return {
      role: 'MEMBER',
      member,
      kpis: {
        visitsThisMonth,
        streak,
        daysUntilRenewal,
        checkedIn: Boolean(open),
        openSession: open,
      },
      latestMetrics: metrics[0] ?? null,
      metricSeries: [...metrics].reverse(),
      suggestions,
    };
  }

  async attendanceByDay(days = 30) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const rows = await this.prisma.attendance.findMany({
      where: { checkInAt: { gte: start } },
      select: { checkInAt: true },
    });
    const map = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of rows) {
      const key = new Date(r.checkInAt).toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].map(([date, count]) => ({ date, count }));
  }

  async exportAttendanceCsv(days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const rows = await this.prisma.attendance.findMany({
      where: { checkInAt: { gte: start } },
      include: { member: true },
      orderBy: { checkInAt: 'desc' },
    });
    const header = 'member,checkInAt,checkOutAt\n';
    const body = rows
      .map((r) => {
        const name = `${r.member.firstName} ${r.member.lastName}`;
        return `"${name}",${r.checkInAt.toISOString()},${r.checkOutAt?.toISOString() ?? ''}`;
      })
      .join('\n');
    return header + body;
  }

  private calcStreak(checkIns: Date[]) {
    if (!checkIns.length) return 0;
    const days = new Set(
      checkIns.map((d) => new Date(d).toISOString().slice(0, 10)),
    );
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    // Allow today or yesterday as start
    const todayKey = cursor.toISOString().slice(0, 10);
    if (!days.has(todayKey)) {
      cursor.setDate(cursor.getDate() - 1);
      if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
    }
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  private memberSuggestions(
    visitsThisMonth: number,
    daysUntilRenewal: number | null,
    metrics: { weightKg: number | null; recordedAt: Date }[],
  ) {
    const tips: string[] = [];
    const weeksElapsed = Math.max(1, new Date().getDate() / 7);
    const weeklyRate = visitsThisMonth / weeksElapsed;
    if (weeklyRate < 3) {
      tips.push('Aim for at least 3 visits per week to stay consistent.');
    }
    if (daysUntilRenewal !== null && daysUntilRenewal <= 7 && daysUntilRenewal >= 0) {
      tips.push('Your membership renews soon — talk to the front desk to renew.');
    }
    if (metrics.length >= 3) {
      const weights = metrics
        .filter((m) => m.weightKg != null)
        .map((m) => m.weightKg as number)
        .slice(0, 3);
      if (weights.length === 3) {
        const delta = Math.abs(weights[0] - weights[2]);
        if (delta < 0.5) {
          tips.push(
            'Weight looks steady across recent logs — review training or nutrition with a coach.',
          );
        }
      }
    }
    if (!tips.length) {
      tips.push('Great momentum — keep logging workouts and body metrics.');
    }
    return tips;
  }
}
