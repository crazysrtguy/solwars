const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { tournamentId, walletAddress } = req.query;

    // Find user by wallet address
    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Get participant data
    const participant = await prisma.tournamentParticipant.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId: user.id
        }
      }
    });

    if (!participant) {
      res.status(404).json({
        success: false,
        error: 'Participant not found in tournament'
      });
      return;
    }

    // Get all transactions for position calculation
    const transactions = await prisma.tokenTransaction.findMany({
      where: {
        userId: user.id,
        tournamentId
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    // Calculate positions from transactions
    const positions = {};
    for (const tx of transactions) {
      if (!positions[tx.tokenAddress]) {
        positions[tx.tokenAddress] = 0;
      }

      if (tx.type === 'BUY') {
        positions[tx.tokenAddress] += tx.amount;
      } else if (tx.type === 'SELL') {
        positions[tx.tokenAddress] -= tx.amount;
      }
    }

    // Remove zero or negative positions
    Object.keys(positions).forEach(address => {
      if (positions[address] <= 0) {
        delete positions[address];
      }
    });

    // Calculate portfolio value (simplified - would need real price data)
    let portfolioValue = 0;
    // For now, just use a mock calculation
    for (const [tokenAddress, amount] of Object.entries(positions)) {
      // Mock price calculation - in real implementation, get from price service
      const mockPrice = 1.0; // Would get real price here
      portfolioValue += amount * mockPrice;
    }

    const totalValue = participant.currentBalance + portfolioValue;
    const profit = totalValue - participant.startingBalance;
    const profitPercent = (profit / participant.startingBalance) * 100;

    res.status(200).json({
      success: true,
      cashBalance: participant.currentBalance,
      portfolioValue,
      totalValue,
      profit,
      profitPercent,
      holdings: positions,
      startingBalance: participant.startingBalance,
      trades: participant.trades || []
    });

  } catch (error) {
    console.error('❌ Portfolio API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
