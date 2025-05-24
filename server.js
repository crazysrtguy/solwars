const express = require('express');
const cors = require('cors');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const { PublicKey, Keypair } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
require('dotenv').config();

// Import our epic services
const TokenService = require('./services/tokenService');
const TournamentService = require('./services/tournamentService');
const SwarsTokenService = require('./services/swarsTokenService');
const SolTransferService = require('./services/solTransferService');
const DexScreenerService = require('./services/dexScreenerService');
const PriceUpdateService = require('./services/priceUpdateService');
const TradingService = require('./services/tradingService');
const TournamentScheduler = require('./services/tournamentScheduler');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Initialize services
const tokenService = new TokenService();
const solTransferService = new SolTransferService();
const swarsService = new SwarsTokenService(solTransferService);
const tournamentService = new TournamentService();
const dexScreenerService = new DexScreenerService();
const priceService = new PriceUpdateService(server);
const tradingService = new TradingService(priceService);
const tournamentScheduler = new TournamentScheduler(tokenService);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from the current directory

console.log('🚀 SolWars Tournament Platform v2.0 - Initializing...');

// Generate a random challenge for the user to sign
const generateChallenge = () => {
  return `Sign this message to authenticate with SolWars: ${Math.floor(Math.random() * 1000000)}`;
};

// Verify a signature from a Solana wallet
const verifySignature = (message, signature, publicKey) => {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const publicKeyBytes = new PublicKey(publicKey).toBytes();
    const signatureBytes = bs58.decode(signature);

    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
};

// Routes

// Get a challenge to sign
app.get('/api/auth/challenge', (req, res) => {
  const challenge = generateChallenge();
  console.log('Generated challenge:', challenge);
  res.json({ challenge });
});

// Authenticate with a signed challenge
app.post('/api/auth/verify', async (req, res) => {
  const { walletAddress, signature, challenge } = req.body;

  console.log('Verifying signature for wallet:', walletAddress);
  console.log('Challenge:', challenge);
  console.log('Signature:', signature ? signature.substring(0, 20) + '...' : 'none');

  if (!walletAddress || !signature || !challenge) {
    console.log('Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Verify the signature
  const isValid = verifySignature(challenge, signature, walletAddress);
  console.log('Signature verification result:', isValid);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { leaderboard: true }
    });

    if (!user) {
      console.log('🔄 Creating new user for wallet:', walletAddress);
      // Create new user
      user = await prisma.user.create({
        data: {
          walletAddress,
          leaderboard: {
            create: {} // Create empty leaderboard entry
          }
        },
        include: { leaderboard: true }
      });
      console.log('✅ New user created with ID:', user.id);
    } else {
      console.log('✅ Found existing user:', user.id);
    }

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        leaderboard: user.leaderboard
      }
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Server error during authentication' });
  }
});

// Update username
app.put('/api/users/username', async (req, res) => {
  const { walletAddress, username } = req.body;

  if (!walletAddress || !username) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { walletAddress },
      data: { username },
    });

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({ error: 'Server error updating username' });
  }
});

// Save game results
app.post('/api/game/save', async (req, res) => {
  const { walletAddress, score, netWorth, days, completed } = req.body;

  if (!walletAddress || score === undefined || netWorth === undefined || !days) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Create game session
    const gameSession = await prisma.gameSession.create({
      data: {
        walletAddress,
        score,
        netWorth,
        days,
        completed,
        endDate: completed ? new Date() : null
      }
    });

    // Update leaderboard if completed game
    if (completed) {
      const user = await prisma.user.findUnique({
        where: { walletAddress },
        include: { leaderboard: true }
      });

      if (user && user.leaderboard) {
        await prisma.leaderboard.update({
          where: { id: user.leaderboard.id },
          data: {
            score: user.leaderboard.score + score,
            highScore: netWorth > user.leaderboard.highScore ? netWorth : user.leaderboard.highScore,
            gamesPlayed: user.leaderboard.gamesPlayed + 1,
            lastGameDate: new Date()
          }
        });
      }
    }

    res.json({ success: true, gameSession });
  } catch (error) {
    console.error('Error saving game:', error);
    res.status(500).json({ error: 'Server error saving game' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await prisma.leaderboard.findMany({
      orderBy: { highScore: 'desc' },
      take: 10,
      include: { user: true }
    });

    const formattedLeaderboard = leaderboard.map(entry => ({
      id: entry.id,
      username: entry.user.username || 'Anonymous Trader',
      walletAddress: entry.user.walletAddress,
      highScore: entry.highScore,
      gamesPlayed: entry.gamesPlayed,
      lastGameDate: entry.lastGameDate
    }));

    res.json(formattedLeaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Server error fetching leaderboard' });
  }
});

// Get top traders across all tournaments
app.get('/api/top-traders', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    console.log(`📊 Fetching top ${limit} traders`);

    const topTraders = await prisma.user.findMany({
      where: {
        tournamentsPlayed: {
          gt: 0 // Only include users who have played tournaments
        }
      },
      orderBy: { totalWinnings: 'desc' },
      take: limit,
      select: {
        id: true,
        username: true,
        walletAddress: true,
        totalWinnings: true,
        tournamentsWon: true,
        tournamentsPlayed: true,
        swarsTokenBalance: true,
        createdAt: true
      }
    });

    const formattedTraders = topTraders.map((trader, index) => ({
      rank: index + 1,
      username: trader.username || `Trader ${trader.walletAddress.slice(-4)}`,
      walletAddress: trader.walletAddress,
      totalWinnings: trader.totalWinnings,
      tournamentsWon: trader.tournamentsWon,
      tournamentsPlayed: trader.tournamentsPlayed,
      winRate: trader.tournamentsPlayed > 0 ?
        (trader.tournamentsWon / trader.tournamentsPlayed * 100) : 0,
      swarsBalance: trader.swarsTokenBalance,
      avgWinnings: trader.tournamentsWon > 0 ?
        (trader.totalWinnings / trader.tournamentsWon) : 0,
      memberSince: trader.createdAt
    }));

    res.json(formattedTraders);
  } catch (error) {
    console.error('❌ Error fetching top traders:', error);
    res.status(500).json({ error: 'Server error fetching top traders' });
  }
});

