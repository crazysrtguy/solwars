// Daily login bonus claim API for Vercel
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Calculate progressive bonus based on streak
function calculateProgressiveBonus(streak, user) {
  const baseBonus = 5;
  const dayBonus = streak.currentStreak * baseBonus;
  
  // Weekly milestone bonus (every 7 days)
  const weeklyBonus = Math.floor(streak.currentStreak / 7) * 20;
  
  return dayBonus + weeklyBonus;
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    console.log(`🎁 Processing daily bonus claim for ${walletAddress}`);

    // Use database transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Find or create user
      let user = await tx.user.findUnique({
        where: { walletAddress }
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            walletAddress,
            username: `Trader ${walletAddress.slice(0, 8)}`,
            swarsTokenBalance: 0,
            tournamentsPlayed: 0,
            tournamentsWon: 0
          }
        });
      }

      // Get or create login streak record
      let loginStreak = await tx.loginStreak.findUnique({
        where: { walletAddress }
      });

      if (!loginStreak) {
        loginStreak = await tx.loginStreak.create({
          data: {
            walletAddress,
            currentStreak: 0,
            longestStreak: 0,
            totalLogins: 0
          }
        });
      }

      // Use UTC for consistent date handling
      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const tomorrowUTC = new Date(todayUTC);
      tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

      // Check if user already claimed today
      const todayBonus = await tx.swarsTransaction.findFirst({
        where: {
          walletAddress,
          type: 'BONUS',
          description: {
            contains: 'login streak bonus'
          },
          timestamp: {
            gte: todayUTC,
            lt: tomorrowUTC
          }
        }
      });

      if (todayBonus) {
        throw new Error('Daily bonus already claimed today');
      }

      // Update login streak
      const yesterdayUTC = new Date(todayUTC);
      yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);

      let newStreak = 1;
      let newLongestStreak = loginStreak.longestStreak;

      if (loginStreak.lastLoginDate) {
        const lastLoginUTC = new Date(loginStreak.lastLoginDate);
        const lastLoginDateOnly = new Date(Date.UTC(lastLoginUTC.getUTCFullYear(), lastLoginUTC.getUTCMonth(), lastLoginUTC.getUTCDate()));

        if (lastLoginDateOnly.getTime() === yesterdayUTC.getTime()) {
          newStreak = loginStreak.currentStreak + 1;
        } else if (lastLoginDateOnly.getTime() === todayUTC.getTime()) {
          newStreak = loginStreak.currentStreak;
        }
      }

      if (newStreak > newLongestStreak) {
        newLongestStreak = newStreak;
      }

      const updatedStreak = await tx.loginStreak.update({
        where: { walletAddress },
        data: {
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastLoginDate: todayUTC,
          lastClaimDate: todayUTC,
          totalLogins: {
            increment: 1
          }
        }
      });

      // Calculate bonus amount
      const bonusAmount = calculateProgressiveBonus(updatedStreak, user);

      // Update user balance
      await tx.user.update({
        where: { walletAddress },
        data: {
          swarsTokenBalance: {
            increment: bonusAmount
          }
        }
      });

      // Record transaction
      await tx.swarsTransaction.create({
        data: {
          walletAddress,
          type: 'BONUS',
          amount: bonusAmount,
          description: `Day ${updatedStreak.currentStreak} login streak bonus`,
          txSignature: null
        }
      });

      return { updatedStreak, bonusAmount };
    });

    const { updatedStreak, bonusAmount } = result;

    console.log(`✅ Daily bonus claimed: ${bonusAmount} SWARS for day ${updatedStreak.currentStreak} streak`);

    res.status(200).json({
      success: true,
      amount: bonusAmount,
      currentStreak: updatedStreak.currentStreak,
      longestStreak: updatedStreak.longestStreak,
      nextDayBonus: calculateProgressiveBonus({ currentStreak: updatedStreak.currentStreak + 1 }, {})
    });

  } catch (error) {
    console.error('❌ Daily bonus claim error:', error);
    res.status(400).json({
      error: error.message || 'Failed to claim daily bonus'
    });
  } finally {
    await prisma.$disconnect();
  }
}
