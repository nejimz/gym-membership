-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('MEMBER', 'VISITOR');

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "type" "AttendanceType" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN "visitorId" TEXT,
ADD COLUMN "hostedByMemberId" TEXT,
ALTER COLUMN "memberId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Visitor_lastName_firstName_idx" ON "Visitor"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Visitor_phone_idx" ON "Visitor"("phone");

-- CreateIndex
CREATE INDEX "Attendance_visitorId_checkInAt_idx" ON "Attendance"("visitorId", "checkInAt");

-- CreateIndex
CREATE INDEX "Attendance_hostedByMemberId_idx" ON "Attendance"("hostedByMemberId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_hostedByMemberId_fkey" FOREIGN KEY ("hostedByMemberId") REFERENCES "MemberProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