// ===== EPIC TOURNAMENT ENDPOINTS =====

// Get user's tournaments (must come before /api/tournaments/:id to avoid conflicts)
app.get('/api/tournaments/user/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    console.log(`🏆 Fetching tournaments for user: ${walletAddress}`);

    const userTournaments = await prisma.tournament.findMany({
      where: {
        participants: {
          some: {
            walletAddress: walletAddress
          }
        }
      },
      include: {
        participants: {
          include: { user: true },
          orderBy: { currentBalance: 'desc' }
        },
        _count: {
          select: { participants: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format tournaments with additional user-specific data
    const formattedTournaments = userTournaments.map(tournament => {
      const userParticipant = tournament.participants.find(p => p.walletAddress === walletAddress);
      const userRank = tournament.participants.findIndex(p => p.walletAddress === walletAddress) + 1;

      return {
        ...tournament,
        participantCount: tournament._count.participants,
        spotsLeft: tournament.maxParticipants - tournament._count.participants,
        timeUntilStart: tournament.startTime.getTime() - Date.now(),
        timeUntilEnd: tournament.endTime.getTime() - Date.now(),
        userParticipant: userParticipant ? {
          currentBalance: userParticipant.currentBalance,
          startingBalance: userParticipant.startingBalance,
          profit: userParticipant.currentBalance - userParticipant.startingBalance,
          profitPercent: ((userParticipant.currentBalance - userParticipant.startingBalance) / userParticipant.startingBalance) * 100,
          rank: userRank,
          entryType: userParticipant.entryType
        } : null
      };
    });

    res.json(formattedTournaments);
  } catch (error) {
    console.error('❌ Error fetching user tournaments:', error);
    res.status(500).json({ error: 'Server error fetching user tournaments' });
  }
});

// Get active tournaments with enhanced stats
app.get('/api/tournaments', async (req, res) => {
  try {
    console.log('🏆 Fetching active tournaments...');
    const tournaments = await tournamentService.getActiveTournaments();

    // Calculate stats for the availability indicator
    const activeTournaments = tournaments.filter(t => t.status === 'ACTIVE');
    const upcomingTournaments = tournaments.filter(t => t.status === 'UPCOMING');
    const joinableTournaments = tournaments.filter(t =>
      t.status === 'UPCOMING' ||
      (t.status === 'ACTIVE' && t.participantCount < t.maxParticipants)
    );

    const response = {
      tournaments,
      categories: {
        active: activeTournaments,
        upcoming: upcomingTournaments,
        joinable: joinableTournaments
      },
      stats: {
        total: tournaments.length,
        active: activeTournaments.length,
        upcoming: upcomingTournaments.length,
        joinable: joinableTournaments.length
      },
      message: `Found ${tournaments.length} tournaments (${joinableTournaments.length} joinable)`
    };

    console.log(`📊 Tournament Stats: ${response.stats.total} total, ${response.stats.active} active, ${response.stats.upcoming} upcoming, ${response.stats.joinable} joinable`);
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching tournaments:', error);
    res.status(500).json({
      error: 'Server error fetching tournaments',
      tournaments: [],
      categories: { active: [], upcoming: [], joinable: [] },
      stats: { total: 0, active: 0, upcoming: 0, joinable: 0 }
    });
  }
});

// Get tournament details
app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🏆 Fetching tournament details: ${id}`);

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        participants: {
          include: { user: true },
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

    const response = {
      ...tournament,
      participantCount: tournament._count.participants,
      spotsLeft: tournament.maxParticipants - tournament._count.participants,
      timeUntilStart: tournament.startTime.getTime() - Date.now(),
      timeUntilEnd: tournament.endTime.getTime() - Date.now(),
      jackpot: jackpot ? {
        totalPool: jackpot.totalPool,
        swarsContrib: jackpot.swarsContrib,
        bonusMultip: jackpot.bonusMultip
      } : null,
      leaderboard: tournament.participants.map((participant, index) => ({
        rank: index + 1,
        username: participant.user.username || `Trader ${participant.walletAddress.slice(-4)}`,
        walletAddress: participant.walletAddress,
        entryType: participant.entryType,
        currentBalance: participant.currentBalance,
        profit: participant.currentBalance - participant.startingBalance,
        profitPercent: ((participant.currentBalance - participant.startingBalance) / participant.startingBalance) * 100
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching tournament details:', error);
    res.status(500).json({ error: 'Server error fetching tournament details' });
  }
});

// Join tournament
app.post('/api/tournaments/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { walletAddress, entryType = 'SOL' } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    console.log(`🎮 User ${walletAddress} joining tournament ${id} with ${entryType}`);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user) {
      console.log(`🔄 User not found for ${walletAddress}, creating new user...`);
      // Create user if they don't exist (they might have paid but not completed full auth)
      user = await prisma.user.create({
        data: {
          walletAddress,
          leaderboard: {
            create: {} // Create empty leaderboard entry
          }
        },
        include: { leaderboard: true }
      });
      console.log(`✅ Created new user with ID: ${user.id}`);
    }

    // Join tournament
    const participant = await tournamentService.joinTournament(id, user.id, walletAddress, entryType);

    res.json({
      success: true,
      participant,
      message: `Successfully joined tournament with ${entryType}!`
    });
  } catch (error) {
    console.error('❌ Error joining tournament:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get tournament leaderboard
app.get('/api/tournaments/:id/leaderboard', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📊 Fetching leaderboard for tournament ${id}`);

    const leaderboard = await tournamentService.getTournamentLeaderboard(id);
    res.json(leaderboard);
  } catch (error) {
    console.error('❌ Error fetching tournament leaderboard:', error);
    res.status(500).json({ error: 'Server error fetching leaderboard' });
  }
});

