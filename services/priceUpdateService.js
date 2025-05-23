const { PrismaClient } = require('@prisma/client');
const TokenService = require('./tokenService');
const WebSocket = require('ws');
const cron = require('node-cron');

// Initialize Prisma client with error handling
let prisma;
try {
  prisma = new PrismaClient();
} catch (error) {
  console.error('❌ Failed to initialize Prisma client in PriceUpdateService:', error);
  // Create a mock prisma object to prevent crashes
  prisma = {
    tournament: {
      findMany: async () => [],
      findUnique: async () => null
    },
    tournamentParticipant: {
      findMany: async () => [],
      update: async () => null
    },
    tokenPriceSnapshot: {
      createMany: async () => null
    }
  };
}

class PriceUpdateService {
  constructor(server) {
    this.tokenService = new TokenService();
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // Map of client connections
    this.activeTournaments = new Map(); // Cache of active tournaments
    this.priceCache = new Map(); // Price cache
    this.updateInterval = 30000; // 30 seconds

    this.setupWebSocketServer();
    this.setupPriceUpdates();
    this.loadActiveTournaments();
  }

  // Setup WebSocket server for real-time updates
  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      console.log(`🔌 New WebSocket connection: ${clientId}`);

      // Store client connection
      this.clients.set(clientId, {
        ws,
        subscribedTournaments: new Set(),
        subscribedTokens: new Set(),
        subscribedToTrending: false,
        lastPing: Date.now()
      });

