import { PrismaClient, Role, MembershipStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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

  const now = new Date();
  const in5 = new Date();
  in5.setDate(now.getDate() + 5);
  const in25 = new Date();
  in25.setDate(now.getDate() + 25);
  const start = new Date();
  start.setDate(now.getDate() - 25);

  const alice = await prisma.user.create({
    data: {
      email: 'alice@gym.local',
      passwordHash,
      role: Role.MEMBER,
      member: {
        create: {
          firstName: 'Alice',
          lastName: 'Nguyen',
          phone: '555-0101',
          dateOfBirth: new Date(1994, now.getMonth(), now.getDate()),
          emergencyContact: 'Bob Nguyen 555-0199',
          status: MembershipStatus.ACTIVE,
          planId: plus.id,
          startDate: start,
          endDate: in5,
        },
      },
    },
    include: { member: true },
  });

  const carlos = await prisma.user.create({
    data: {
      email: 'carlos@gym.local',
      passwordHash,
      role: Role.MEMBER,
      member: {
        create: {
          firstName: 'Carlos',
          lastName: 'Diaz',
          phone: '555-0102',
          dateOfBirth: new Date(1990, 5, 15),
          status: MembershipStatus.ACTIVE,
          planId: basic.id,
          startDate: start,
          endDate: in25,
        },
      },
    },
    include: { member: true },
  });

  const dana = await prisma.user.create({
    data: {
      email: 'dana@gym.local',
      passwordHash,
      role: Role.MEMBER,
      member: {
        create: {
          firstName: 'Dana',
          lastName: 'Park',
          phone: '555-0103',
          dateOfBirth: new Date(1988, 2, 20),
          status: MembershipStatus.ACTIVE,
          planId: elite.id,
          startDate: new Date(now.getFullYear(), 0, 1),
          endDate: new Date(now.getFullYear(), 11, 31),
        },
      },
    },
    include: { member: true },
  });

  // Sample attendance
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(8 + (i % 5), 0, 0, 0);
    const out = new Date(d);
    out.setHours(d.getHours() + 1);
    await prisma.attendance.create({
      data: {
        memberId: alice.member!.id,
        checkInAt: d,
        checkOutAt: i === 0 ? null : out,
        recordedById: staff.id,
      },
    });
  }

  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * 2);
    d.setHours(18, 0, 0, 0);
    const out = new Date(d);
    out.setHours(19, 30, 0, 0);
    await prisma.attendance.create({
      data: {
        memberId: carlos.member!.id,
        checkInAt: d,
        checkOutAt: out,
        recordedById: staff.id,
      },
    });
  }

  // Body metrics for Alice
  const weights = [68.2, 67.9, 67.5, 67.4, 67.3, 67.2];
  for (let i = 0; i < weights.length; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (weights.length - i) * 7);
    await prisma.bodyMetric.create({
      data: {
        memberId: alice.member!.id,
        recordedAt: d,
        weightKg: weights[i],
        bodyFatPct: 24 - i * 0.2,
        waistCm: 72 - i * 0.3,
        chestCm: 88,
        notes: i === weights.length - 1 ? 'Feeling stronger' : null,
      },
    });
  }

  console.log('Seed complete');
  console.log('Logins (password: password123):');
  console.log('  admin@gym.local  (ADMIN)');
  console.log('  staff@gym.local  (STAFF)');
  console.log('  alice@gym.local  (MEMBER)');
  console.log('  carlos@gym.local (MEMBER)');
  console.log('  dana@gym.local   (MEMBER)');
  console.log(`Admin id: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