// Get tournament prize structure
app.get('/api/tournaments/:id/prize-structure', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`💰 Fetching prize structure for tournament ${id}`);

    const prizeStructure = await tournamentService.calculatePrizeStructure(id);
    res.json(prizeStructure);
  } catch (error) {
    console.error('❌ Error fetching prize structure:', error);
    res.status(500).json({ error: 'Server error fetching prize structure' });
  }
});

// Get potential winnings for a user
app.get('/api/tournaments/:id/potential-winnings/:walletAddress', async (req, res) => {
  try {
    const { id, walletAddress } = req.params;
    console.log(`🎯 Fetching potential winnings for ${walletAddress} in tournament ${id}`);

    const potentialWinnings = await tournamentService.getPotentialWinnings(id, walletAddress);
    res.json(potentialWinnings);
  } catch (error) {
    console.error('❌ Error fetching potential winnings:', error);
    res.status(500).json({ error: 'Server error fetching potential winnings' });
  }
});

// Get unclaimed prizes for a user
app.get('/api/prizes/unclaimed/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    console.log(`💰 Fetching unclaimed prizes for ${walletAddress}`);

    const unclaimedPrizes = await tournamentService.getUnclaimedPrizes(walletAddress);
    res.json(unclaimedPrizes);
  } catch (error) {
    console.error('❌ Error fetching unclaimed prizes:', error);
    res.status(500).json({ error: 'Server error fetching unclaimed prizes' });
  }
});

