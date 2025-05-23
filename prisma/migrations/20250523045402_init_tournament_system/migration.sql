-- CreateEnum
CREATE TYPE "TournamentType" AS ENUM ('FLASH', 'DAILY', 'WEEKLY', 'SPECIAL');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('SOL', 'SWARS');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "SwarsType" AS ENUM ('EARNED', 'SPENT', 'BONUS', 'AIRDROP');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "username" TEXT,
    "swarsTokenBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWinnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tournamentsWon" INTEGER NOT NULL DEFAULT 0,
    "tournamentsPlayed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leaderboard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "highScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "lastGameDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "netWorth" DOUBLE PRECISION NOT NULL,
    "days" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "TournamentType" NOT NULL DEFAULT 'DAILY',
    "status" "TournamentStatus" NOT NULL DEFAULT 'UPCOMING',
    "entryFeeSol" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "entryFeeSwars" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "prizePoolSol" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusJackpot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxParticipants" INTEGER NOT NULL DEFAULT 1000,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "selectedTokens" JSONB NOT NULL,
    "tokenMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentParticipant" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "entryType" "EntryType" NOT NULL,
    "startingBalance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "portfolio" JSONB NOT NULL DEFAULT '{}',
    "trades" JSONB NOT NULL DEFAULT '[]',
    "finalRank" INTEGER,
    "prizeWon" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusWon" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPriceSnapshot" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "marketCap" DOUBLE PRECISION,
    "volume24h" DOUBLE PRECISION,
    "priceChange" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'dexscreener',

    CONSTRAINT "TokenPriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwarsTransaction" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "type" "SwarsType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "txSignature" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwarsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JackpotPool" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT,
    "totalPool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "swarsContrib" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusMultip" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JackpotPool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Leaderboard_userId_key" ON "Leaderboard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipant_tournamentId_userId_key" ON "TournamentParticipant"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "TokenPriceSnapshot_tokenAddress_timestamp_idx" ON "TokenPriceSnapshot"("tokenAddress", "timestamp");

-- CreateIndex
CREATE INDEX "TokenTransaction_userId_tournamentId_idx" ON "TokenTransaction"("userId", "tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "JackpotPool_tournamentId_key" ON "JackpotPool"("tournamentId");

-- AddForeignKey
ALTER TABLE "Leaderboard" ADD CONSTRAINT "Leaderboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPriceSnapshot" ADD CONSTRAINT "TokenPriceSnapshot_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenTransaction" ADD CONSTRAINT "TokenTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
