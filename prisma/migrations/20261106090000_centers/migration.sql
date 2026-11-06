-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "centerId" TEXT;

-- AlterTable
ALTER TABLE "Beneficiary" ADD COLUMN     "centerId" TEXT;

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "centerId" TEXT;

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "centerId" TEXT;

-- CreateTable
CREATE TABLE "Center" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterProject" (
    "centerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "CenterProject_pkey" PRIMARY KEY ("centerId","projectId")
);

-- CreateTable
CREATE TABLE "CenterTransfer" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "fromCenterId" TEXT NOT NULL,
    "toCenterId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "CenterTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Center_code_key" ON "Center"("code");

-- CreateIndex
CREATE INDEX "CenterTransfer_status_createdAt_idx" ON "CenterTransfer"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CenterTransfer_beneficiaryId_idx" ON "CenterTransfer"("beneficiaryId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterProject" ADD CONSTRAINT "CenterProject_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterProject" ADD CONSTRAINT "CenterProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterTransfer" ADD CONSTRAINT "CenterTransfer_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterTransfer" ADD CONSTRAINT "CenterTransfer_fromCenterId_fkey" FOREIGN KEY ("fromCenterId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterTransfer" ADD CONSTRAINT "CenterTransfer_toCenterId_fkey" FOREIGN KEY ("toCenterId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

