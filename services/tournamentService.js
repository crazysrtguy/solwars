const { PrismaClient } = require('@prisma/client');
const TokenService = require('./tokenService');
const cron = require('node-cron');

// Initialize Prisma client with error handling
let prisma;
try {
  prisma = new PrismaClient();
} catch (error) {
  console.error('❌ Failed to initialize Prisma client:', error);
  // Create a mock prisma object to prevent crashes
  prisma = {
    tournament: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => null,
      update: async () => null,
      updateMany: async () => null
    },
    tournamentParticipant: {
      findMany: async () => [],
      create: async () => null,
      update: async () => null,
      updateMany: async () => null
    },
    user: {
      findUnique: async () => null,
      update: async () => null,
      upsert: async () => null
    },
    jackpotPool: {
      create: async () => null,
      findUnique: async () => null,
      update: async () => null
    }
  };
}

class TournamentService {
  constructor() {
    this.tokenService = new TokenService();
    this.setupCronJobs();
  }

  // Create a new tournament
  async createTournament(config) {
    try {
      console.log(`🏆 Creating new ${config.type} tournament: ${config.name}`);

      // Select tokens for this tournament with full DexScreener data
      console.log('🎯 Selecting tokens with DexScreener integration...');
      const selectedTokens = await this.tokenService.selectTournamentTokens(config.tokenCount || 8);

      if (!selectedTokens || selectedTokens.length === 0) {
        throw new Error('Failed to select tokens for tournament');
      }

      console.log(`✅ Selected ${selectedTokens.length} tokens:`,
        selectedTokens.map(t => `${t.symbol} ($${t.price?.toFixed(4) || 'N/A'})`).join(', '));

      // Calculate tournament timing
      const now = new Date();
      let startTime, endTime;

      if (config.startNow) {
        // Start immediately
        startTime = new Date(now.getTime() + (30 * 1000)); // Start in 30 seconds
        endTime = new Date(startTime.getTime() + (config.duration * 60 * 1000));
        console.log('⚡ Tournament set to start immediately!');
      } else if (config.startTime && config.endTime) {
        // Use provided times
        startTime = config.startTime;
        endTime = config.endTime;
      } else {
        // Default: start in 5 minutes
        startTime = new Date(now.getTime() + (5 * 60 * 1000));
        endTime = new Date(startTime.getTime() + (config.duration * 60 * 1000));
      }

      // Calculate bonus jackpot (20% of SWARS entry fees)
      const bonusJackpot = config.entryFeeSwars * 0.2;

      // Validate and normalize tournament type
      const validTypes = ['FLASH', 'DAILY', 'WEEKLY', 'SPECIAL'];
      const tournamentType = validTypes.includes(config.type) ? config.type : 'FLASH';

      console.log(`🎯 Tournament type: ${config.type} -> ${tournamentType}`);

      // Prepare tournament data
      const tournamentData = {
        name: config.name,
        description: config.description || `Epic ${config.duration}-minute trading battle!`,
        type: tournamentType,
        entryFeeSol: parseFloat(config.entryFeeSol) || 0.01,
        entryFeeSwars: parseFloat(config.entryFeeSwars) || 100,
        bonusJackpot: parseFloat(bonusJackpot),
        maxParticipants: parseInt(config.maxParticipants) || 1000,
        startTime,
        endTime,
        selectedTokens: selectedTokens,
        tokenMetadata: selectedTokens.reduce((acc, token) => {
          acc[token.address] = token;
          return acc;
        }, {})
      };

      console.log('📋 Creating tournament with data:', JSON.stringify(tournamentData, null, 2));

      try {
        const tournament = await prisma.tournament.create({
          data: tournamentData
        });
        console.log('✅ Tournament created successfully:', tournament.id);

        // Store initial price snapshots
        try {
          await this.tokenService.storePriceSnapshot(tournament.id, selectedTokens);
          console.log('✅ Price snapshots stored');
        } catch (snapshotError) {
          console.error('⚠️ Warning: Failed to store price snapshots:', snapshotError.message);
          // Don't fail tournament creation if snapshots fail
        }

        // Create jackpot pool
        try {
          await prisma.jackpotPool.create({
            data: {
              tournamentId: tournament.id,
              bonusMultip: 1.5 + Math.random() * 0.5 // 1.5x to 2.0x multiplier
            }
          });
          console.log('✅ Jackpot pool created');
        } catch (jackpotError) {
          console.error('⚠️ Warning: Failed to create jackpot pool:', jackpotError.message);
          // Don't fail tournament creation if jackpot fails
        }

        return tournament;
      } catch (prismaError) {
        console.error('❌ Prisma error details:', prismaError);
        console.error('❌ Error code:', prismaError.code);
        console.error('❌ Error meta:', prismaError.meta);
        throw new Error(`Database error: ${prismaError.message}`);
      }
    } catch (error) {
      console.error('❌ Error creating tournament:', error.message);
      throw error;
    }
  }

