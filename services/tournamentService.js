const { PrismaClient } = require('@prisma/client');
const TokenService = require('./tokenService');
const SolTransferService = require('./solTransferService');
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
    this.solTransferService = new SolTransferService();
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

  // Calculate current prize pool and payout structure
  async calculatePrizeStructure(tournamentId) {
    try {
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          participants: true,
          _count: { select: { participants: true } }
        }
      });

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      const participantCount = tournament._count.participants;
      const totalSolPrize = tournament.prizePoolSol;

      // Get bonus jackpot info
      const jackpot = await prisma.jackpotPool.findUnique({
        where: { tournamentId }
      });

      const totalBonusJackpot = jackpot ? jackpot.swarsContrib * jackpot.bonusMultip : 0;

      // Prize distribution percentages
      const prizeDistribution = [
        { rank: 1, percentage: 0.5, label: '1st Place' },
        { rank: 2, percentage: 0.3, label: '2nd Place' },
        { rank: 3, percentage: 0.2, label: '3rd Place' }
      ];

      // Calculate actual payouts
      const payouts = prizeDistribution.map(tier => ({
        ...tier,
        solPrize: totalSolPrize * tier.percentage,
        bonusJackpot: totalBonusJackpot * tier.percentage,
        totalValue: (totalSolPrize * tier.percentage) + (totalBonusJackpot * tier.percentage)
      }));

      return {
        tournamentId,
        participantCount,
        totalSolPrize,
        totalBonusJackpot,
        payouts,
        entryFeeSol: tournament.entryFeeSol,
        entryFeeSwars: tournament.entryFeeSwars,
        maxParticipants: tournament.maxParticipants,
        platformFee: tournament.entryFeeSol * 0.1, // 10% platform fee
        prizePoolPercentage: 0.9 // 90% goes to prize pool
      };
    } catch (error) {
      console.error('❌ Error calculating prize structure:', error.message);
      throw error;
    }
  }

  // Get potential winnings for a user considering their current rank
  async getPotentialWinnings(tournamentId, walletAddress) {
    try {
      const leaderboard = await this.getTournamentLeaderboard(tournamentId);
      const prizeStructure = await this.calculatePrizeStructure(tournamentId);

      const userRank = leaderboard.findIndex(p => p.walletAddress === walletAddress) + 1;

      if (userRank === 0) {
        return { rank: null, potentialWinnings: 0, message: 'Not participating' };
      }

      let potentialWinnings = 0;
      let prizeInfo = null;

      if (userRank <= 3) {
        prizeInfo = prizeStructure.payouts[userRank - 1];
        potentialWinnings = prizeInfo.totalValue;
      }

      return {
        rank: userRank,
        potentialWinnings,
        prizeInfo,
        totalParticipants: leaderboard.length,
        prizeStructure
      };
    } catch (error) {
      console.error('❌ Error calculating potential winnings:', error.message);
      throw error;
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

      // Get final leaderboard and prize structure
      const leaderboard = await this.getTournamentLeaderboard(tournamentId);
      const prizeStructure = await this.calculatePrizeStructure(tournamentId);

      // Distribute prizes to top 3
      const winners = [];
      for (let i = 0; i < Math.min(3, leaderboard.length); i++) {
        const participant = leaderboard[i];
        const payout = prizeStructure.payouts[i];

        // Calculate bonus for SWARS entries
        let bonusAmount = 0;
        if (participant.entryType === 'SWARS') {
          bonusAmount = payout.bonusJackpot;
        }

        // Update participant record
        await prisma.tournamentParticipant.updateMany({
          where: {
            tournamentId,
            walletAddress: participant.walletAddress
          },
          data: {
            finalRank: i + 1,
            prizeWon: payout.solPrize,
            bonusWon: bonusAmount
          }
        });

        // Create prize claim record
        await prisma.prizeClaim.create({
          data: {
            tournamentId,
            walletAddress: participant.walletAddress,
            rank: i + 1,
            solPrize: payout.solPrize,
            swarsPrize: bonusAmount,
            claimed: false
          }
        });

        // Update user stats (but don't add to totalWinnings until claimed)
        await prisma.user.update({
          where: { walletAddress: participant.walletAddress },
          data: {
            tournamentsWon: i === 0 ? { increment: 1 } : undefined
          }
        });

        winners.push({
          rank: i + 1,
          username: participant.username,
          walletAddress: participant.walletAddress,
          solPrize: payout.solPrize,
          bonusWon: bonusAmount,
          totalWon: payout.solPrize + bonusAmount
        });

        console.log(`🏆 Rank ${i + 1}: ${participant.username} won ${payout.solPrize.toFixed(4)} SOL + ${bonusAmount.toFixed(4)} bonus`);
      }

      // Update tournament status
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'ENDED' }
      });

      console.log(`✅ Tournament ${tournamentId} ended successfully`);
      return { winners, prizeStructure };
    } catch (error) {
      console.error('❌ Error ending tournament:', error.message);
      throw error;
    }
  }

  // Get unclaimed prizes for a user
  async getUnclaimedPrizes(walletAddress) {
    try {
      const unclaimedPrizes = await prisma.prizeClaim.findMany({
        where: {
          walletAddress,
          claimed: false
        },
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              type: true,
              endTime: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return unclaimedPrizes;
    } catch (error) {
      console.error('❌ Error getting unclaimed prizes:', error.message);
      throw error;
    }
  }

  // Claim a prize
  async claimPrize(walletAddress, tournamentId) {
    try {
      console.log(`💰 Processing prize claim for ${walletAddress} in tournament ${tournamentId}`);

      // Find the prize claim
      const prizeClaim = await prisma.prizeClaim.findUnique({
        where: {
          tournamentId_walletAddress: {
            tournamentId,
            walletAddress
          }
        },
        include: {
          tournament: true
        }
      });

      if (!prizeClaim) {
        throw new Error('Prize claim not found');
      }

      if (prizeClaim.claimed) {
        throw new Error('Prize already claimed');
      }

      // Additional security: Verify tournament is actually ended
      if (prizeClaim.tournament.status !== 'ENDED') {
        throw new Error('Tournament must be ended before claiming prizes');
      }

      // Security: Verify prize amounts are reasonable (prevent manipulation)
      if (prizeClaim.solPrize < 0 || prizeClaim.swarsPrize < 0) {
        throw new Error('Invalid prize amounts detected');
      }

      if (prizeClaim.solPrize > 10 || prizeClaim.swarsPrize > 10000) {
        console.log(`⚠️ Large prize claim detected: ${prizeClaim.solPrize} SOL + ${prizeClaim.swarsPrize} SWARS`);
        // Log for manual review but allow the claim
      }

      // Verify rank is valid (1-3)
      if (prizeClaim.rank < 1 || prizeClaim.rank > 3) {
        throw new Error('Invalid prize rank');
      }

      // Security audit log
      console.log(`🔒 SECURITY AUDIT - Prize Claim Attempt:`, {
        walletAddress,
        tournamentId,
        tournamentName: prizeClaim.tournament.name,
        rank: prizeClaim.rank,
        solPrize: prizeClaim.solPrize,
        swarsPrize: prizeClaim.swarsPrize,
        timestamp: new Date().toISOString()
      });

      // Send both SOL and SWARS prizes if any
      let transferResults = null;
      if (prizeClaim.solPrize > 0 || prizeClaim.swarsPrize > 0) {
        console.log(`💸 Sending prizes: ${prizeClaim.solPrize} SOL + ${prizeClaim.swarsPrize} SWARS to ${walletAddress}`);

        try {
          transferResults = await this.solTransferService.sendCombinedPrize(
            walletAddress,
            prizeClaim.solPrize,
            prizeClaim.swarsPrize
          );
          console.log(`✅ Prize transfers successful:`, transferResults.transfers.map(t => t.signature));

          // Security audit log for successful transfer
          console.log(`🔒 SECURITY AUDIT - Prize Transfer Success:`, {
            walletAddress,
            tournamentId,
            signatures: transferResults.transfers.map(t => t.signature),
            timestamp: new Date().toISOString()
          });
        } catch (transferError) {
          console.error('❌ Prize transfer failed:', transferError);

          // Security audit log for failed transfer
          console.log(`🔒 SECURITY AUDIT - Prize Transfer Failed:`, {
            walletAddress,
            tournamentId,
            error: transferError.message,
            timestamp: new Date().toISOString()
          });

          throw new Error(`Failed to send prizes: ${transferError.message}`);
        }
      }

      // Complete the prize claim with transaction hashes
      const transactionHashes = transferResults ? transferResults.transfers.map(t => t.signature).join(',') : null;
      const result = await this.completePrizeClaim(walletAddress, tournamentId, transactionHashes);

      return {
        success: true,
        solPrize: prizeClaim.solPrize,
        swarsPrize: prizeClaim.swarsPrize,
        rank: prizeClaim.rank,
        tournamentName: prizeClaim.tournament.name,
        transactionHashes: transferResults ? transferResults.transfers : [],
        claimedAt: result.claimedAt
      };

    } catch (error) {
      console.error('❌ Error claiming prize:', error.message);
      throw error;
    }
  }

  // Complete prize claim after SOL transfer (if any)
  async completePrizeClaim(walletAddress, tournamentId, solTransactionHash = null) {
    try {
      console.log(`✅ Completing prize claim for ${walletAddress} in tournament ${tournamentId}`);

      // Find the prize claim
      const prizeClaim = await prisma.prizeClaim.findUnique({
        where: {
          tournamentId_walletAddress: {
            tournamentId,
            walletAddress
          }
        },
        include: {
          tournament: true
        }
      });

      if (!prizeClaim) {
        throw new Error('Prize claim not found');
      }

      if (prizeClaim.claimed) {
        throw new Error('Prize already claimed');
      }

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Mark prize as claimed
        const updatedClaim = await tx.prizeClaim.update({
          where: {
            id: prizeClaim.id
          },
          data: {
            claimed: true,
            claimedAt: new Date(),
            transactionHash: solTransactionHash
          }
        });

        // Record SWARS transaction if any (tokens already sent via blockchain)
        if (prizeClaim.swarsPrize > 0) {
          await tx.swarsTransaction.create({
            data: {
              walletAddress,
              type: 'EARNED',
              amount: prizeClaim.swarsPrize,
              description: `Tournament prize: ${prizeClaim.tournament.name} (Rank ${prizeClaim.rank})`,
              txSignature: solTransactionHash
            }
          });
        }

        // Update user total winnings
        await tx.user.upsert({
          where: { walletAddress },
          update: {
            totalWinnings: {
              increment: prizeClaim.solPrize + prizeClaim.swarsPrize
            }
          },
          create: {
            walletAddress,
            totalWinnings: prizeClaim.solPrize + prizeClaim.swarsPrize
          }
        });

        // Update participant record
        await tx.tournamentParticipant.updateMany({
          where: {
            tournamentId,
            walletAddress
          },
          data: {
            prizeClaimed: true,
            prizeClaimedAt: new Date()
          }
        });

        return updatedClaim;
      });

      console.log(`✅ Prize claim completed: ${prizeClaim.solPrize} SOL + ${prizeClaim.swarsPrize} SWARS`);

      return {
        success: true,
        solPrize: prizeClaim.solPrize,
        swarsPrize: prizeClaim.swarsPrize,
        rank: prizeClaim.rank,
        tournamentName: prizeClaim.tournament.name,
        claimedAt: result.claimedAt,
        transactionHash: solTransactionHash
      };

    } catch (error) {
      console.error('❌ Error completing prize claim:', error.message);
      throw error;
    }
  }

  // Get prize claim history for a user
  async getPrizeHistory(walletAddress) {
    try {
      const prizeHistory = await prisma.prizeClaim.findMany({
        where: {
          walletAddress
        },
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              type: true,
              endTime: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return prizeHistory;
    } catch (error) {
      console.error('❌ Error getting prize history:', error.message);
      throw error;
    }
  }

  // Setup cron jobs for tournament management - DISABLED
  // Note: Tournament scheduling is now handled by TournamentScheduler service
  setupCronJobs() {
    console.log('⏰ Tournament cron jobs disabled - using TournamentScheduler instead');
    // All tournament scheduling is now handled by the TournamentScheduler service
    // to avoid conflicts and ensure continuous availability
  }
}

module.exports = TournamentService;
