// Tournament details API for Vercel
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Tournament ID required' });
    }

    console.log(`🏆 Fetching tournament details: ${id}`);

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        participants: {
          include: { 
            user: {
              select: {
                walletAddress: true,
                username: true,
                profileImage: true
              }
            }
          },
          orderBy: { currentBalance: 'desc' }
        },
        _count: {
          select: { participants: true }
        }
      }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Get jackpot info
    const jackpot = await prisma.jackpotPool.findUnique({
      where: { tournamentId: id }
    });

    // Calculate prize distribution
    const participantCount = tournament._count.participants;
    const basePrize = tournament.entryFee * participantCount;
    const jackpotAmount = jackpot ? jackpot.totalAmount : 0;
    const totalPrizePool = basePrize + jackpotAmount;

    // Prize distribution percentages
    const prizeDistribution = {
      first: Math.floor(totalPrizePool * 0.50),
      second: Math.floor(totalPrizePool * 0.30), 
      third: Math.floor(totalPrizePool * 0.20)
    };

    const response = {
      ...tournament,
      participantCount,
      jackpot: {
        totalAmount: jackpotAmount,
        contributors: jackpot ? jackpot.contributors : 0
      },
      prizePool: {
        total: totalPrizePool,
        base: basePrize,
        jackpot: jackpotAmount,
        distribution: prizeDistribution
      },
      leaderboard: tournament.participants.map((participant, index) => ({
        rank: index + 1,
        userId: participant.userId,
        walletAddress: participant.user.walletAddress,
        username: participant.user.username || `Trader ${participant.user.walletAddress.slice(0, 8)}`,
        profileImage: participant.user.profileImage,
        currentBalance: participant.currentBalance,
        profitLoss: participant.currentBalance - tournament.startingBalance,
        profitLossPercentage: ((participant.currentBalance - tournament.startingBalance) / tournament.startingBalance) * 100,
        joinedAt: participant.joinedAt
      }))
    };

    console.log(`✅ Tournament ${id} details retrieved with ${participantCount} participants`);
    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Tournament details API error:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
