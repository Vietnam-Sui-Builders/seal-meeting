-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('scheduled', 'active', 'ended');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "description" TEXT,
ADD COLUMN     "hostCapId" VARCHAR(128),
ADD COLUMN     "maxParticipants" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "status" "RoomStatus" NOT NULL DEFAULT 'scheduled';

-- CreateIndex
CREATE INDEX "Room_hostCapId_idx" ON "Room"("hostCapId");

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");
