import { Injectable } from '@nestjs/common';
import { MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';

type ReportMemberRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: MembershipStatus;
  planName: string | null;
  endDate: Date | null;
  lastVisitAt: Date | null;
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekEnd = new Date(startOfToday);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const birthdaysThisWeek = members
      .map((m) => {
        if (!m.dateOfBirth) return null;
        const dob = new Date(m.dateOfBirth);
        const next = new Date(startOfToday.getFullYear(), dob.getMonth(), dob.getDate());
        if (next < startOfToday) {
          next.setFullYear(startOfToday.getFullYear() + 1);
        }
        if (next < startOfToday || next > weekEnd) return null;
        return { ...m, nextBirthday: next };
      })
      .filter((m): m is NonNullable<typeof m> => m != null)
      .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime())
      .map(({ nextBirthday: _next, ...m }) => m);

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
    const closedSessions = recentAttendance.filter((a) => a.checkOutAt);
    const avgSessionMinutes = closedSessions.length
      ? Math.round(
          closedSessions.reduce(
            (sum, a) =>
              sum + (a.checkOutAt!.getTime() - a.checkInAt.getTime()),
            0,
          ) /
            closedSessions.length /
            60_000,
        )
      : null;

    return {
      role: 'MEMBER',
      member,
      kpis: {
        visitsThisMonth,
        streak,
        daysUntilRenewal,
        checkedIn: Boolean(open),
        openSession: open,
        avgSessionMinutes,
      },
      latestMetrics: metrics[0] ?? null,
      metricSeries: [...metrics].reverse(),
      attendanceSeries: this.seriesFromCheckIns(
        recentAttendance.map((a) => a.checkInAt),
        14,
      ),
      recentVisits: recentAttendance.slice(0, 5).map((a) => ({
        id: a.id,
        checkInAt: a.checkInAt,
        checkOutAt: a.checkOutAt,
      })),
      suggestions,
    };
  }

  async attendanceByDay(days = 30) {
    const span = this.clampDays(days);
    const start = this.rangeStartInclusive(span);
    const rows = await this.prisma.attendance.findMany({
      where: { checkInAt: { gte: start } },
      select: { checkInAt: true },
    });
    return this.seriesFromCheckIns(
      rows.map((r) => r.checkInAt),
      span,
    );
  }

  async membershipSummary(days = 30) {
    const span = this.clampDays(days);
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + span);
    const signupStart = this.rangeStartInclusive(span);

    const [activeMembers, expiringRaw, expiredRaw, newMemberRows] = await Promise.all([
      this.prisma.memberProfile.findMany({
        where: { status: MembershipStatus.ACTIVE },
        include: { plan: true },
      }),
      this.prisma.memberProfile.findMany({
        where: {
          status: MembershipStatus.ACTIVE,
          endDate: { gte: now, lte: until },
        },
        include: { plan: true, user: { select: { email: true } } },
        orderBy: { endDate: 'asc' },
      }),
      this.prisma.memberProfile.findMany({
        where: {
          OR: [
            { status: MembershipStatus.EXPIRED },
            { endDate: { lt: now } },
          ],
        },
        include: { plan: true, user: { select: { email: true } } },
        orderBy: { endDate: 'asc' },
      }),
      this.prisma.memberProfile.findMany({
        where: { createdAt: { gte: signupStart } },
        select: { createdAt: true },
      }),
    ]);

    const mixMap = new Map<
      string,
      { planId: string | null; planName: string; count: number; contractedValue: number }
    >();
    for (const m of activeMembers) {
      const key = m.planId ?? 'none';
      const cur = mixMap.get(key) ?? {
        planId: m.planId,
        planName: m.plan?.name ?? 'No plan',
        count: 0,
        contractedValue: 0,
      };
      cur.count += 1;
      cur.contractedValue += Number(m.plan?.price ?? 0);
      mixMap.set(key, cur);
    }
    const planMix = [...mixMap.values()]
      .map((row) => ({
        ...row,
        contractedValue: Math.round(row.contractedValue * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count);

    const newMembersMap = new Map<string, number>();
    for (let i = 0; i < span; i++) {
      const d = new Date(signupStart);
      d.setDate(signupStart.getDate() + i);
      newMembersMap.set(this.localDateKey(d), 0);
    }
    for (const row of newMemberRows) {
      const key = this.localDateKey(row.createdAt);
      if (newMembersMap.has(key)) {
        newMembersMap.set(key, (newMembersMap.get(key) || 0) + 1);
      }
    }

    const followUpIds = [...new Set([...expiringRaw, ...expiredRaw].map((m) => m.id))];
    const lastVisits = await this.lastVisitMap(followUpIds);

    return {
      days: span,
      planMix,
      newMembers: [...newMembersMap.entries()].map(([date, count]) => ({ date, count })),
      expiring: this.toMemberRows(expiringRaw, lastVisits),
      expired: this.toMemberRows(expiredRaw, lastVisits),
    };
  }

  async peakHours(days = 30) {
    const span = this.clampDays(days);
    const start = this.rangeStartInclusive(span);
    const rows = await this.prisma.attendance.findMany({
      where: { checkInAt: { gte: start } },
      select: { checkInAt: true, checkOutAt: true },
    });

    const hourCounts = Array.from({ length: 24 }, () => 0);
    const weekdayCounts = Array.from({ length: 7 }, () => 0);
    let durationSum = 0;
    let closedSessions = 0;

    for (const row of rows) {
      hourCounts[row.checkInAt.getHours()] += 1;
      weekdayCounts[this.mondayBasedWeekday(row.checkInAt)] += 1;
      if (row.checkOutAt && row.checkOutAt > row.checkInAt) {
        durationSum += row.checkOutAt.getTime() - row.checkInAt.getTime();
        closedSessions += 1;
      }
    }

    const avgSessionMinutes =
      closedSessions > 0 ? Math.round(durationSum / closedSessions / 60000) : null;

    return {
      days: span,
      byHour: hourCounts.map((count, hour) => ({
        hour,
        label: this.hourLabel(hour),
        count,
      })),
      byWeekday: weekdayCounts.map((count, index) => ({
        weekday: index,
        label: WEEKDAY_LABELS[index],
        count,
      })),
      avgSessionMinutes,
      closedSessions,
    };
  }

  async inactiveMembers(days = 30) {
    const span = this.clampDays(days);
    const cutoff = this.rangeStartInclusive(span);

    const active = await this.prisma.memberProfile.findMany({
      where: { status: MembershipStatus.ACTIVE },
      include: { plan: true, user: { select: { email: true } } },
    });
    const lastVisits = await this.lastVisitMap(active.map((m) => m.id));
    const members = this.toMemberRows(active, lastVisits)
      .filter((m) => !m.lastVisitAt || m.lastVisitAt < cutoff)
      .sort((a, b) => {
        if (!a.lastVisitAt && !b.lastVisitAt) {
          return a.lastName.localeCompare(b.lastName);
        }
        if (!a.lastVisitAt) return -1;
        if (!b.lastVisitAt) return 1;
        return a.lastVisitAt.getTime() - b.lastVisitAt.getTime();
      });

    return { days: span, members };
  }

  async exportAttendanceCsv(days = 30) {
    const span = this.clampDays(days);
    const start = this.rangeStartInclusive(span);
    const rows = await this.prisma.attendance.findMany({
      where: { checkInAt: { gte: start } },
      include: {
        member: true,
        visitor: true,
        hostedByMember: true,
      },
      orderBy: { checkInAt: 'desc' },
    });
    return this.toCsv(
      ['type', 'name', 'guestOf', 'checkInAt', 'checkOutAt'],
      rows.map((r) => [
        r.type,
        r.member
          ? `${r.member.firstName} ${r.member.lastName}`
          : r.visitor
            ? `${r.visitor.firstName} ${r.visitor.lastName}`
            : '',
        r.hostedByMember
          ? `${r.hostedByMember.firstName} ${r.hostedByMember.lastName}`
          : '',
        r.checkInAt.toISOString(),
        r.checkOutAt?.toISOString() ?? '',
      ]),
    );
  }

  async exportMembersCsv() {
    const members = await this.prisma.memberProfile.findMany({
      include: { plan: true, user: { select: { email: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const lastVisits = await this.lastVisitMap(members.map((m) => m.id));
    return this.toCsv(
      ['name', 'email', 'status', 'plan', 'startDate', 'endDate', 'lastVisit'],
      members.map((m) => [
        `${m.firstName} ${m.lastName}`,
        m.user.email,
        m.status,
        m.plan?.name ?? '',
        m.startDate?.toISOString() ?? '',
        m.endDate?.toISOString() ?? '',
        lastVisits.get(m.id)?.toISOString() ?? '',
      ]),
    );
  }

  async exportRenewalsCsv(days = 30) {
    const summary = await this.membershipSummary(days);
    return this.toCsv(
      ['name', 'email', 'status', 'plan', 'endDate', 'lastVisit', 'bucket'],
      [
        ...summary.expiring.map((m) => this.memberCsvRow(m, 'expiring')),
        ...summary.expired.map((m) => this.memberCsvRow(m, 'expired')),
      ],
    );
  }

  async exportInactiveCsv(days = 30) {
    const { members } = await this.inactiveMembers(days);
    return this.toCsv(
      ['name', 'email', 'status', 'plan', 'endDate', 'lastVisit'],
      members.map((m) => this.memberCsvRow(m)),
    );
  }

  private clampDays(days = 30) {
    if (!Number.isFinite(days) || days < 1) return 30;
    return Math.min(Math.floor(days), 365);
  }

  private startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private rangeStartInclusive(days: number) {
    const start = this.startOfToday();
    start.setDate(start.getDate() - (days - 1));
    return start;
  }

  private localDateKey(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private seriesFromCheckIns(checkIns: Date[], days = 14) {
    const span = this.clampDays(days);
    const start = this.rangeStartInclusive(span);
    const map = new Map<string, number>();
    for (let i = 0; i < span; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      map.set(this.localDateKey(d), 0);
    }
    for (const at of checkIns) {
      const key = this.localDateKey(at);
      if (map.has(key)) {
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return [...map.entries()].map(([date, count]) => ({ date, count }));
  }

  private mondayBasedWeekday(d: Date) {
    return (d.getDay() + 6) % 7;
  }

  private hourLabel(hour: number) {
    const period = hour < 12 ? 'am' : 'pm';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}${period}`;
  }

  private async lastVisitMap(memberIds: string[]) {
    if (!memberIds.length) return new Map<string, Date>();
    const rows = await this.prisma.attendance.groupBy({
      by: ['memberId'],
      where: { memberId: { in: memberIds } },
      _max: { checkInAt: true },
    });
    return new Map(
      rows
        .filter((r): r is typeof r & { memberId: string } => Boolean(r.memberId && r._max.checkInAt))
        .map((r) => [r.memberId, r._max.checkInAt as Date]),
    );
  }

  private toMemberRows(
    members: Array<{
      id: string;
      firstName: string;
      lastName: string;
      status: MembershipStatus;
      endDate: Date | null;
      plan: { name: string } | null;
      user: { email: string };
    }>,
    lastVisits: Map<string, Date>,
  ): ReportMemberRow[] {
    return members.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.user.email,
      status: m.status,
      planName: m.plan?.name ?? null,
      endDate: m.endDate,
      lastVisitAt: lastVisits.get(m.id) ?? null,
    }));
  }

  private memberCsvRow(m: ReportMemberRow, bucket?: string) {
    const row: Array<string | number | null | undefined> = [
      `${m.firstName} ${m.lastName}`,
      m.email,
      m.status,
      m.planName ?? '',
      m.endDate?.toISOString() ?? '',
      m.lastVisitAt?.toISOString() ?? '',
    ];
    if (bucket) row.push(bucket);
    return row;
  }

  private csvCell(value: string | number | null | undefined) {
    const s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  private toCsv(
    headers: string[],
    rows: Array<Array<string | number | null | undefined>>,
  ) {
    return [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => this.csvCell(cell)).join(',')),
    ].join('\n');
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
