const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client with error handling
let prisma;
try {
  prisma = new PrismaClient();
} catch (error) {
  console.error('❌ Failed to initialize Prisma client in TradingService:', error);
  prisma = {
    tournamentParticipant: {
      findUnique: async () => null,
      update: async () => null
    },
    tokenTransaction: {
      create: async () => null
    },
    tokenPriceSnapshot: {
      findFirst: async () => null
    }
  };
}

class TradingService {
  constructor(priceService) {
    this.priceService = priceService;
  }

  // Execute a buy order
  async executeBuyOrder(tournamentId, userId, tokenAddress, amount, currentPrice) {
    try {
      console.log(`💰 Executing BUY order: ${amount} tokens at $${currentPrice}`);

      const participant = await prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId
          }
        }
      });

      if (!participant) {
        throw new Error('Participant not found in tournament');
      }

      const totalCost = amount * currentPrice;

      // Check if user has enough balance
      if (participant.currentBalance < totalCost) {
        throw new Error('Insufficient balance for this trade');
      }

      // Update portfolio
      const portfolio = participant.portfolio || {};
      const currentHolding = portfolio[tokenAddress] || 0;
      portfolio[tokenAddress] = currentHolding + amount;

      // Update trades history
      const trades = Array.isArray(participant.trades) ? participant.trades : [];
      const newTrade = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'BUY',
        tokenAddress,
        amount,
        price: currentPrice,
        totalValue: totalCost,
        timestamp: new Date().toISOString()
      };
      trades.push(newTrade);

      // Update participant
      const newBalance = participant.currentBalance - totalCost;
      await prisma.tournamentParticipant.update({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId
          }
        },
        data: {
          currentBalance: newBalance,
          portfolio,
          trades
        }
      });

      // Record transaction
      await this.recordTransaction(userId, tournamentId, tokenAddress, 'BUY', amount, currentPrice, totalCost);

      console.log(`✅ BUY order executed successfully`);
      return {
        success: true,
        trade: newTrade,
        newBalance,
        newPortfolio: portfolio
      };
    } catch (error) {
      console.error('❌ Error executing buy order:', error);
      throw error;
    }
  }

  // Calculate current position from database transactions
  async getCurrentPosition(tournamentId, userId, tokenAddress) {
    try {
      const transactions = await prisma.tokenTransaction.findMany({
        where: {
          userId,
          tournamentId,
          tokenAddress
        },
        orderBy: {
          timestamp: 'asc'
        }
      });

      let position = 0;
      for (const tx of transactions) {
        if (tx.type === 'BUY') {
          position += tx.amount;
        } else if (tx.type === 'SELL') {
          position -= tx.amount;
        }
      }

      return Math.max(0, position); // Can't have negative positions
    } catch (error) {
      console.error('❌ Error calculating position:', error);
      return 0;
    }
  }

  // Execute a sell order
  async executeSellOrder(tournamentId, userId, tokenAddress, amount, currentPrice) {
    try {
      console.log(`💸 Executing SELL order: ${amount} tokens at $${currentPrice}`);

      const participant = await prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId
          }
        }
      });

      if (!participant) {
        throw new Error('Participant not found in tournament');
      }

      // Check current position from database transactions
      const currentPosition = await this.getCurrentPosition(tournamentId, userId, tokenAddress);
      console.log(`📊 Current position for ${tokenAddress}: ${currentPosition} tokens`);

      if (currentPosition < amount) {
        throw new Error(`Insufficient tokens for this trade. You have ${currentPosition} tokens, trying to sell ${amount}`);
      }

      // Also update portfolio for consistency (use database position as source of truth)
      const portfolio = participant.portfolio || {};
      portfolio[tokenAddress] = currentPosition; // Sync with database

      const totalValue = amount * currentPrice;

      // Update portfolio
      const newPosition = currentPosition - amount;
      if (newPosition <= 0) {
        delete portfolio[tokenAddress];
      } else {
        portfolio[tokenAddress] = newPosition;
      }

      // Update trades history
      const trades = Array.isArray(participant.trades) ? participant.trades : [];
      const newTrade = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'SELL',
        tokenAddress,
        amount,
        price: currentPrice,
        totalValue,
        timestamp: new Date().toISOString()
      };
      trades.push(newTrade);

      // Update participant
      const newBalance = participant.currentBalance + totalValue;
      await prisma.tournamentParticipant.update({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId
          }
        },
        data: {
          currentBalance: newBalance,
          portfolio,
          trades
        }
      });

      // Record transaction
      await this.recordTransaction(userId, tournamentId, tokenAddress, 'SELL', amount, currentPrice, totalValue);

      console.log(`✅ SELL order executed successfully`);
      return {
        success: true,
        trade: newTrade,
        newBalance,
        newPortfolio: portfolio
      };
    } catch (error) {
      console.error('❌ Error executing sell order:', error);
      throw error;
    }
  }

  // Get all positions from database transactions
  async getAllPositions(tournamentId, userId) {
    try {
      const transactions = await prisma.tokenTransaction.findMany({
        where: {
          userId,
          tournamentId
        },
        orderBy: {
          timestamp: 'asc'
        }
      });

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

      return positions;
    } catch (error) {
      console.error('❌ Error getting positions:', error);
      return {};
    }
  }

  // Get participant's current portfolio value
  async getPortfolioValue(tournamentId, userId) {
    try {
      const participant = await prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId
          }
        }
      });

      if (!participant) {
        return { cashBalance: 0, portfolioValue: 0, totalValue: 0, holdings: {} };
      }

      // Get positions from database transactions (source of truth)
      const positions = await this.getAllPositions(tournamentId, userId);
      let portfolioValue = 0;

      // Calculate portfolio value with current prices
      for (const [tokenAddress, amount] of Object.entries(positions)) {
        const currentPrice = this.priceService.getCurrentPrice(tokenAddress);
        if (currentPrice && amount > 0) {
          portfolioValue += amount * currentPrice;
          console.log(`💰 ${tokenAddress}: ${amount} tokens × $${currentPrice} = $${(amount * currentPrice).toFixed(2)}`);
        }
      }

      return {
        cashBalance: participant.currentBalance,
        portfolioValue,
        totalValue: participant.currentBalance + portfolioValue,
        holdings: positions
      };
    } catch (error) {
      console.error('❌ Error calculating portfolio value:', error);
      return { cashBalance: 0, portfolioValue: 0, totalValue: 0, holdings: {} };
    }
  }

  // Get participant's trade history
  async getTradeHistory(tournamentId, userId, limit = 50) {
    try {
      const participant = await prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId
          }
        }
      });

      if (!participant) {
        return [];
      }

      const trades = Array.isArray(participant.trades) ? participant.trades : [];
      return trades
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (error) {
      console.error('❌ Error getting trade history:', error);
      return [];
    }
  }

  // Record transaction in database
  async recordTransaction(userId, tournamentId, tokenAddress, type, amount, price, totalValue) {
    try {
      // Get token symbol from price service or use address
      const tokenSymbol = tokenAddress.slice(0, 8) + '...'; // Simplified for now

      await prisma.tokenTransaction.create({
        data: {
          userId,
          tournamentId,
          tokenAddress,
          tokenSymbol,
          type,
          amount,
          price,
          totalValue
        }
      });
    } catch (error) {
      console.error('❌ Error recording transaction:', error);
    }
  }

  // Calculate profit/loss for a participant
  async calculateProfitLoss(tournamentId, userId) {
    try {
      const participant = await prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId
          }
        }
      });

      if (!participant) {
        return { profit: 0, profitPercent: 0 };
      }

      const currentValue = await this.getPortfolioValue(tournamentId, userId);
      const profit = currentValue.totalValue - participant.startingBalance;
      const profitPercent = (profit / participant.startingBalance) * 100;

      return { profit, profitPercent };
    } catch (error) {
      console.error('❌ Error calculating profit/loss:', error);
      return { profit: 0, profitPercent: 0 };
    }
  }

  // Get market data for tournament tokens
  async getMarketData(tournamentId) {
    try {
      // This would get the tournament's selected tokens and their current market data
      // For now, return mock data structure
      return {
        tokens: [],
        totalVolume: 0,
        topGainer: null,
        topLoser: null
      };
    } catch (error) {
      console.error('❌ Error getting market data:', error);
      return { tokens: [], totalVolume: 0, topGainer: null, topLoser: null };
    }
  }

  // Validate trade parameters
  validateTrade(type, amount, price) {
    if (!['BUY', 'SELL'].includes(type)) {
      throw new Error('Invalid trade type');
    }

    if (!amount || amount <= 0) {
      throw new Error('Invalid trade amount');
    }

    if (!price || price <= 0) {
      throw new Error('Invalid price');
    }

    return true;
  }

  // Calculate slippage for large trades
  calculateSlippage(amount, marketCap) {
    // Simple slippage calculation based on trade size vs market cap
    if (!marketCap || marketCap <= 0) return 0;

    const tradeImpact = amount / marketCap;
    const slippage = Math.min(tradeImpact * 100, 5); // Max 5% slippage

    return slippage;
  }
}

module.exports = TradingService;