// Claim a prize
app.post('/api/prizes/claim', async (req, res) => {
  try {
    const { walletAddress, tournamentId } = req.body;
    console.log(`💰 Processing prize claim for ${walletAddress} in tournament ${tournamentId}`);

    // Enhanced security validation
    if (!walletAddress || !tournamentId) {
      return res.status(400).json({ error: 'Wallet address and tournament ID required' });
    }

    // Validate wallet address format
    try {
      new PublicKey(walletAddress);
    } catch (error) {
      console.log(`❌ Invalid wallet address format: ${walletAddress}`);
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    // Rate limiting: Check for recent claims from this wallet
    const recentClaims = await prisma.prizeClaim.count({
      where: {
        walletAddress,
        claimedAt: {
          gte: new Date(Date.now() - 60000) // Last 1 minute
        }
      }
    });

    if (recentClaims >= 3) {
      console.log(`❌ Rate limit exceeded for wallet: ${walletAddress}`);
      return res.status(429).json({ error: 'Too many claim attempts. Please wait before trying again.' });
    }

    // Additional security: Verify the wallet actually participated in the tournament
    const participation = await prisma.tournamentParticipant.findFirst({
      where: {
        tournamentId,
        walletAddress
      }
    });

    if (!participation) {
      console.log(`❌ Wallet ${walletAddress} did not participate in tournament ${tournamentId}`);
      return res.status(403).json({ error: 'You did not participate in this tournament' });
    }

    const claimResult = await tournamentService.claimPrize(walletAddress, tournamentId);
    res.json(claimResult);
  } catch (error) {
    console.error('❌ Error claiming prize:', error);
    res.status(400).json({ error: error.message });
  }
});

// Complete prize claim after SOL transfer
app.post('/api/prizes/complete-claim', async (req, res) => {
  try {
    const { walletAddress, tournamentId, transactionHash } = req.body;
    console.log(`✅ Completing prize claim for ${walletAddress} in tournament ${tournamentId}`);

    if (!walletAddress || !tournamentId) {
      return res.status(400).json({ error: 'Wallet address and tournament ID required' });
    }

    const claimResult = await tournamentService.completePrizeClaim(walletAddress, tournamentId, transactionHash);
    res.json(claimResult);
  } catch (error) {
    console.error('❌ Error completing prize claim:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get prize history for a user
app.get('/api/prizes/history/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    console.log(`📜 Fetching prize history for ${walletAddress}`);

    const prizeHistory = await tournamentService.getPrizeHistory(walletAddress);
    res.json(prizeHistory);
  } catch (error) {
    console.error('❌ Error fetching prize history:', error);
    res.status(500).json({ error: 'Server error fetching prize history' });
  }
});

// Create instant tournament (starts immediately)
app.post('/api/tournaments/create-instant', async (req, res) => {
  try {
    console.log('🚀 Creating instant tournament...');

    const tournamentConfig = {
      name: `Instant Battle ${new Date().toLocaleTimeString()}`,
      description: 'Quick 30-minute trading battle with real Solana tokens!',
      type: 'FLASH', // Use FLASH instead of BLITZ (which doesn't exist in schema)
      duration: 30, // 30 minutes
      entryFeeSol: 0.05, // Lower entry fee for instant
      entryFeeSwars: 500,
      maxParticipants: 50,
      startNow: true
    };

    console.log('📋 Tournament config:', tournamentConfig);
    const tournament = await tournamentService.createTournament(tournamentConfig);

    res.json({
      success: true,
      tournament,
      message: `Instant tournament created and starting now!`
    });
  } catch (error) {
    console.error('❌ Error creating instant tournament:', error);
    console.error('❌ Full error details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create instant tournament'
    });
  }
});

// Debug endpoint to check scheduler status and force tournament creation
app.get('/api/tournaments/debug/scheduler', async (req, res) => {
  try {
    console.log('🔍 Checking tournament scheduler status...');

    // Check current tournaments in database
    const tournaments = await prisma.tournament.findMany({
      where: {
        status: {
          in: ['UPCOMING', 'ACTIVE']
        }
      },
      orderBy: { startTime: 'asc' }
    });

    // Check scheduler status
    const schedulerStatus = {
      isRunning: tournamentScheduler.isRunning,
      scheduledJobs: tournamentScheduler.scheduledJobs.size,
      jobNames: Array.from(tournamentScheduler.scheduledJobs.keys())
    };

    res.json({
      success: true,
      scheduler: schedulerStatus,
      tournaments: {
        total: tournaments.length,
        active: tournaments.filter(t => t.status === 'ACTIVE').length,
        upcoming: tournaments.filter(t => t.status === 'UPCOMING').length,
        list: tournaments.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
          status: t.status,
          startTime: t.startTime,
          endTime: t.endTime,
          participantCount: 0 // Will be filled by join query if needed
        }))
      },
      message: 'Tournament scheduler debug info'
    });
  } catch (error) {
    console.error('❌ Error checking scheduler status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Force tournament creation endpoint
app.post('/api/tournaments/debug/force-create', async (req, res) => {
  try {
    console.log('🔧 Force creating tournaments...');

    // Force the scheduler to ensure tournament availability
    await tournamentScheduler.ensureTournamentAvailability();

    // Get updated tournament list
    const tournaments = await prisma.tournament.findMany({
      where: {
        status: {
          in: ['UPCOMING', 'ACTIVE']
        }
      },
      orderBy: { startTime: 'asc' }
    });

    res.json({
      success: true,
      message: 'Forced tournament creation completed',
      tournaments: {
        total: tournaments.length,
        active: tournaments.filter(t => t.status === 'ACTIVE').length,
        upcoming: tournaments.filter(t => t.status === 'UPCOMING').length
      }
    });
  } catch (error) {
    console.error('❌ Error forcing tournament creation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== SWARS TOKEN ENDPOINTS =====

// Get user SWARS balance
app.get('/api/swars/balance/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const balance = await swarsService.getUserBalance(walletAddress);
    res.json({ balance });
  } catch (error) {
    console.error('❌ Error fetching SWARS balance:', error);
    res.status(500).json({ error: 'Server error fetching balance' });
  }
});

// Claim daily bonus with progressive streak
app.post('/api/swars/daily-bonus', async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const bonusResult = await swarsService.claimDailyBonus(walletAddress);

    // Handle both old and new response formats
    if (typeof bonusResult === 'number') {
      // Legacy response format
      res.json({
        success: true,
        amount: bonusResult,
        message: `Claimed ${bonusResult} SWARS daily bonus!`
      });
    } else {
      // New progressive streak format
      res.json({
        success: true,
        amount: bonusResult.amount,
        currentStreak: bonusResult.currentStreak,
        longestStreak: bonusResult.longestStreak,
        nextDayBonus: bonusResult.nextDayBonus,
        message: `🔥 Day ${bonusResult.currentStreak} streak! Claimed ${bonusResult.amount} SWARS!`
      });
    }
  } catch (error) {
    console.error('❌ Error claiming daily bonus:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get login streak information
app.get('/api/swars/streak/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    console.log(`📊 Fetching login streak for ${walletAddress}`);

    const streakInfo = await swarsService.getLoginStreakInfo(walletAddress);
    res.json(streakInfo);
  } catch (error) {
    console.error('❌ Error fetching login streak:', error);
    res.status(500).json({ error: 'Server error fetching login streak' });
  }
});

// Get SWARS token stats
app.get('/api/swars/stats', async (req, res) => {
  try {
    const stats = await swarsService.getTokenStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching SWARS stats:', error);
    res.status(500).json({ error: 'Server error fetching stats' });
  }
});

// ===== REAL TOKEN PRICE ENDPOINTS =====

// Get trending tokens with comprehensive DexScreener data
app.get('/api/tokens/trending', async (req, res) => {
  try {
    console.log('🔥 Fetching trending tokens with DexScreener data...');
    const limit = parseInt(req.query.limit) || 10;

    // First get the original trending tokens (with images)
    const originalTrending = await tokenService.getTrendingTokens(limit);
    console.log(`📊 Got ${originalTrending.length} original trending tokens`);

    if (originalTrending && originalTrending.length > 0) {
      // Extract token addresses from trending list
      const tokenAddresses = originalTrending.map(token =>
        token.address || token.tokenAddress || token.ca
      ).filter(Boolean);

      console.log(`🔍 Enriching ${tokenAddresses.length} trending tokens with DexScreener data...`);

      // Get comprehensive trading data from DexScreener
      const tradingData = await dexScreenerService.getMultipleTokensData(tokenAddresses);

      // Merge trending data with trading data
      const enrichedTrending = originalTrending.map(trendingToken => {
        const address = trendingToken.address || trendingToken.tokenAddress || trendingToken.ca;
        const trading = tradingData[address];

        if (trading && trading.price > 0) {
          return {
            // Keep original trending data (especially images)
            ...trendingToken,

            // Add/override with DexScreener trading data
            address: address,
            name: trading.name || trendingToken.name,
            symbol: trading.symbol || trendingToken.symbol,

            // Price data from DexScreener
            price: trading.price,
            priceNative: trading.priceNative,

            // Market data
            marketCap: trading.marketCap || trendingToken.marketCap,
            fdv: trading.fdv,

            // Volume data
            volume24h: trading.volume24h || trendingToken.volume24h,
            volume6h: trading.volume6h,
            volume1h: trading.volume1h,

            // Price changes
            priceChange24h: trading.priceChange24h || trendingToken.priceChange24h,
            priceChange6h: trading.priceChange6h,
            priceChange1h: trading.priceChange1h,

            // Transaction data
            txns24h: trading.txns24h,
            buys24h: trading.buys24h,
            sells24h: trading.sells24h,

            // Liquidity
            liquidity: trading.liquidity,
            liquidityBase: trading.liquidityBase,
            liquidityQuote: trading.liquidityQuote,

            // Visual data (prefer original trending images)
            icon: trendingToken.icon || trendingToken.image || trading.icon,
            image: trendingToken.image || trendingToken.icon || trading.icon,
            header: trading.header,

            // Social links
            website: trading.website || trendingToken.website,
            twitter: trading.twitter || trendingToken.twitter,
            telegram: trading.telegram || trendingToken.telegram,
            discord: trading.discord || trendingToken.discord,

            // DEX info
            dexId: trading.dexId,
            pairAddress: trading.pairAddress,
            url: trading.url,

            // Chain info
            chainId: trading.chainId || 'solana',

            // Quote token info
            quoteToken: trading.quoteToken,

            // Timestamps
            pairCreatedAt: trading.pairCreatedAt,
            timestamp: Date.now()
          };
        } else {
          console.warn(`⚠️ No trading data found for trending token: ${address}`);
          // Return original trending token even without trading data
          return {
            ...trendingToken,
            address: address,
            price: trendingToken.price || 0,
            chainId: 'solana'
          };
        }
      });

      console.log(`✅ Returning ${enrichedTrending.length} enriched trending tokens`);
      res.json(enrichedTrending);
    } else {
      // Fallback to DexScreener only
      console.log('📊 No original trending tokens, using DexScreener fallback...');
      const fallbackTokens = await dexScreenerService.getTrendingTokens(limit);
      res.json(fallbackTokens);
    }
  } catch (error) {
    console.error('❌ Error fetching trending tokens:', error);
    res.status(500).json({ error: 'Server error fetching trending tokens' });
  }
});

// Get token prices
app.post('/api/tokens/prices', async (req, res) => {
  try {
    const { tokenAddresses } = req.body;

    if (!tokenAddresses || !Array.isArray(tokenAddresses)) {
      return res.status(400).json({ error: 'Token addresses array required' });
    }

    console.log(`💰 Fetching prices for ${tokenAddresses.length} tokens...`);
    const prices = await dexScreenerService.getTokenPrices(tokenAddresses);
    res.json(prices);
  } catch (error) {
    console.error('❌ Error fetching token prices:', error);
    res.status(500).json({ error: 'Server error fetching prices' });
  }
});

// Get token data by address
app.get('/api/tokens/:address', async (req, res) => {
  try {
    const { address } = req.params;
    console.log(`🔍 Fetching DexScreener data for token: ${address}`);

    const tokenData = await dexScreenerService.getTokenData(address);

    if (tokenData) {
      res.json(tokenData);
    } else {
      res.status(404).json({ error: 'Token not found' });
    }
  } catch (error) {
    console.error('❌ Error fetching token data:', error);
    res.status(500).json({ error: 'Server error fetching token data' });
  }
});

// Get multiple token data
app.post('/api/tokens/batch', async (req, res) => {
  try {
    const { tokenAddresses } = req.body;
    console.log(`🔍 Fetching DexScreener data for ${tokenAddresses.length} tokens...`);

    const tokenData = await dexScreenerService.getMultipleTokensData(tokenAddresses);
    res.json(tokenData);
  } catch (error) {
    console.error('❌ Error fetching batch token data:', error);
    res.status(500).json({ error: 'Server error fetching batch token data' });
  }
});

// Search tokens
app.get('/api/tokens/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    console.log(`🔍 Searching tokens for: ${query}`);

    const searchResults = await dexScreenerService.searchTokens(query, limit);
    res.json(searchResults);
  } catch (error) {
    console.error('❌ Error searching tokens:', error);
    res.status(500).json({ error: 'Server error searching tokens' });
  }
});

// Test DexScreener API endpoint
app.get('/api/test/dexscreener/:address', async (req, res) => {
  try {
    const { address } = req.params;
    console.log(`🧪 Testing DexScreener API for: ${address}`);

    // Make direct API call to test
    const axios = require('axios');
    const response = await axios.get(`https://api.dexscreener.com/tokens/v1/solana/${address}`);

    console.log(`📊 DexScreener response:`, {
      status: response.status,
      dataLength: response.data?.length || 0,
      firstPair: response.data?.[0] ? {
        symbol: response.data[0].baseToken?.symbol,
        price: response.data[0].priceUsd,
        volume: response.data[0].volume?.h24
      } : null
    });

    res.json({
      success: true,
      rawData: response.data,
      processed: await dexScreenerService.getTokenData(address)
    });
  } catch (error) {
    console.error('❌ Error testing DexScreener API:', error);
    res.status(500).json({
      error: 'Test failed',
      message: error.message,
      details: error.response?.data || null
    });
  }
});

// Get current prices from cache
app.get('/api/prices/current', async (req, res) => {
  try {
    const prices = priceService.getAllCurrentPrices();
    res.json(prices);
  } catch (error) {
    console.error('❌ Error fetching current prices:', error);
    res.status(500).json({ error: 'Server error fetching current prices' });
  }
});

// Register token with price service
app.post('/api/prices/register', async (req, res) => {
  try {
    const { address, symbol, price } = req.body;

    if (!address || !symbol || price === undefined) {
      return res.status(400).json({ error: 'Missing required fields: address, symbol, price' });
    }

    console.log(`💰 Registering token ${symbol} (${address}) with price $${price}`);

    // Register token with price service
    priceService.setCurrentPrice(address, price);

    // Verify it was set
    const verifyPrice = priceService.getCurrentPrice(address);
    console.log(`✅ Verification: ${symbol} price is now $${verifyPrice}`);

    res.json({
      success: true,
      message: `Token ${symbol} registered with price $${price}`,
      verifiedPrice: verifyPrice
    });
  } catch (error) {
    console.error('❌ Error registering token price:', error);
    res.status(500).json({ error: 'Server error registering token price' });
  }
});

// ===== EPIC TRADING ENDPOINTS =====

// Execute buy order
app.post('/api/trading/buy', async (req, res) => {
  try {
    const { tournamentId, walletAddress, tokenAddress, amount } = req.body;

    if (!tournamentId || !walletAddress || !tokenAddress || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get current price - try multiple sources
    let currentPrice = null;

    // First try the price service
    currentPrice = priceService.getCurrentPrice(tokenAddress);
    console.log(`🔍 Price service result for ${tokenAddress}: $${currentPrice}`);

    // If not found, get from tournament token metadata
    if (!currentPrice) {
      console.log(`🔄 Price service failed, checking tournament metadata...`);
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId }
      });

      if (tournament && tournament.tokenMetadata) {
        const tokenMeta = tournament.tokenMetadata[tokenAddress];
        if (tokenMeta && tokenMeta.price) {
          currentPrice = parseFloat(tokenMeta.price);
          console.log(`✅ Found price in tournament metadata: $${currentPrice}`);
        }
      }
    }

    // If still not found, try selected tokens array
    if (!currentPrice) {
      console.log(`🔄 Checking tournament selectedTokens...`);
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId }
      });

      if (tournament && tournament.selectedTokens) {
        const token = tournament.selectedTokens.find(t => t.address === tokenAddress);
        if (token && token.price) {
          currentPrice = parseFloat(token.price);
          console.log(`✅ Found price in selectedTokens: $${currentPrice}`);
        }
      }
    }

    if (!currentPrice || currentPrice <= 0) {
      console.error(`❌ No valid price found for token ${tokenAddress}`);
      return res.status(400).json({
        error: 'Price not available for this token',
        tokenAddress
      });
    }

    console.log(`💰 Using price for ${tokenAddress}: $${currentPrice}`);

    // Validate trade
    tradingService.validateTrade('BUY', amount, currentPrice);

    // Execute trade
    const result = await tradingService.executeBuyOrder(
      tournamentId,
      user.id,
      tokenAddress,
      parseFloat(amount),
      currentPrice
    );

    // Transaction recording is handled by the trading service

    res.json({
      success: true,
      trade: result.trade,
      newBalance: result.newBalance,
      portfolio: result.newPortfolio,
      message: `Successfully bought ${amount} tokens at $${currentPrice.toFixed(6)}`
    });
  } catch (error) {
    console.error('❌ Error executing buy order:', error);
    res.status(400).json({ error: error.message });
  }
});