  // Join a tournament
  async joinTournament(tournamentId, userId, walletAddress, entryType = 'SOL') {
    try {
      console.log(`🎮 User ${userId} joining tournament ${tournamentId} with ${entryType}`);

      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { participants: true }
      });

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      if (tournament.status !== 'UPCOMING' && tournament.status !== 'ACTIVE') {
        throw new Error('Tournament is not accepting participants');
      }

      if (tournament.participants.length >= tournament.maxParticipants) {
        throw new Error('Tournament is full');
      }

      // Check if user already joined
      const existingParticipant = tournament.participants.find(p => p.userId === userId);
      if (existingParticipant) {
        throw new Error('Already joined this tournament');
      }

      // Verify user has enough balance
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      const entryFee = entryType === 'SOL' ? tournament.entryFeeSol : tournament.entryFeeSwars;
      const userBalance = entryType === 'SOL' ? 999 : user.swarsTokenBalance; // TODO: Get real SOL balance

      if (userBalance < entryFee) {
        throw new Error(`Insufficient ${entryType} balance`);
      }

      // Create participant
      const participant = await prisma.tournamentParticipant.create({
        data: {
          tournamentId,
          userId,
          walletAddress,
          entryType
        }
      });

      // Update prize pools
      if (entryType === 'SOL') {
        await prisma.tournament.update({
          where: { id: tournamentId },
          data: {
            prizePoolSol: {
              increment: entryFee * 0.9 // 90% goes to prize pool, 10% platform fee
            }
          }
        });
      } else {
        // SWARS entry contributes to bonus jackpot
        await prisma.jackpotPool.update({
          where: { tournamentId },
          data: {
            swarsContrib: {
              increment: entryFee * 0.2 // 20% of SWARS fees go to bonus jackpot
            }
          }
        });

        // Deduct SWARS tokens
        await prisma.user.update({
          where: { id: userId },
          data: {
            swarsTokenBalance: {
              decrement: entryFee
            }
          }
        });

        // Record SWARS transaction
        await prisma.swarsTransaction.create({
          data: {
            walletAddress,
            type: 'SPENT',
            amount: entryFee,
            description: `Tournament entry: ${tournament.name}`
          }
        });
      }

      // Update user stats
      await prisma.user.update({
        where: { id: userId },
        data: {
          tournamentsPlayed: {
            increment: 1
          }
        }
      });

