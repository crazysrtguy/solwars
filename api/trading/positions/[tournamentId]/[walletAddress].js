// Trading positions API for specific tournament and wallet
const { getPrismaClient, disconnectPrisma } = require('../../../_lib/prisma');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { tournamentId, walletAddress } = req.query;
  const prisma = getPrismaClient();

  try {
    if (req.method === 'GET') {
      // Get trading positions for user in tournament
      console.log(`📊 Fetching positions for ${walletAddress} in tournament ${tournamentId}`);

      try {
        const participant = await prisma.tournamentParticipant.findUnique({
          where: {
            tournamentId_userId: {
              tournamentId,
              userId: walletAddress
            }
          },
          include: {
            tournament: true
          }
        });

        if (!participant) {
          return res.status(404).json({
            error: 'Participant not found',
            message: 'User is not participating in this tournament'
          });
        }

        // Parse portfolio and trades
        const portfolio = typeof participant.portfolio === 'string' 
          ? JSON.parse(participant.portfolio) 
          : participant.portfolio || {};
          
        const trades = typeof participant.trades === 'string'
          ? JSON.parse(participant.trades)
          : participant.trades || [];

        // Calculate current positions
        const positions = Object.entries(portfolio).map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount: parseFloat(amount) || 0,
          symbol: getTokenSymbol(tokenAddress),
          name: getTokenName(tokenAddress)
        })).filter(pos => pos.amount > 0);

        const response = {
          tournamentId,
          walletAddress,
          currentBalance: participant.currentBalance,
          startingBalance: participant.startingBalance,
          positions,
          totalTrades: trades.length,
          lastTradeTime: trades.length > 0 ? trades[trades.length - 1].timestamp : null,
          joinedAt: participant.joinedAt
        };

        res.status(200).json(response);

      } catch (dbError) {
        console.error('❌ Database error fetching positions:', dbError);
        
        // Return empty positions if database error
        res.status(200).json({
          tournamentId,
          walletAddress,
          currentBalance: 10000,
          startingBalance: 10000,
          positions: [],
          totalTrades: 0,
          lastTradeTime: null,
          joinedAt: new Date(),
          message: 'Positions loaded with default values due to database issue'
        });
      }

    } else if (req.method === 'POST') {
      // Execute trade
      const { action, tokenAddress, amount, price } = req.body;

      if (!action || !tokenAddress || !amount || !price) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['action', 'tokenAddress', 'amount', 'price']
        });
      }

      console.log(`💰 Executing ${action} trade: ${amount} of ${tokenAddress} at $${price}`);

      try {
        const participant = await prisma.tournamentParticipant.findUnique({
          where: {
            tournamentId_userId: {
              tournamentId,
              userId: walletAddress
            }
          }
        });

        if (!participant) {
          return res.status(404).json({
            error: 'Participant not found'
          });
        }

        // Parse current portfolio and trades
        const portfolio = typeof participant.portfolio === 'string' 
          ? JSON.parse(participant.portfolio) 
          : participant.portfolio || {};
          
        const trades = typeof participant.trades === 'string'
          ? JSON.parse(participant.trades)
          : participant.trades || [];

        const totalValue = amount * price;
        let newBalance = participant.currentBalance;
        let newPortfolio = { ...portfolio };

        if (action === 'BUY') {
          if (newBalance < totalValue) {
            return res.status(400).json({
              error: 'Insufficient balance',
              available: newBalance,
              required: totalValue
            });
          }
          
          newBalance -= totalValue;
          newPortfolio[tokenAddress] = (newPortfolio[tokenAddress] || 0) + amount;
          
        } else if (action === 'SELL') {
          const currentHolding = newPortfolio[tokenAddress] || 0;
          if (currentHolding < amount) {
            return res.status(400).json({
              error: 'Insufficient tokens',
              available: currentHolding,
              required: amount
            });
          }
          
          newBalance += totalValue;
          newPortfolio[tokenAddress] = currentHolding - amount;
          
          // Remove token if balance is zero
          if (newPortfolio[tokenAddress] <= 0) {
            delete newPortfolio[tokenAddress];
          }
        }

        // Add trade to history
        const newTrade = {
          tokenAddress,
          action,
          amount,
          price,
          totalValue,
          timestamp: new Date().toISOString()
        };
        trades.push(newTrade);

        // Update participant
        await prisma.tournamentParticipant.update({
          where: {
            tournamentId_userId: {
              tournamentId,
              userId: walletAddress
            }
          },
          data: {
            currentBalance: newBalance,
            portfolio: JSON.stringify(newPortfolio),
            trades: JSON.stringify(trades)
          }
        });

        res.status(200).json({
          success: true,
          trade: newTrade,
          newBalance,
          newPortfolio
        });

      } catch (dbError) {
        console.error('❌ Database error executing trade:', dbError);
        res.status(500).json({
          error: 'Failed to execute trade',
          message: 'Database error occurred'
        });
      }

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('❌ Trading positions API error:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  } finally {
    await disconnectPrisma();
  }
};

// Helper functions
function getTokenSymbol(address) {
  const tokenMap = {
    'So11111111111111111111111111111111111111112': 'SOL',
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'RAY',
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ORCA',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT'
  };
  return tokenMap[address] || 'UNKNOWN';
}

function getTokenName(address) {
  const tokenMap = {
    'So11111111111111111111111111111111111111112': 'Wrapped SOL',
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'Jupiter',
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'Raydium',
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'Orca',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USD Coin',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'Tether USD'
  };
  return tokenMap[address] || 'Unknown Token';
}
