import {
  PrismaClient,
  Role,
  MembershipStatus,
  NotificationType,
  Sex,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const MEMBER_COUNT = 1000;
const USER_BATCH = 500;
const BATCH_SIZE = 2000;
const YEAR_DAYS = 365;
const OPEN_SESSIONS_TODAY = 10;
const STREAK_MEMBER_COUNT = 25;

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn',
  'Jamie', 'Reese', 'Cameron', 'Drew', 'Blake', 'Hayden', 'Parker', 'Sage',
  'Rowan', 'Finley', 'Skyler', 'Emerson', 'Kai', 'Noah', 'Mia', 'Luna',
  'Sofia', 'Leo', 'Elena', 'Marcus', 'Priya', 'Omar',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function createManyInBatches<T>(
  items: T[],
  batchSize: number,
  insert: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    await insert(items.slice(i, i + batchSize));
  }
}

async function main() {
  await prisma.notification.deleteMany();
  await prisma.bodyMetric.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.memberProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.membershipPlan.deleteMany();

  await prisma.appSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      companyName: 'Ironleaf Gym',
      currency: 'PHP',
      logoUrl: null,
      faviconUrl: null,
    },
  });

  const [basic, plus, elite] = await Promise.all([
    prisma.membershipPlan.create({
      data: {
        name: 'Basic Monthly',
        durationDays: 30,
        price: 29.99,
        description: 'Gym floor access',
      },
    }),
    prisma.membershipPlan.create({
      data: {
        name: 'Plus Quarterly',
        durationDays: 90,
        price: 79.99,
        description: 'Gym + classes',
      },
    }),
    prisma.membershipPlan.create({
      data: {
        name: 'Elite Annual',
        durationDays: 365,
        price: 299.99,
        description: 'All access + guest passes',
      },
    }),
  ]);

  const plans = [basic, plus, elite];
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@gym.local',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const staff = await prisma.user.create({
    data: {
      email: 'staff@gym.local',
      passwordHash,
      role: Role.STAFF,
    },
  });

  await prisma.user.create({
    data: {
      email: 'admin2@gym.local',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      email: 'staff2@gym.local',
      passwordHash,
      role: Role.STAFF,
    },
  });

  const now = new Date();
  const today = startOfDay(now);
  const yearStart = addDays(today, -YEAR_DAYS);

  type MemberMeta = {
    index: number;
    userId: string;
    memberId: string;
    firstName: string;
    lastName: string;
    status: MembershipStatus;
    startDate: Date;
    endDate: Date;
    visitsPerWeek: number;
    dateOfBirth: Date;
  };

  const users: Prisma.UserCreateManyInput[] = [];
  const profiles: Prisma.MemberProfileCreateManyInput[] = [];
  const memberMeta: MemberMeta[] = [];

  for (let i = 1; i <= MEMBER_COUNT; i++) {
    const userId = randomUUID();
    const memberId = randomUUID();
    const plan = plans[(i - 1) % plans.length];
    const firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[Math.floor((i - 1) / FIRST_NAMES.length) % LAST_NAMES.length];

    let status: MembershipStatus = MembershipStatus.ACTIVE;
    const bucket = i % 100;
    if (bucket < 7) status = MembershipStatus.EXPIRED;
    else if (bucket < 10) status = MembershipStatus.SUSPENDED;

    // Stagger start dates over the past year
    const startOffset = (i * 37) % YEAR_DAYS;
    const startDate = startOfDay(addDays(today, -startOffset));

    let endDate: Date;
    if (status === MembershipStatus.EXPIRED) {
      endDate = startOfDay(addDays(today, -1 - (i % 90)));
    } else if (status === MembershipStatus.SUSPENDED) {
      endDate = startOfDay(addDays(today, 30 + (i % 60)));
    } else {
      // ~3% renew in 7d (i % 100 === 10..12), ~10% in 30d (i % 100 === 10..19)
      const renewBucket = i % 100;
      if (renewBucket >= 10 && renewBucket <= 12) {
        endDate = startOfDay(addDays(today, 1 + (i % 7)));
      } else if (renewBucket >= 13 && renewBucket <= 19) {
        endDate = startOfDay(addDays(today, 8 + (i % 22)));
      } else {
        endDate = addDays(startDate, plan.durationDays);
        while (endDate < today) {
          endDate = addDays(endDate, plan.durationDays);
        }
        // Push some further out so not everyone renews soon
        if (renewBucket >= 50) {
          endDate = addDays(endDate, plan.durationDays);
        }
      }
    }

    // DOB: pin first 5 to today, next 20 into next 7 days; rest spread
    let dateOfBirth: Date;
    if (i <= 5) {
      dateOfBirth = new Date(1985 + (i % 20), today.getMonth(), today.getDate());
    } else if (i <= 25) {
      const upcoming = addDays(today, ((i - 6) % 7) + 1);
      dateOfBirth = new Date(1988 + (i % 20), upcoming.getMonth(), upcoming.getDate());
    } else {
      dateOfBirth = new Date(1985 + (i % 25), i % 12, (i % 28) + 1);
    }

    const emergencyContact =
      i % 10 < 7 ? `${LAST_NAMES[(i + 3) % LAST_NAMES.length]} 555-${String(2000 + (i % 7000)).padStart(4, '0')}` : null;

    users.push({
      id: userId,
      email: `member${String(i).padStart(4, '0')}@gym.local`,
      passwordHash,
      role: Role.MEMBER,
      createdAt: startDate,
    });

    const sex = i % 2 === 0 ? Sex.MALE : Sex.FEMALE;
    const heightCm =
      sex === Sex.MALE
        ? Math.round((168 + (i % 20) + (i % 7) * 0.1) * 10) / 10
        : Math.round((155 + (i % 18) + (i % 5) * 0.1) * 10) / 10;

    profiles.push({
      id: memberId,
      userId,
      firstName,
      lastName,
      phone: `555-${String(1000 + (i % 9000)).padStart(4, '0')}`,
      dateOfBirth,
      emergencyContact,
      heightCm,
      sex,
      status,
      planId: plan.id,
      startDate,
      endDate,
      createdAt: startDate,
    });

    memberMeta.push({
      index: i,
      userId,
      memberId,
      firstName,
      lastName,
      status,
      startDate,
      endDate,
      visitsPerWeek: 2 + ((i - 1) % 3),
      dateOfBirth,
    });
  }

  await createManyInBatches(users, USER_BATCH, (batch) =>
    prisma.user.createMany({ data: batch }),
  );
  await createManyInBatches(profiles, USER_BATCH, (batch) =>
    prisma.memberProfile.createMany({ data: batch }),
  );

  // --- Attendance (through today, some open sessions, streak members) ---
  let attendanceCount = 0;
  let attendanceBatch: Prisma.AttendanceCreateManyInput[] = [];
  const todayOpenCandidates: { memberId: string; checkInAt: Date }[] = [];
  const streakMemberIds = new Set(
    memberMeta
      .filter((m) => m.status === MembershipStatus.ACTIVE)
      .slice(0, STREAK_MEMBER_COUNT)
      .map((m) => m.memberId),
  );

  const flushAttendance = async () => {
    if (attendanceBatch.length === 0) return;
    await prisma.attendance.createMany({ data: attendanceBatch });
    attendanceCount += attendanceBatch.length;
    attendanceBatch = [];
  };

  const pushAttendance = async (row: Prisma.AttendanceCreateManyInput) => {
    attendanceBatch.push(row);
    if (attendanceBatch.length >= BATCH_SIZE) await flushAttendance();
  };

  for (const meta of memberMeta) {
    const effectiveEnd =
      meta.status === MembershipStatus.EXPIRED
        ? meta.endDate
        : today;

    const rangeStart = meta.startDate > yearStart ? meta.startDate : yearStart;
    if (rangeStart > effectiveEnd) continue;

    for (let dayOffset = 0; dayOffset <= YEAR_DAYS; dayOffset++) {
      const day = startOfDay(addDays(yearStart, dayOffset));
      if (day < rangeStart || day > effectiveEnd) continue;
      if (day > today) continue;

      const dayOfWeek = day.getDay();
      const weekSeed = Math.floor(dayOffset / 7);
      const memberSeed = meta.index * 17;
      const slot = (memberSeed + weekSeed * 3 + dayOfWeek * 11) % 7;
      let shouldVisit = slot < meta.visitsPerWeek;

      // Force streak members to visit yesterday + today
      const isToday = day.getTime() === today.getTime();
      const isYesterday = day.getTime() === addDays(today, -1).getTime();
      if (streakMemberIds.has(meta.memberId) && (isToday || isYesterday)) {
        shouldVisit = true;
      }

      if (dayOfWeek === 0 && (memberSeed + weekSeed) % 3 === 0 && !streakMemberIds.has(meta.memberId)) {
        shouldVisit = false;
      }
      if (!shouldVisit) continue;

      const hour = 6 + ((memberSeed + dayOffset) % 16);
      const minute = ((memberSeed + dayOffset * 7) % 4) * 15;
      const checkInAt = new Date(day);
      checkInAt.setHours(hour, minute, 0, 0);

      const durationMin = 45 + ((memberSeed + dayOffset) % 6) * 15;
      let checkOutAt: Date | null = new Date(checkInAt.getTime() + durationMin * 60_000);

      if (isToday && meta.status === MembershipStatus.ACTIVE) {
        todayOpenCandidates.push({ memberId: meta.memberId, checkInAt });
      }

      await pushAttendance({
        id: randomUUID(),
        memberId: meta.memberId,
        checkInAt,
        checkOutAt,
        recordedById: staff.id,
      });
    }
  }

  await flushAttendance();

  // Mark ~10 of today's sessions as open (null checkOutAt) via update
  const openTargets = todayOpenCandidates.slice(0, OPEN_SESSIONS_TODAY);
  for (const target of openTargets) {
    await prisma.attendance.updateMany({
      where: {
        memberId: target.memberId,
        checkInAt: target.checkInAt,
      },
      data: { checkOutAt: null },
    });
  }

  // --- Body metrics (~1 year) ---
  let bodyMetricCount = 0;
  let metricBatch: Prisma.BodyMetricCreateManyInput[] = [];

  const flushMetrics = async () => {
    if (metricBatch.length === 0) return;
    await prisma.bodyMetric.createMany({ data: metricBatch });
    bodyMetricCount += metricBatch.length;
    metricBatch = [];
  };

  for (const meta of memberMeta) {
    if (meta.status === MembershipStatus.SUSPENDED) continue;

    const metricEnd =
      meta.status === MembershipStatus.EXPIRED ? meta.endDate : today;
    const metricStart = meta.startDate;
    if (metricStart > metricEnd) continue;

    const baseWeight = 55 + (meta.index % 45) + (meta.index % 10) * 0.1;
    const losing = meta.index % 2 === 0;
    let point = 0;

    for (let d = 0; ; d += 30) {
      const recordedAt = startOfDay(addDays(metricStart, d));
      if (recordedAt > metricEnd) break;

      const drift = (losing ? -1 : 1) * (point * 0.15 + (meta.index % 5) * 0.02);
      const weightKg = Math.round((baseWeight + drift) * 10) / 10;
      const bodyFatPct = Math.round((22 + (meta.index % 12) + drift * 0.3) * 10) / 10;
      const waistCm = Math.round((70 + (meta.index % 20) + drift * 0.4) * 10) / 10;
      const includeExtra = point % 2 === 0;

      const neckCm = Math.round((34 + (meta.index % 8) + drift * 0.05) * 10) / 10;
      const thighsCm = Math.round((50 + (meta.index % 12) + drift * 0.1) * 10) / 10;
      const restingHrBpm = 58 + (meta.index % 18) - Math.round(point * 0.2);
      const leanMassKg =
        Math.round(weightKg * (1 - bodyFatPct / 100) * 10) / 10;

      metricBatch.push({
        id: randomUUID(),
        memberId: meta.memberId,
        recordedAt,
        weightKg,
        bodyFatPct,
        waistCm,
        chestCm: includeExtra ? 85 + (meta.index % 15) : null,
        hipsCm: includeExtra ? 90 + (meta.index % 12) : null,
        armsCm: includeExtra ? 28 + (meta.index % 8) : null,
        thighsCm: includeExtra ? thighsCm : null,
        neckCm,
        restingHrBpm: includeExtra ? Math.max(48, restingHrBpm) : null,
        leanMassKg: point % 3 === 0 ? leanMassKg : null,
        notes: point % 10 === 0 ? (losing ? 'Feeling lighter' : 'Building strength') : null,
      });
      point += 1;

      if (metricBatch.length >= BATCH_SIZE) await flushMetrics();
    }
  }

  await flushMetrics();

  // --- Notifications (~1 year) ---
  let notificationCount = 0;
  let notifBatch: Prisma.NotificationCreateManyInput[] = [];

  const flushNotifs = async () => {
    if (notifBatch.length === 0) return;
    await prisma.notification.createMany({ data: notifBatch });
    notificationCount += notifBatch.length;
    notifBatch = [];
  };

  const pushNotif = async (row: Prisma.NotificationCreateManyInput) => {
    notifBatch.push(row);
    if (notifBatch.length >= BATCH_SIZE) await flushNotifs();
  };

  const readIfOlder = (createdAt: Date): Date | null => {
    const ageDays = Math.floor((today.getTime() - startOfDay(createdAt).getTime()) / 86_400_000);
    return ageDays > 14 ? addDays(createdAt, 1) : null;
  };

  // RENEWAL: members with endDate within next 30 days + historical renewals
  const renewingSoon = memberMeta.filter(
    (m) =>
      m.status === MembershipStatus.ACTIVE &&
      m.endDate >= today &&
      m.endDate <= addDays(today, 30),
  );

  for (const m of renewingSoon) {
    const daysLeft = Math.max(
      1,
      Math.ceil((m.endDate.getTime() - today.getTime()) / 86_400_000),
    );
    const createdAt = addDays(today, -Math.min(daysLeft, 7));
    await pushNotif({
      id: randomUUID(),
      userId: m.userId,
      type: NotificationType.RENEWAL,
      title: 'Membership renewing soon',
      body: `Hi ${m.firstName}, your membership ends in ${daysLeft} day(s).`,
      meta: { memberId: m.memberId, endDate: m.endDate.toISOString() },
      readAt: null,
      emailSent: false,
      createdAt,
    });
  }

  // Historical renewals over the year (~200 more)
  for (let i = 0; i < 200; i++) {
    const m = memberMeta[i * 3 + 30];
    if (!m) break;
    const createdAt = addDays(today, -(20 + (i * 1.7) % 340));
    await pushNotif({
      id: randomUUID(),
      userId: m.userId,
      type: NotificationType.RENEWAL,
      title: 'Membership renewing soon',
      body: `Hi ${m.firstName}, renew to keep uninterrupted access.`,
      meta: { memberId: m.memberId },
      readAt: readIfOlder(createdAt),
      emailSent: i % 3 === 0,
      createdAt,
    });
  }

  // Staff renewal digests (~30)
  for (let i = 0; i < 30; i++) {
    const createdAt = addDays(today, -(i * 12));
    await pushNotif({
      id: randomUUID(),
      userId: staff.id,
      type: NotificationType.RENEWAL,
      title: 'Renewals due this week',
      body: `${8 + (i % 15)} members need renewal follow-up.`,
      meta: { digest: true },
      readAt: i < 3 ? null : readIfOlder(createdAt),
      emailSent: true,
      createdAt,
    });
  }

  // BIRTHDAY notifications
  const birthdaySoon = memberMeta.filter((m) => {
    const next = new Date(today.getFullYear(), m.dateOfBirth.getMonth(), m.dateOfBirth.getDate());
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    const diff = (next.getTime() - today.getTime()) / 86_400_000;
    return diff >= 0 && diff <= 7;
  });

  for (const m of birthdaySoon) {
    await pushNotif({
      id: randomUUID(),
      userId: m.userId,
      type: NotificationType.BIRTHDAY,
      title: 'Happy birthday!',
      body: `Celebrate with us, ${m.firstName}! Enjoy your special day.`,
      meta: { memberId: m.memberId },
      readAt: null,
      createdAt: today,
    });
  }

  for (let i = 0; i < 120; i++) {
    const m = memberMeta[i * 5 + 10];
    if (!m) break;
    const createdAt = addDays(today, -(5 + (i * 2.8) % 350));
    await pushNotif({
      id: randomUUID(),
      userId: m.userId,
      type: NotificationType.BIRTHDAY,
      title: 'Happy birthday!',
      body: `Happy birthday, ${m.firstName}!`,
      meta: { memberId: m.memberId },
      readAt: readIfOlder(createdAt),
      emailSent: i % 2 === 0,
      createdAt,
    });
  }

  for (let i = 0; i < 20; i++) {
    const createdAt = addDays(today, -(i * 18));
    await pushNotif({
      id: randomUUID(),
      userId: i % 2 === 0 ? staff.id : admin.id,
      type: NotificationType.BIRTHDAY,
      title: 'Member birthdays this week',
      body: `${3 + (i % 8)} members have birthdays coming up.`,
      readAt: i < 2 ? null : readIfOlder(createdAt),
      createdAt,
    });
  }

  // SYSTEM (~40)
  for (let i = 0; i < 40; i++) {
    const createdAt = addDays(today, -(i * 9));
    const target =
      i % 5 === 0 ? admin.id : i % 5 === 1 ? staff.id : memberMeta[i * 20]?.userId ?? staff.id;
    await pushNotif({
      id: randomUUID(),
      userId: target,
      type: NotificationType.SYSTEM,
      title: i % 2 === 0 ? 'Hours updated' : 'Welcome to Ironleaf Gym',
      body:
        i % 2 === 0
          ? 'Weekend hours are now 7am–8pm.'
          : 'Thanks for joining. Check in at the front desk anytime.',
      readAt: readIfOlder(createdAt),
      createdAt,
    });
  }

  // SUGGESTION (~60)
  for (let i = 0; i < 60; i++) {
    const m = memberMeta[i * 7];
    if (!m) break;
    const createdAt = addDays(today, -(i * 6));
    await pushNotif({
      id: randomUUID(),
      userId: m.userId,
      type: NotificationType.SUGGESTION,
      title: 'Training tip',
      body:
        i % 2 === 0
          ? 'Try adding one extra mobility session this week.'
          : 'Your check-ins look strong — consider a progress weigh-in.',
      meta: { memberId: m.memberId },
      readAt: i < 10 ? null : readIfOlder(createdAt),
      createdAt,
    });
  }

  await flushNotifs();

  // --- Audit logs (~1 year) ---
  let auditCount = 0;
  let auditBatch: Prisma.AuditLogCreateManyInput[] = [];

  const flushAudits = async () => {
    if (auditBatch.length === 0) return;
    await prisma.auditLog.createMany({ data: auditBatch });
    auditCount += auditBatch.length;
    auditBatch = [];
  };

  for (const m of memberMeta) {
    auditBatch.push({
      id: randomUUID(),
      actorId: m.index % 2 === 0 ? staff.id : admin.id,
      action: 'MEMBER_CREATE',
      entityType: 'MemberProfile',
      entityId: m.memberId,
      meta: { email: `member${String(m.index).padStart(4, '0')}@gym.local` },
      createdAt: m.startDate,
    });
    if (auditBatch.length >= BATCH_SIZE) await flushAudits();
  }

  for (let i = 0; i < 300; i++) {
    const m = memberMeta[i * 3 + 1];
    if (!m) break;
    const createdAt = addDays(m.startDate, 7 + (i % 200));
    if (createdAt > today) continue;
    auditBatch.push({
      id: randomUUID(),
      actorId: i % 3 === 0 ? admin.id : staff.id,
      action: 'MEMBER_UPDATE',
      entityType: 'MemberProfile',
      entityId: m.memberId,
      meta: {
        fields: i % 2 === 0 ? ['endDate', 'planId'] : ['phone', 'status'],
      },
      createdAt,
    });
    if (auditBatch.length >= BATCH_SIZE) await flushAudits();
  }

  await flushAudits();

  console.log('Seed complete');
  console.log(`Members: ${MEMBER_COUNT}`);
  console.log(`Attendances: ${attendanceCount}`);
  console.log(`Body metrics: ${bodyMetricCount}`);
  console.log(`Notifications: ${notificationCount}`);
  console.log(`Audit logs: ${auditCount}`);
  console.log(`Open sessions today (target): ${openTargets.length}`);
  console.log('Logins (password: password123):');
  console.log('  admin@gym.local  (ADMIN)');
  console.log('  admin2@gym.local (ADMIN)');
  console.log('  staff@gym.local  (STAFF)');
  console.log('  staff2@gym.local (STAFF)');
  console.log('  member0001@gym.local … member1000@gym.local (MEMBER)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
