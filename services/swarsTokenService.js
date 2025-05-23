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
  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    this.swarsTokenMint = process.env.SWARS_TOKEN_MINT; // Our native token mint address
    this.treasuryWallet = process.env.TREASURY_WALLET; // Treasury wallet for token distribution
  }

  // Award SWARS tokens to user
  async awardTokens(walletAddress, amount, reason = 'Tournament reward') {
    try {
      console.log(`🎁 Awarding ${amount} SWARS tokens to ${walletAddress}`);

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

      // Record transaction
      await prisma.swarsTransaction.create({
        data: {
          walletAddress,
          type: 'EARNED',
          amount,
          description: reason
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

  // Daily login bonus
  async claimDailyBonus(walletAddress) {
    try {
      console.log(`🎯 Checking daily bonus for ${walletAddress}`);

      const user = await prisma.user.findUnique({
        where: { walletAddress }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check if user already claimed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayBonus = await prisma.swarsTransaction.findFirst({
        where: {
          walletAddress,
          type: 'BONUS',
          timestamp: {
            gte: today
          }
        }
      });

      if (todayBonus) {
        throw new Error('Daily bonus already claimed today');
      }

      // Award daily bonus (10-50 SWARS based on activity)
      const bonusAmount = this.calculateDailyBonus(user);

      await this.awardTokens(walletAddress, bonusAmount, 'Daily login bonus');

      console.log(`✅ Daily bonus of ${bonusAmount} SWARS claimed`);
      return bonusAmount;
    } catch (error) {
      console.error('❌ Error claiming daily bonus:', error.message);
      throw error;
    }
  }

  // Calculate daily bonus based on user activity
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