      console.log(`✅ User joined tournament successfully`);
      return participant;
    } catch (error) {
      console.error('❌ Error joining tournament:', error.message);
      throw error;
    }
  }

  // Get active tournaments
  async getActiveTournaments() {
    try {
      const tournaments = await prisma.tournament.findMany({
        where: {
          status: {
            in: ['UPCOMING', 'ACTIVE']
          }
        },
        include: {
          participants: true,
          _count: {
            select: {
              participants: true
            }
          }
        },
        orderBy: {
          startTime: 'asc'
        }
      });

      return tournaments.map(tournament => ({
        ...tournament,
        participantCount: tournament._count.participants,
        spotsLeft: tournament.maxParticipants - tournament._count.participants,
        timeUntilStart: tournament.startTime.getTime() - Date.now(),
        timeUntilEnd: tournament.endTime.getTime() - Date.now()
      }));
    } catch (error) {
      console.error('❌ Error fetching active tournaments:', error.message);
      return [];
    }
  }

  // Get tournament leaderboard
  async getTournamentLeaderboard(tournamentId) {
    try {
      const participants = await prisma.tournamentParticipant.findMany({
        where: { tournamentId },
        include: { user: true },
        orderBy: { currentBalance: 'desc' }
      });

      return participants.map((participant, index) => ({
        rank: index + 1,
        username: participant.user.username || `Trader ${participant.walletAddress.slice(-4)}`,
        walletAddress: participant.walletAddress,
        entryType: participant.entryType,
        startingBalance: participant.startingBalance,
        currentBalance: participant.currentBalance,
        profit: participant.currentBalance - participant.startingBalance,
        profitPercent: ((participant.currentBalance - participant.startingBalance) / participant.startingBalance) * 100,
        trades: Array.isArray(participant.trades) ? participant.trades.length : 0
      }));
    } catch (error) {
      console.error('❌ Error fetching tournament leaderboard:', error.message);
      return [];
    }
  }

  // Start tournament (change status to ACTIVE)
  async startTournament(tournamentId) {
    try {
      console.log(`🚀 Starting tournament ${tournamentId}`);

      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'ACTIVE' }
      });

      console.log(`✅ Tournament ${tournamentId} is now ACTIVE`);
    } catch (error) {
      console.error('❌ Error starting tournament:', error.message);
    }
  }

  // End tournament and distribute prizes
  async endTournament(tournamentId) {
    try {
      console.log(`🏁 Ending tournament ${tournamentId}`);

      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { participants: true }
      });

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Get final leaderboard
      const leaderboard = await this.getTournamentLeaderboard(tournamentId);

      // Calculate prize distribution (50%, 30%, 20% for top 3)
      const totalPrize = tournament.prizePoolSol;
      const prizeDistribution = [0.5, 0.3, 0.2];

      // Get bonus jackpot info
      const jackpot = await prisma.jackpotPool.findUnique({
        where: { tournamentId }
      });

      // Distribute prizes
      for (let i = 0; i < Math.min(3, leaderboard.length); i++) {
        const participant = leaderboard[i];
        const prize = totalPrize * prizeDistribution[i];

        // Calculate bonus for SWARS entries
        let bonus = 0;
        if (participant.entryType === 'SWARS' && jackpot) {
          bonus = (jackpot.swarsContrib * jackpot.bonusMultip) * prizeDistribution[i];
        }

        // Update participant record
        await prisma.tournamentParticipant.updateMany({
          where: {
            tournamentId,
            walletAddress: participant.walletAddress
          },
          data: {
            finalRank: i + 1,
            prizeWon: prize,
            bonusWon: bonus
          }
        });

        // Update user stats
        await prisma.user.update({
          where: { walletAddress: participant.walletAddress },
          data: {
            totalWinnings: {
              increment: prize + bonus
            },
            tournamentsWon: i === 0 ? { increment: 1 } : undefined
          }
        });

        console.log(`🏆 Rank ${i + 1}: ${participant.username} won ${prize.toFixed(4)} SOL + ${bonus.toFixed(4)} bonus`);
      }

      // Update tournament status
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'ENDED' }
      });

      console.log(`✅ Tournament ${tournamentId} ended successfully`);
    } catch (error) {
      console.error('❌ Error ending tournament:', error.message);
    }
  }

  // Setup cron jobs for tournament management
  setupCronJobs() {
    // Check for tournaments to start every minute
    cron.schedule('* * * * *', async () => {
      try {
        const tournamentsToStart = await prisma.tournament.findMany({
          where: {
            status: 'UPCOMING',
            startTime: {
              lte: new Date()
            }
          }
        });

        for (const tournament of tournamentsToStart) {
          await this.startTournament(tournament.id);
        }
      } catch (error) {
        console.error('❌ Error in start tournament cron:', error.message);
      }
    });

    // Check for tournaments to end every minute
    cron.schedule('* * * * *', async () => {
      try {
        const tournamentsToEnd = await prisma.tournament.findMany({
          where: {
            status: 'ACTIVE',
            endTime: {
              lte: new Date()
            }
          }
        });

        for (const tournament of tournamentsToEnd) {
          await this.endTournament(tournament.id);
        }
      } catch (error) {
        console.error('❌ Error in end tournament cron:', error.message);
      }
    });

    // Create daily tournaments at midnight UTC
    cron.schedule('0 0 * * *', async () => {
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(12, 0, 0, 0); // Start at noon UTC

        const endTime = new Date(tomorrow);
        endTime.setHours(36, 0, 0, 0); // 24 hour duration

        await this.createTournament({
          name: `Daily Galactic Championship - ${tomorrow.toDateString()}`,
          description: 'Epic 24-hour trading battle with real Solana tokens!',
          type: 'DAILY',
          entryFeeSol: 0.01,
          entryFeeSwars: 100,
          maxParticipants: 1000,
          startTime: tomorrow,
          endTime: endTime,
          tokenCount: 8
        });

        console.log('🎯 Created daily tournament for tomorrow');
      } catch (error) {
        console.error('❌ Error creating daily tournament:', error.message);
      }
    });

    console.log('⏰ Tournament cron jobs initialized');
  }
}

module.exports = TournamentService;
