-- AlterTable
ALTER TABLE "TournamentParticipant" ADD COLUMN     "prizeClaimed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prizeClaimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "profileImage" TEXT,
ADD COLUMN     "xUsername" TEXT;

-- CreateTable
CREATE TABLE "PrizeClaim" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "solPrize" DOUBLE PRECISION NOT NULL,
    "swarsPrize" DOUBLE PRECISION NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "transactionHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginStreak" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastLoginDate" TIMESTAMP(3),
    "lastClaimDate" TIMESTAMP(3),
    "totalLogins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginStreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrizeClaim_tournamentId_walletAddress_key" ON "PrizeClaim"("tournamentId", "walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "LoginStreak_walletAddress_key" ON "LoginStreak"("walletAddress");

-- AddForeignKey
ALTER TABLE "PrizeClaim" ADD CONSTRAINT "PrizeClaim_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