      // Handle client messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(clientId, data);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error.message);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log(`🔌 Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        clientId,
        timestamp: Date.now()
      }));
    });

    console.log('🚀 WebSocket server initialized for real-time price updates');
  }

  // Handle client messages (subscriptions, etc.)
  handleClientMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (data.type) {
      case 'subscribe_tournament':
        client.subscribedTournaments.add(data.tournamentId);
        console.log(`📡 Client ${clientId} subscribed to tournament ${data.tournamentId}`);

        // Send current tournament data
        this.sendTournamentUpdate(clientId, data.tournamentId);
        break;

      case 'unsubscribe_tournament':
        client.subscribedTournaments.delete(data.tournamentId);
        console.log(`📡 Client ${clientId} unsubscribed from tournament ${data.tournamentId}`);
        break;

      case 'subscribe_token':
        client.subscribedTokens.add(data.tokenAddress);
        console.log(`📡 Client ${clientId} subscribed to token ${data.tokenAddress}`);
        break;

      case 'subscribe_trending':
        client.subscribedToTrending = true;
        console.log(`📡 Client ${clientId} subscribed to trending tokens`);

        // Send current trending tokens immediately
        this.sendTrendingTokens(clientId);
        break;

      case 'unsubscribe_trending':
        client.subscribedToTrending = false;
        console.log(`📡 Client ${clientId} unsubscribed from trending tokens`);
        break;

      case 'ping':
        client.lastPing = Date.now();
        client.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        console.warn(`⚠️ Unknown message type: ${data.type}`);
    }
  }

  // Load active tournaments into cache
  async loadActiveTournaments() {
    try {
      const tournaments = await prisma.tournament.findMany({
        where: {
          status: 'ACTIVE'
        },
        include: {
          participants: true
        }
      });

      for (const tournament of tournaments) {
        this.activeTournaments.set(tournament.id, {
          ...tournament,
          tokenAddresses: tournament.selectedTokens.map(t => t.address)
        });
      }

      console.log(`📊 Loaded ${tournaments.length} active tournaments`);
    } catch (error) {
      console.error('❌ Error loading active tournaments:', error.message);
    }
  }

  // Setup periodic price updates
  setupPriceUpdates() {
    // Update prices every 30 seconds
    setInterval(async () => {
      await this.updateAllPrices();
    }, this.updateInterval);

    // Update tournament leaderboards every minute
    cron.schedule('* * * * *', async () => {
      await this.updateTournamentLeaderboards();
    });

    // Refresh active tournaments every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.loadActiveTournaments();
    });

    // Broadcast trending tokens every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
      await this.broadcastTrendingTokens();
    });

    console.log('⏰ Price update schedules initialized');
  }

  // Update all token prices for active tournaments
  async updateAllPrices() {
    try {
      // Get all unique token addresses from active tournaments
      const allTokenAddresses = new Set();

      for (const tournament of this.activeTournaments.values()) {
        tournament.tokenAddresses.forEach(addr => allTokenAddresses.add(addr));
      }

      if (allTokenAddresses.size === 0) {
        return; // No active tournaments
      }

      const tokenAddresses = Array.from(allTokenAddresses);
      console.log(`💰 Updating prices for ${tokenAddresses.length} tokens...`);

      // Fetch latest prices
      const prices = await this.tokenService.getTokenPrices(tokenAddresses);

      // Store price snapshots for each active tournament
      for (const [tournamentId, tournament] of this.activeTournaments.entries()) {
        const tournamentPrices = tournament.tokenAddresses
          .filter(addr => prices[addr])
          .map(addr => ({
            tournamentId,
            tokenAddress: addr,
            tokenSymbol: tournament.selectedTokens.find(t => t.address === addr)?.symbol || 'UNK',
            priceUsd: prices[addr].price,
            marketCap: prices[addr].marketCap,
            volume24h: prices[addr].volume24h,
            priceChange: prices[addr].priceChange,
            source: prices[addr].source
          }));

        if (tournamentPrices.length > 0) {
          await prisma.tokenPriceSnapshot.createMany({
            data: tournamentPrices
          });
        }
      }

      // Update price cache
      for (const [address, priceData] of Object.entries(prices)) {
        this.priceCache.set(address, {
          ...priceData,
          lastUpdated: Date.now()
        });
      }

      // Broadcast price updates to subscribed clients
      this.broadcastPriceUpdates(prices);

      console.log(`✅ Updated prices for ${Object.keys(prices).length} tokens`);
    } catch (error) {
      console.error('❌ Error updating prices:', error.message);
    }
  }

  // Update tournament leaderboards and broadcast
  async updateTournamentLeaderboards() {
    try {
      for (const [tournamentId, tournament] of this.activeTournaments.entries()) {
        // Get latest prices for tournament tokens
        const latestPrices = {};
        for (const tokenAddr of tournament.tokenAddresses) {
          const cached = this.priceCache.get(tokenAddr);
          if (cached) {
            latestPrices[tokenAddr] = cached.price;
          }
        }

        // Update participant balances based on current prices
        const participants = await prisma.tournamentParticipant.findMany({
          where: { tournamentId },
          include: { user: true }
        });

        for (const participant of participants) {
          let newBalance = participant.currentBalance;
          const portfolio = participant.portfolio || {};

          // Calculate portfolio value with current prices
          let portfolioValue = 0;
          for (const [tokenAddr, amount] of Object.entries(portfolio)) {
            if (latestPrices[tokenAddr] && amount > 0) {
              portfolioValue += amount * latestPrices[tokenAddr];
            }
          }

          // Update participant balance (cash + portfolio value)
          const cashBalance = participant.currentBalance - Object.values(portfolio).reduce((sum, amount) => {
            return sum + (amount * (participant.lastPrices?.[tokenAddr] || 0));
          }, 0);

          newBalance = Math.max(0, cashBalance + portfolioValue);

          if (Math.abs(newBalance - participant.currentBalance) > 0.01) {
            await prisma.tournamentParticipant.update({
              where: { id: participant.id },
              data: {
                currentBalance: newBalance,
                lastPrices: latestPrices
              }
            });
          }
        }

        // Broadcast leaderboard update
        this.broadcastTournamentUpdate(tournamentId);
      }
    } catch (error) {
      console.error('❌ Error updating tournament leaderboards:', error.message);
    }
  }

  // Broadcast price updates to subscribed clients
  broadcastPriceUpdates(prices) {
    const message = JSON.stringify({
      type: 'price_update',
      prices,
      timestamp: Date.now()
    });

    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        // Check if client is subscribed to any of these tokens
        const subscribedTokens = Array.from(client.subscribedTokens);
        const relevantPrices = {};

        for (const tokenAddr of subscribedTokens) {
          if (prices[tokenAddr]) {
            relevantPrices[tokenAddr] = prices[tokenAddr];
          }
        }

        if (Object.keys(relevantPrices).length > 0) {
          client.ws.send(JSON.stringify({
            type: 'price_update',
            prices: relevantPrices,
            timestamp: Date.now()
          }));
        }
      }
    }
  }

  // Broadcast tournament update to subscribed clients
  async broadcastTournamentUpdate(tournamentId) {
    try {
      // Get updated leaderboard
      const participants = await prisma.tournamentParticipant.findMany({
        where: { tournamentId },
        include: { user: true },
        orderBy: { currentBalance: 'desc' }
      });

      const leaderboard = participants.map((participant, index) => ({
        rank: index + 1,
        username: participant.user.username || `Trader ${participant.walletAddress.slice(-4)}`,
        walletAddress: participant.walletAddress,
        entryType: participant.entryType,
        currentBalance: participant.currentBalance,
        profit: participant.currentBalance - participant.startingBalance,
        profitPercent: ((participant.currentBalance - participant.startingBalance) / participant.startingBalance) * 100
      }));

      const message = JSON.stringify({
        type: 'tournament_update',
        tournamentId,
        leaderboard,
        timestamp: Date.now()
      });

      // Send to subscribed clients
      for (const [clientId, client] of this.clients.entries()) {
        if (client.ws.readyState === WebSocket.OPEN &&
            client.subscribedTournaments.has(tournamentId)) {
          client.ws.send(message);
        }
      }
    } catch (error) {
      console.error('❌ Error broadcasting tournament update:', error.message);
    }
  }

  // Send tournament data to specific client
  async sendTournamentUpdate(clientId, tournamentId) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          participants: {
            include: { user: true },
            orderBy: { currentBalance: 'desc' }
          }
        }
      });

      if (!tournament) return;

      const leaderboard = tournament.participants.map((participant, index) => ({
        rank: index + 1,
        username: participant.user.username || `Trader ${participant.walletAddress.slice(-4)}`,
        walletAddress: participant.walletAddress,
        entryType: participant.entryType,
        currentBalance: participant.currentBalance,
        profit: participant.currentBalance - participant.startingBalance,
        profitPercent: ((participant.currentBalance - participant.startingBalance) / participant.startingBalance) * 100
      }));

      client.ws.send(JSON.stringify({
        type: 'tournament_data',
        tournament: {
          id: tournament.id,
          name: tournament.name,
          status: tournament.status,
          startTime: tournament.startTime,
          endTime: tournament.endTime,
          selectedTokens: tournament.selectedTokens,
          participantCount: tournament.participants.length
        },
        leaderboard,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('❌ Error sending tournament update:', error.message);
    }
  }

  // Send trending tokens to specific client
  async sendTrendingTokens(clientId) {
    try {
      const client = this.clients.get(clientId);
      if (!client || client.ws.readyState !== WebSocket.OPEN) return;

      console.log(`📊 Sending trending tokens to client ${clientId}`);

      // Get trending tokens with DexScreener data
      const DexScreenerService = require('./dexScreenerService');
      const dexScreenerService = new DexScreenerService();
      const trendingTokens = await dexScreenerService.getTrendingTokens(10);

      client.ws.send(JSON.stringify({
        type: 'trending_tokens',
        tokens: trendingTokens,
        timestamp: Date.now()
      }));

      console.log(`✅ Sent ${trendingTokens.length} trending tokens to client ${clientId}`);
    } catch (error) {
      console.error(`❌ Error sending trending tokens to client ${clientId}:`, error.message);
    }
  }

  // Broadcast trending tokens to all subscribed clients
  async broadcastTrendingTokens() {
    try {
      console.log('📊 Broadcasting trending tokens to subscribed clients...');

      // Get trending tokens with DexScreener data
      const DexScreenerService = require('./dexScreenerService');
      const dexScreenerService = new DexScreenerService();
      const trendingTokens = await dexScreenerService.getTrendingTokens(10);

      const message = JSON.stringify({
        type: 'trending_tokens',
        tokens: trendingTokens,
        timestamp: Date.now()
      });

      let sentCount = 0;
      for (const [clientId, client] of this.clients.entries()) {
        if (client.ws.readyState === WebSocket.OPEN && client.subscribedToTrending) {
          client.ws.send(message);
          sentCount++;
        }
      }

      console.log(`✅ Broadcasted trending tokens to ${sentCount} subscribed clients`);
    } catch (error) {
      console.error('❌ Error broadcasting trending tokens:', error.message);
    }
  }

  // Generate unique client ID
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clean up inactive clients
  cleanupClients() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastPing > timeout) {
        console.log(`🧹 Cleaning up inactive client: ${clientId}`);
        client.ws.terminate();
        this.clients.delete(clientId);
      }
    }
  }

  // Get current price for a token
  getCurrentPrice(tokenAddress) {
    const cached = this.priceCache.get(tokenAddress);
    return cached ? cached.price : null;
  }

  // Set current price for a token
  setCurrentPrice(tokenAddress, price) {
    console.log(`💰 Setting price for ${tokenAddress}: $${price}`);
    this.priceCache.set(tokenAddress, {
      price: parseFloat(price),
      lastUpdated: Date.now(),
      source: 'manual'
    });
  }

  // Start automatic price updates
  startPriceUpdates() {
    console.log('🔄 Starting automatic price updates...');

    // Update prices every 30 seconds
    this.priceUpdateInterval = setInterval(async () => {
      await this.updateAllTokenPrices();
    }, 30000);

    // Also update immediately
    this.updateAllTokenPrices();
  }

  // Stop automatic price updates
  stopPriceUpdates() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
      console.log('⏹️ Stopped automatic price updates');
    }
  }

  // Update all tracked token prices
  async updateAllTokenPrices() {
    try {
      const trackedTokens = Array.from(this.priceCache.keys());

      if (trackedTokens.length === 0) {
        console.log('📊 No tokens to update');
        return;
      }

      console.log(`🔄 Updating prices for ${trackedTokens.length} tokens...`);

      // Split into chunks of 30 (DexScreener API limit)
      const chunks = [];
      for (let i = 0; i < trackedTokens.length; i += 30) {
        chunks.push(trackedTokens.slice(i, i + 30));
      }

      for (const chunk of chunks) {
        await this.updateTokenChunk(chunk);
        // Small delay between chunks to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('✅ Price update cycle completed');
    } catch (error) {
      console.error('❌ Error updating token prices:', error);
    }
  }

  // Update a chunk of tokens
  async updateTokenChunk(tokenAddresses) {
    try {
      const addressList = tokenAddresses.join(',');
      const url = `https://api.dexscreener.com/latest/dex/tokens/${addressList}`;

      console.log(`📡 Fetching prices for ${tokenAddresses.length} tokens...`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.pairs && data.pairs.length > 0) {
        // Group pairs by token address and get the best price
        const tokenPrices = {};

        for (const pair of data.pairs) {
          const tokenAddr = pair.baseToken?.address;
          if (!tokenAddr || !pair.priceUsd) continue;

          const price = parseFloat(pair.priceUsd);
          if (price > 0) {
            // Use the highest liquidity pair for price
            if (!tokenPrices[tokenAddr] ||
                (pair.liquidity?.usd || 0) > (tokenPrices[tokenAddr].liquidity || 0)) {
              tokenPrices[tokenAddr] = {
                price,
                liquidity: pair.liquidity?.usd || 0,
                volume24h: pair.volume?.h24 || 0,
                priceChange24h: pair.priceChange?.h24 || 0
              };
            }
          }
        }

        // Update cache with new prices
        let updatedCount = 0;
        for (const [address, priceData] of Object.entries(tokenPrices)) {
          const oldPrice = this.getCurrentPrice(address);

          this.priceCache.set(address, {
            price: priceData.price,
            lastUpdated: Date.now(),
            source: 'dexscreener',
            volume24h: priceData.volume24h,
            priceChange24h: priceData.priceChange24h,
            liquidity: priceData.liquidity
          });

          // Log significant price changes
          if (oldPrice && Math.abs((priceData.price - oldPrice) / oldPrice) > 0.01) {
            const change = ((priceData.price - oldPrice) / oldPrice * 100).toFixed(2);
            console.log(`📈 ${address.slice(0, 8)}... price: $${oldPrice.toFixed(6)} → $${priceData.price.toFixed(6)} (${change > 0 ? '+' : ''}${change}%)`);
          }

          updatedCount++;
        }

        console.log(`✅ Updated ${updatedCount} token prices`);

        // Broadcast price updates via WebSocket
        this.broadcastPriceUpdates(tokenPrices);

      } else {
        console.log('⚠️ No price data received from DexScreener');
      }
    } catch (error) {
      console.error('❌ Error updating token chunk:', error);
    }
  }

  // Broadcast price updates to connected clients
  broadcastPriceUpdates(tokenPrices) {
    if (this.wsClients && this.wsClients.size > 0) {
      const priceUpdate = {
        type: 'price_update',
        prices: tokenPrices,
        timestamp: Date.now()
      };

      this.wsClients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          try {
            client.send(JSON.stringify(priceUpdate));
          } catch (error) {
            console.error('❌ Error sending price update to client:', error);
          }
        }
      });

      console.log(`📡 Broadcasted price updates to ${this.wsClients.size} clients`);
    }
  }

  // Get all current prices
  getAllCurrentPrices() {
    const prices = {};
    for (const [address, data] of this.priceCache.entries()) {
      prices[address] = data.price;
    }
    return prices;
  }
}

module.exports = PriceUpdateService;