// Execute sell order
app.post('/api/trading/sell', async (req, res) => {
  try {
    const { tournamentId, walletAddress, tokenAddress, amount } = req.body;

    if (!tournamentId || !walletAddress || !tokenAddress || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get current price - try multiple sources
    let currentPrice = null;

    // First try the price service
    currentPrice = priceService.getCurrentPrice(tokenAddress);

    // If not found, get from tournament token metadata
    if (!currentPrice) {
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId }
      });

      if (tournament && tournament.tokenMetadata) {
        const tokenMeta = tournament.tokenMetadata[tokenAddress];
        if (tokenMeta && tokenMeta.price) {
          currentPrice = parseFloat(tokenMeta.price);
        }
      }
    }

    // If still not found, try selected tokens array
    if (!currentPrice) {
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId }
      });

      if (tournament && tournament.selectedTokens) {
        const token = tournament.selectedTokens.find(t => t.address === tokenAddress);
        if (token && token.price) {
          currentPrice = parseFloat(token.price);
        }
      }
    }

    if (!currentPrice || currentPrice <= 0) {
      return res.status(400).json({
        error: 'Price not available for this token',
        tokenAddress
      });
    }

    // Validate trade
    tradingService.validateTrade('SELL', amount, currentPrice);

    // Execute trade
    const result = await tradingService.executeSellOrder(
      tournamentId,
      user.id,
      tokenAddress,
      parseFloat(amount),
      currentPrice
    );

    // Transaction recording is handled by the trading service

    res.json({
      success: true,
      trade: result.trade,
      newBalance: result.newBalance,
      portfolio: result.newPortfolio,
      message: `Successfully sold ${amount} tokens at $${currentPrice.toFixed(6)}`
    });
  } catch (error) {
    console.error('❌ Error executing sell order:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get portfolio value
app.get('/api/trading/portfolio/:tournamentId/:walletAddress', async (req, res) => {
  try {
    const { tournamentId, walletAddress } = req.params;

    // Get user
    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const portfolioValue = await tradingService.getPortfolioValue(tournamentId, user.id);
    const profitLoss = await tradingService.calculateProfitLoss(tournamentId, user.id);

    res.json({
      ...portfolioValue,
      ...profitLoss
    });
  } catch (error) {
    console.error('❌ Error getting portfolio value:', error);
    res.status(500).json({ error: 'Server error getting portfolio value' });
  }
});

// Get trade history
app.get('/api/trading/history/:tournamentId/:walletAddress', async (req, res) => {
  try {
    const { tournamentId, walletAddress } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Get user
    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const trades = await tradingService.getTradeHistory(tournamentId, user.id, limit);
    res.json(trades);
  } catch (error) {
    console.error('❌ Error getting trade history:', error);
    res.status(500).json({ error: 'Server error getting trade history' });
  }
});

// Get detailed positions with buy prices and P&L
app.get('/api/trading/positions/:tournamentId/:walletAddress', async (req, res) => {
  try {
    const { tournamentId, walletAddress } = req.params;

    if (!tournamentId || !walletAddress) {
      return res.status(400).json({ error: 'Tournament ID and wallet address required' });
    }

    console.log(`📊 Getting detailed positions for ${walletAddress} in tournament ${tournamentId}`);

    // Get user
    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get tournament data for token metadata
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId }
    });

    // Get all transactions for this user in this tournament
    const transactions = await prisma.tokenTransaction.findMany({
      where: {
        userId: user.id,
        tournamentId
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    if (transactions.length === 0) {
      return res.status(200).json({
        success: true,
        positions: [],
        totalPositions: 0,
        totalValue: 0,
        totalPnL: 0
      });
    }

    // Calculate positions with detailed buy price tracking
    const positionMap = new Map();

    for (const tx of transactions) {
      const { tokenAddress, type, amount, price, totalValue, timestamp } = tx;

      if (!positionMap.has(tokenAddress)) {
        positionMap.set(tokenAddress, {
          tokenAddress,
          tokenSymbol: tx.tokenSymbol,
          totalAmount: 0,
          totalCost: 0,
          averageBuyPrice: 0,
          transactions: [],
          firstBuyTime: null,
          lastTradeTime: null
        });
      }

      const position = positionMap.get(tokenAddress);

      if (type === 'BUY') {
        position.totalAmount += amount;
        position.totalCost += totalValue;
        position.averageBuyPrice = position.totalCost / position.totalAmount;

        if (!position.firstBuyTime) {
          position.firstBuyTime = timestamp;
        }
      } else if (type === 'SELL') {
        // For sells, reduce position proportionally
        const sellRatio = amount / position.totalAmount;
        position.totalCost -= position.totalCost * sellRatio;
        position.totalAmount -= amount;

        if (position.totalAmount > 0) {
          position.averageBuyPrice = position.totalCost / position.totalAmount;
        }
      }

      position.transactions.push({
        type,
        amount,
        price,
        totalValue,
        timestamp
      });

      position.lastTradeTime = timestamp;
    }

    // Filter out positions with zero or negative amounts
    const activePositions = Array.from(positionMap.values()).filter(pos => pos.totalAmount > 0);

    // Get current prices for all tokens
    const tokenAddresses = activePositions.map(pos => pos.tokenAddress);
    const currentPrices = {};

    for (const address of tokenAddresses) {
      currentPrices[address] = priceService.getCurrentPrice(address) || 0;
    }

    // Get token metadata from tournament or fetch from DexScreener
    const tokenMetadata = {};

    // First try to get metadata from tournament
    if (tournament && tournament.tokenMetadata) {
      for (const address of tokenAddresses) {
        if (tournament.tokenMetadata[address]) {
          tokenMetadata[address] = tournament.tokenMetadata[address];
        }
      }
    }

    // For missing metadata, try to get from selected tokens
    if (tournament && tournament.selectedTokens) {
      for (const address of tokenAddresses) {
        if (!tokenMetadata[address]) {
          const selectedToken = tournament.selectedTokens.find(t => t.address === address);
          if (selectedToken) {
            tokenMetadata[address] = selectedToken;
          }
        }
      }
    }

    // For still missing metadata, fetch from DexScreener
    const missingMetadata = tokenAddresses.filter(addr => !tokenMetadata[addr]);
    if (missingMetadata.length > 0) {
      try {
        console.log(`🔍 Fetching metadata for ${missingMetadata.length} tokens from DexScreener...`);
        const enrichedData = await dexScreenerService.getComprehensiveTokenData(missingMetadata);

        for (const tokenData of enrichedData) {
          tokenMetadata[tokenData.address] = tokenData;
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch token metadata from DexScreener:', error.message);
      }
    }

    // Calculate detailed position data with P&L and rich metadata
    const detailedPositions = activePositions.map(position => {
      const currentPrice = currentPrices[position.tokenAddress] || 0;
      const currentValue = position.totalAmount * currentPrice;
      const pnl = currentValue - position.totalCost;
      const pnlPercent = position.totalCost > 0 ? (pnl / position.totalCost) * 100 : 0;

      // Get token metadata
      const metadata = tokenMetadata[position.tokenAddress] || {};

      return {
        tokenAddress: position.tokenAddress,
        tokenSymbol: position.tokenSymbol,
        tokenName: metadata.name || metadata.tokenName || 'Unknown Token',
        tokenIcon: metadata.icon || metadata.image || metadata.imageUrl || null,
        amount: position.totalAmount,
        averageBuyPrice: position.averageBuyPrice,
        currentPrice,
        totalCost: position.totalCost,
        currentValue,
        pnl,
        pnlPercent,
        firstBuyTime: position.firstBuyTime,
        lastTradeTime: position.lastTradeTime,
        transactionCount: position.transactions.length,
        transactions: position.transactions.slice(-5), // Last 5 transactions
        // Additional metadata
        marketCap: metadata.marketCap,
        volume24h: metadata.volume24h,
        priceChange24h: metadata.priceChange24h,
        website: metadata.website,
        twitter: metadata.twitter
      };
    });

    // Sort by current value (largest positions first)
    detailedPositions.sort((a, b) => b.currentValue - a.currentValue);

    // Calculate totals
    const totalValue = detailedPositions.reduce((sum, pos) => sum + pos.currentValue, 0);
    const totalCost = detailedPositions.reduce((sum, pos) => sum + pos.totalCost, 0);
    const totalPnL = totalValue - totalCost;
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    console.log(`✅ Found ${detailedPositions.length} active positions with total value $${totalValue.toFixed(2)}`);

    res.status(200).json({
      success: true,
      positions: detailedPositions,
      totalPositions: detailedPositions.length,
      totalValue,
      totalCost,
      totalPnL,
      totalPnLPercent,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Positions API Error:', error);
    res.status(500).json({
      error: 'Failed to get positions',
      details: error.message
    });
  }
});

// ===== PAYMENT ENDPOINTS =====

// Get treasury wallet address
app.get('/api/payment/treasury', (req, res) => {
  try {
    const treasuryWallet = process.env.TREASURY_WALLET || 'So11111111111111111111111111111111111111112';
    console.log(`📍 Treasury wallet requested: ${treasuryWallet}`);

    res.json({
      success: true,
      treasuryWallet
    });
  } catch (error) {
    console.error('❌ Error getting treasury wallet:', error);
    res.status(500).json({ error: 'Server error getting treasury wallet' });
  }
});

// Get Solana RPC endpoint
app.get('/api/payment/rpc', (req, res) => {
  try {
    // Use your existing Helius RPC configuration
    const rpcEndpoint = process.env.HELIUS_RPC || process.env.HELIUS_API_KEY || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    console.log(`🌐 RPC endpoint requested: ${rpcEndpoint.substring(0, 50)}...`);

    res.json({
      success: true,
      rpcEndpoint
    });
  } catch (error) {
    console.error('❌ Error getting RPC endpoint:', error);
    res.status(500).json({ error: 'Server error getting RPC endpoint' });
  }
});

// ===== SWARS TOKEN ENDPOINTS =====

// Spend SWARS tokens
app.post('/api/swars/spend', async (req, res) => {
  try {
    const { walletAddress, amount, purpose } = req.body;

    if (!walletAddress || !amount || !purpose) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log(`💎 Processing SWARS spend: ${amount} SWARS for ${purpose} by ${walletAddress}`);

    // Get user
    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has enough SWARS
    if (user.swarsTokenBalance < amount) {
      return res.status(400).json({
        error: `Insufficient SWARS balance. You have ${user.swarsTokenBalance} SWARS, need ${amount} SWARS`
      });
    }

    // Deduct SWARS tokens
    const updatedUser = await prisma.user.update({
      where: { walletAddress },
      data: {
        swarsTokenBalance: {
          decrement: amount
        }
      }
    });

    // Create transaction record
    const transactionId = `swars_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`✅ SWARS spend successful: ${amount} SWARS deducted from ${walletAddress}`);

    res.json({
      success: true,
      transactionId,
      newBalance: updatedUser.swarsTokenBalance,
      amountSpent: amount,
      purpose,
      message: `Successfully spent ${amount} SWARS for ${purpose}`
    });

  } catch (error) {
    console.error('❌ Error spending SWARS tokens:', error);
    res.status(500).json({ error: 'Server error spending SWARS tokens' });
  }
});

// Initialize sample tournaments
async function initializePlatform() {
  try {
    console.log('🚀 Initializing SolWars Tournament Platform...');

    // Create sample tournaments if none exist
    const existingTournaments = await tournamentService.getActiveTournaments();

    if (existingTournaments.length === 0) {
      console.log('📋 No tournaments found, creating sample tournaments...');
      const { createSampleTournaments } = require('./initSampleTournaments');
      await createSampleTournaments();
    } else {
      console.log(`🏆 Found ${existingTournaments.length} existing tournaments`);
    }

    console.log('✅ Platform initialization complete!');
  } catch (error) {
    console.log('⚠️ Platform running in basic mode (database not fully configured)');
    console.log('   Tournaments will use mock data until database is set up properly.');
  }
}

// Start the epic server
server.listen(PORT, async () => {
  console.log(`🚀 SolWars Tournament Platform running on port ${PORT}`);
  console.log(`🌐 WebSocket server ready for real-time updates`);
  console.log(`🏆 Tournament system initialized`);
  console.log(`💎 SWARS token system ready`);
  console.log(`📊 Real-time price feeds active`);
  console.log(`\n🎯 Initializing tournaments...`);

  // Initialize platform
  await initializePlatform();

  // Start automatic price updates
  console.log(`\n🔄 Starting automatic price updates...`);
  priceService.startPriceUpdates();

  // Start tournament scheduler
  console.log(`\n⏰ Starting tournament scheduler...`);
  tournamentScheduler.start();

  console.log(`\n🎉 Ready for epic trading battles!`);
  console.log(`\n📱 Open http://localhost:${PORT} to start trading!`);
});
