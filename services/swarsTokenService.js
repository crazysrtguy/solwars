const { PrismaClient } = require('@prisma/client');
const { Connection, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');

// Initialize Prisma client with error handling
let prisma;
try {
  prisma = new PrismaClient();
} catch (error) {
  console.error('❌ Failed to initialize Prisma client in SwarsTokenService:', error);
  // Create a mock prisma object to prevent crashes
  prisma = {
    user: {
      findUnique: async () => null,
      update: async () => null,
      upsert: async () => null,
      count: async () => 0,
      aggregate: async () => ({ _sum: { swarsTokenBalance: 0 } })
    },
    swarsTransaction: {
      create: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      groupBy: async () => []
    },
    tournamentParticipant: {
      findMany: async () => []
    }
  };
}

class SwarsTokenService {
  constructor(solTransferService = null) {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    this.swarsTokenMint = process.env.SWARS_TOKEN_MINT; // Our native token mint address
    this.treasuryWallet = process.env.TREASURY_WALLET; // Treasury wallet for token distribution
    this.solTransferService = solTransferService; // Service for sending actual tokens
  }

  // Award SWARS tokens to user (sends real tokens from treasury)
  async awardTokens(walletAddress, amount, reason = 'Tournament reward') {
    try {
      console.log(`🎁 Awarding ${amount} SWARS tokens to ${walletAddress}`);

      // Send actual SWARS tokens from treasury
      let txSignature = null;
      if (this.solTransferService) {
        try {
          console.log(`💎 Sending ${amount} SWARS tokens from treasury to ${walletAddress}`);
          const transferResult = await this.solTransferService.sendSwarsPrize(walletAddress, amount);
          txSignature = transferResult.signature;
          console.log(`✅ SWARS tokens sent successfully: ${txSignature}`);
        } catch (transferError) {
          console.error('❌ Failed to send SWARS tokens from treasury:', transferError);
          throw new Error(`Failed to send SWARS tokens: ${transferError.message}`);
        }
      } else {
        console.warn('⚠️ SolTransferService not available, creating database entry only');
      }

      // Update user balance in database
      await prisma.user.upsert({
        where: { walletAddress },
        update: {
          swarsTokenBalance: {
            increment: amount
          }
        },
        create: {
          walletAddress,
          swarsTokenBalance: amount
        }
      });

      // Record transaction with correct type for daily bonuses
      const transactionType = reason.includes('login streak bonus') ? 'BONUS' : 'EARNED';
      await prisma.swarsTransaction.create({
        data: {
          walletAddress,
          type: transactionType,
          amount,
          description: reason,
          txSignature
        }
      });

      console.log(`✅ Awarded ${amount} SWARS tokens successfully`);
      return true;
    } catch (error) {
      console.error('❌ Error awarding SWARS tokens:', error.message);
      return false;
    }
  }

  // Spend SWARS tokens
  async spendTokens(walletAddress, amount, reason = 'Tournament entry') {
    try {
      console.log(`💸 Spending ${amount} SWARS tokens from ${walletAddress}`);

      const user = await prisma.user.findUnique({
        where: { walletAddress }
      });

      if (!user || user.swarsTokenBalance < amount) {
        throw new Error('Insufficient SWARS token balance');
      }

      // Update user balance
      await prisma.user.update({
        where: { walletAddress },
        data: {
          swarsTokenBalance: {
            decrement: amount
          }
        }
      });

      // Record transaction
      await prisma.swarsTransaction.create({
        data: {
          walletAddress,
          type: 'SPENT',
          amount,
          description: reason
        }
      });

      console.log(`✅ Spent ${amount} SWARS tokens successfully`);
      return true;
    } catch (error) {
      console.error('❌ Error spending SWARS tokens:', error.message);
      throw error;
    }
  }

  // Get user SWARS balance
  async getUserBalance(walletAddress) {
    try {
      const user = await prisma.user.findUnique({
        where: { walletAddress }
      });

      return user?.swarsTokenBalance || 0;
    } catch (error) {
      console.error('❌ Error getting user balance:', error.message);
      return 0;
    }
  }

  // Daily login bonus with progressive streak system
  async claimDailyBonus(walletAddress) {
    try {
      console.log(`🎯 Checking daily login bonus for ${walletAddress}`);

      let user = await prisma.user.findUnique({
        where: { walletAddress }
      });

      if (!user) {
        console.log(`🆕 Creating new user for ${walletAddress}`);
        // Create new user for daily bonus claim
        user = await prisma.user.create({
          data: {
            walletAddress,
            username: `Trader ${walletAddress.slice(0, 8)}`,
            swarsTokenBalance: 0,
            tournamentsPlayed: 0,
            tournamentsWon: 0
          }
        });
        console.log(`✅ Created new user with ID: ${user.id}`);
      }

      // Get or create login streak record
      let loginStreak = await prisma.loginStreak.findUnique({
        where: { walletAddress }
      });

      if (!loginStreak) {
        loginStreak = await prisma.loginStreak.create({
          data: {
            walletAddress,
            currentStreak: 0,
            longestStreak: 0,
            totalLogins: 0
          }
        });
      }

      // Check if user already claimed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      console.log(`🔍 Checking for existing bonus claims between ${today.toISOString()} and ${tomorrow.toISOString()}`);

      const todayBonus = await prisma.swarsTransaction.findFirst({
        where: {
          walletAddress,
          type: 'BONUS',
          timestamp: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      console.log(`🔍 Found existing bonus today:`, todayBonus ? 'YES' : 'NO');
      if (todayBonus) {
        console.log(`🔍 Existing bonus details:`, {
          id: todayBonus.id,
          amount: todayBonus.amount,
          timestamp: todayBonus.timestamp,
          description: todayBonus.description
        });
      }

      if (todayBonus) {
        throw new Error('Daily bonus already claimed today');
      }

      // Update login streak
      const updatedStreak = await this.updateLoginStreak(walletAddress, loginStreak);

      // Calculate progressive bonus based on streak
      const bonusAmount = this.calculateProgressiveBonus(updatedStreak, user);

      // Award the bonus
      await this.awardTokens(walletAddress, bonusAmount, `Day ${updatedStreak.currentStreak} login streak bonus`);

      console.log(`✅ Day ${updatedStreak.currentStreak} streak bonus of ${bonusAmount} SWARS claimed`);

      return {
        amount: bonusAmount,
        currentStreak: updatedStreak.currentStreak,
        longestStreak: updatedStreak.longestStreak,
        nextDayBonus: this.getNextDayBonus(updatedStreak.currentStreak)
      };
    } catch (error) {
      console.error('❌ Error claiming daily bonus:', error.message);
      throw error;
    }
  }

  // Update login streak based on last login
  async updateLoginStreak(walletAddress, currentStreak) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let newStreak = 1; // Starting a new streak
      let newLongestStreak = currentStreak.longestStreak;

      // Check if user logged in yesterday (continuing streak)
      if (currentStreak.lastLoginDate) {
        const lastLogin = new Date(currentStreak.lastLoginDate);
        lastLogin.setHours(0, 0, 0, 0);

        if (lastLogin.getTime() === yesterday.getTime()) {
          // Continuing streak
          newStreak = currentStreak.currentStreak + 1;
        } else if (lastLogin.getTime() === today.getTime()) {
          // Already logged in today, keep current streak
          newStreak = currentStreak.currentStreak;
        }
        // If more than 1 day gap, streak resets to 1
      }

      // Update longest streak if current is higher
      if (newStreak > newLongestStreak) {
        newLongestStreak = newStreak;
      }

      // Update the streak record
      const updatedStreak = await prisma.loginStreak.update({
        where: { walletAddress },
        data: {
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastLoginDate: today,
          lastClaimDate: today,
          totalLogins: {
            increment: 1
          }
        }
      });

      console.log(`📈 Login streak updated: Day ${newStreak} (Longest: ${newLongestStreak})`);
      return updatedStreak;
    } catch (error) {
      console.error('❌ Error updating login streak:', error);
      throw error;
    }
  }

  // Calculate progressive bonus: Day 1=5, Day 2=10, Day 3=15, etc. up to Day 7=35, then cycles
  calculateProgressiveBonus(loginStreak, user) {
    const streakDay = loginStreak.currentStreak;

    // Base progressive bonus: 5 SWARS per day (Day 1=5, Day 2=10, Day 3=15, etc.)
    const cycleDay = ((streakDay - 1) % 7) + 1; // Cycle every 7 days
    let baseBonus = cycleDay * 5;

    // Bonus multiplier for longer streaks
    const weekMultiplier = Math.floor((streakDay - 1) / 7) + 1;
    if (weekMultiplier > 1) {
      baseBonus = Math.floor(baseBonus * (1 + (weekMultiplier - 1) * 0.2)); // 20% bonus per week
    }

    // Small activity bonus (reduced from previous version)
    let activityBonus = 0;
    if (user.tournamentsPlayed > 0) {
      activityBonus += Math.min(user.tournamentsPlayed, 3); // Up to 3 extra SWARS
    }
    if (user.tournamentsWon > 0) {
      activityBonus += Math.min(user.tournamentsWon * 2, 5); // Up to 5 extra SWARS
    }

    // Special milestone bonuses
    let milestoneBonus = 0;
    if (streakDay === 7) {
      milestoneBonus = 20; // Week completion bonus
    } else if (streakDay === 30) {
      milestoneBonus = 100; // Month completion bonus
    } else if (streakDay % 7 === 0 && streakDay > 7) {
      milestoneBonus = 15; // Weekly milestone bonus
    }

    const totalBonus = baseBonus + activityBonus + milestoneBonus;

    console.log(`💰 Progressive bonus calculation: Day ${streakDay} (Cycle Day ${cycleDay})`);
    console.log(`   Base: ${baseBonus} SWARS + Activity: ${activityBonus} SWARS + Milestone: ${milestoneBonus} SWARS = ${totalBonus} SWARS`);

    return totalBonus;
  }

  // Get next day bonus preview
  getNextDayBonus(currentStreak) {
    const nextDay = currentStreak + 1;
    const cycleDay = ((nextDay - 1) % 7) + 1;
    let nextBonus = cycleDay * 5;

    const weekMultiplier = Math.floor((nextDay - 1) / 7) + 1;
    if (weekMultiplier > 1) {
      nextBonus = Math.floor(nextBonus * (1 + (weekMultiplier - 1) * 0.2));
    }

    // Add milestone bonuses
    if (nextDay === 7) {
      nextBonus += 20;
    } else if (nextDay === 30) {
      nextBonus += 100;
    } else if (nextDay % 7 === 0 && nextDay > 7) {
      nextBonus += 15;
    }

    return nextBonus;
  }

  // Get user's current login streak info
  async getLoginStreakInfo(walletAddress) {
    try {
      console.log(`🔍 Getting login streak info for ${walletAddress}`);

      const loginStreak = await prisma.loginStreak.findUnique({
        where: { walletAddress }
      });

      console.log(`🔍 Found login streak record:`, loginStreak ? 'YES' : 'NO');

      if (!loginStreak) {
        console.log(`🆕 New user - can claim daily bonus`);
        return {
          currentStreak: 0,
          longestStreak: 0,
          totalLogins: 0,
          canClaimToday: true,
          nextDayBonus: 5
        };
      }

      // Check if user can claim today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      console.log(`🔍 Checking for BONUS transactions between ${today.toISOString()} and ${tomorrow.toISOString()}`);

      const todayBonus = await prisma.swarsTransaction.findFirst({
        where: {
          walletAddress,
          type: 'BONUS',
          timestamp: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      console.log(`🔍 Found bonus transaction today:`, todayBonus ? 'YES' : 'NO');
      if (todayBonus) {
        console.log(`🔍 Today's bonus details:`, {
          amount: todayBonus.amount,
          timestamp: todayBonus.timestamp,
          description: todayBonus.description
        });
      }

      const canClaim = !todayBonus;
      console.log(`🎯 Can claim today: ${canClaim}`);

      return {
        currentStreak: loginStreak.currentStreak,
        longestStreak: loginStreak.longestStreak,
        totalLogins: loginStreak.totalLogins,
        canClaimToday: canClaim,
        nextDayBonus: this.getNextDayBonus(loginStreak.currentStreak),
        lastClaimDate: loginStreak.lastClaimDate
      };
    } catch (error) {
      console.error('❌ Error getting login streak info:', error);
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalLogins: 0,
        canClaimToday: true,
        nextDayBonus: 5
      };
    }
  }

  // Calculate daily bonus based on user activity (legacy method for compatibility)
  calculateDailyBonus(user) {
    let baseBonus = 10;

    // Bonus for tournament participation
    if (user.tournamentsPlayed > 0) {
      baseBonus += Math.min(user.tournamentsPlayed * 2, 20);
    }

    // Bonus for tournament wins
    if (user.tournamentsWon > 0) {
      baseBonus += Math.min(user.tournamentsWon * 5, 25);
    }

    // Random bonus element (1-10)
    baseBonus += Math.floor(Math.random() * 10) + 1;

    return Math.min(baseBonus, 50); // Cap at 50 SWARS
  }

  // Tournament completion rewards
  async distributeTournamentRewards(tournamentId) {
    try {
      console.log(`🏆 Distributing tournament rewards for ${tournamentId}`);

      const participants = await prisma.tournamentParticipant.findMany({
        where: { tournamentId },
        include: { user: true },
        orderBy: { currentBalance: 'desc' }
      });

      const rewards = [];

      for (let i = 0; i < participants.length; i++) {
        const participant = participants[i];
        let rewardAmount = 0;

        // Reward based on rank
        if (i === 0) {
          rewardAmount = 500; // 1st place
        } else if (i === 1) {
          rewardAmount = 300; // 2nd place
        } else if (i === 2) {
          rewardAmount = 200; // 3rd place
        } else if (i < 10) {
          rewardAmount = 100; // Top 10
        } else if (i < 50) {
          rewardAmount = 50;  // Top 50
        } else {
          rewardAmount = 25;  // Participation reward
        }

        // Bonus for profit
        const profit = participant.currentBalance - participant.startingBalance;
        if (profit > 0) {
          const profitBonus = Math.floor(profit / 1000) * 10; // 10 SWARS per 1000 profit
          rewardAmount += Math.min(profitBonus, 200); // Cap bonus at 200
        }

        if (rewardAmount > 0) {
          await this.awardTokens(
            participant.walletAddress,
            rewardAmount,
            `Tournament reward - Rank ${i + 1}`
          );

          rewards.push({
            walletAddress: participant.walletAddress,
            rank: i + 1,
            reward: rewardAmount
          });
        }
      }

      console.log(`✅ Distributed rewards to ${rewards.length} participants`);
      return rewards;
    } catch (error) {
      console.error('❌ Error distributing tournament rewards:', error.message);
      throw error;
    }
  }

  // Get SWARS token stats
  async getTokenStats() {
    try {
      const stats = await prisma.swarsTransaction.groupBy({
        by: ['type'],
        _sum: {
          amount: true
        },
        _count: {
          _all: true
        }
      });

      const totalUsers = await prisma.user.count({
        where: {
          swarsTokenBalance: {
            gt: 0
          }
        }
      });

      const totalSupply = await prisma.user.aggregate({
        _sum: {
          swarsTokenBalance: true
        }
      });

      return {
        totalSupply: totalSupply._sum.swarsTokenBalance || 0,
        totalHolders: totalUsers,
        transactionStats: stats.reduce((acc, stat) => {
          acc[stat.type] = {
            count: stat._count._all,
            volume: stat._sum.amount || 0
          };
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('❌ Error getting token stats:', error.message);
      return {
        totalSupply: 0,
        totalHolders: 0,
        transactionStats: {}
      };
    }
  }
}

module.exports = SwarsTokenService;
