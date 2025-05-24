// Tournament scheduling API for Vercel deployment
const { getPrismaClient, disconnectPrisma } = require('../_lib/prisma');

// Enhanced token list for tournaments
const TOURNAMENT_TOKENS = [
  // Major Solana Ecosystem
  { address: 'So11111111111111111111111111111111111111112', name: 'Wrapped SOL', symbol: 'SOL' },
  { address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', name: 'Jupiter', symbol: 'JUP' },
  { address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', name: 'Raydium', symbol: 'RAY' },
  { address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', name: 'Orca', symbol: 'ORCA' },

  // Stablecoins
  { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USD Coin', symbol: 'USDC' },
  { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', name: 'Tether USD', symbol: 'USDT' },

  // Liquid Staking
  { address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', name: 'Marinade Staked SOL', symbol: 'mSOL' },
  { address: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', name: 'Jito Staked SOL', symbol: 'JitoSOL' },

  // Popular Meme Coins
  { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', name: 'Bonk', symbol: 'BONK' },
  { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', name: 'dogwifhat', symbol: 'WIF' },
  { address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', name: 'Popcat', symbol: 'POPCAT' },
  { address: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', name: 'Peanut the Squirrel', symbol: 'PNUT' },

  // Infrastructure
  { address: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', name: 'Helium', symbol: 'HNT' },
  { address: 'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y', name: 'Shadow Token', symbol: 'SHDW' },

  // Gaming & NFT
  { address: 'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx', name: 'Star Atlas', symbol: 'ATLAS' },
  { address: 'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk', name: 'Star Atlas DAO', symbol: 'POLIS' },

  // DeFi
  { address: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt', name: 'Serum', symbol: 'SRM' },
  { address: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac', name: 'Mango', symbol: 'MNGO' },

  // Newer Trending
  { address: 'JTO4BdwjNO6MLrpE7rhHXt6qzxgBZNEJQCBrVX5VNy3', name: 'Jito', symbol: 'JTO' },
  { address: 'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6', name: 'Tensor', symbol: 'TNSR' }
];

// Ensure tournament availability
async function ensureTournamentAvailability() {
  try {
    console.log('🔍 Checking tournament availability...');

    const now = new Date();
    const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);

    // Check for available tournaments
    const availableTournaments = await prisma.tournament.findMany({
      where: {
        OR: [
          {
            status: 'UPCOMING',
            startTime: {
              gte: now,
              lte: in30Minutes
            }
          },
          {
            status: 'ACTIVE',
            endTime: {
              gt: now
            }
          }
        ]
      },
      include: {
        participants: true
      }
    });

    // Filter tournaments that aren't full
    const joinableTournaments = availableTournaments.filter(t =>
      t.participants.length < t.maxParticipants
    );

    console.log(`📊 Found ${joinableTournaments.length} joinable tournaments`);

    // If we have less than 2 joinable tournaments, create more
    if (joinableTournaments.length < 2) {
      console.log('⚠️ Low tournament availability, creating emergency tournaments...');

      // Create a flash tournament immediately
      await createFlashTournament();

      // Create a daily tournament if none exist
      const dailyTournaments = joinableTournaments.filter(t => t.type === 'DAILY');
      if (dailyTournaments.length === 0) {
        await createDailyTournament();
      }
    }

    return {
      joinableTournaments: joinableTournaments.length,
      created: joinableTournaments.length < 2 ? 'emergency' : 'none'
    };

  } catch (error) {
    console.error('❌ Error ensuring tournament availability:', error);
    throw error;
  }
}

// Create Flash Tournament
async function createFlashTournament() {
  try {
    console.log('⚡ Creating Flash Tournament...');

    const now = new Date();
    const startTime = new Date(now.getTime() + 1 * 60 * 1000); // Start in 1 minute
    const endTime = new Date(startTime.getTime() + 45 * 60 * 1000); // 45 minutes duration

    const tokens = selectRandomTokens(6); // 6 tokens for flash

    const tournament = await prisma.tournament.create({
      data: {
        name: `⚡ Flash Blitz ${getTimeString()}`,
        description: 'Quick 45-minute trading battle with trending tokens!',
        type: 'FLASH',
        entryFeeSol: 0.01,
        entryFeeSwars: 100,
        bonusJackpot: 50,
        maxParticipants: 25,
        startTime,
        endTime,
        selectedTokens: tokens,
        status: 'UPCOMING'
      }
    });

    console.log(`✅ Created Flash Tournament: ${tournament.name}`);
    return tournament;
  } catch (error) {
    console.error('❌ Error creating Flash Tournament:', error);
    throw error;
  }
}

// Create Daily Tournament
async function createDailyTournament() {
  try {
    console.log('📅 Creating Daily Tournament...');

    const now = new Date();
    const startTime = new Date(now.getTime() + 2 * 60 * 1000); // Start in 2 minutes
    const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000); // 3 hours duration

    const tokens = selectRandomTokens(8); // 8 tokens for daily

    const tournament = await prisma.tournament.create({
      data: {
        name: `📅 Daily Championship ${getDateString()}`,
        description: 'Intense 3-hour trading competition with diverse token portfolio!',
        type: 'DAILY',
        entryFeeSol: 0.05,
        entryFeeSwars: 500,
        bonusJackpot: 250,
        maxParticipants: 50,
        startTime,
        endTime,
        selectedTokens: tokens,
        status: 'UPCOMING'
      }
    });

    console.log(`✅ Created Daily Tournament: ${tournament.name}`);
    return tournament;
  } catch (error) {
    console.error('❌ Error creating Daily Tournament:', error);
    throw error;
  }
}

// Update tournament statuses
async function updateTournamentStatuses() {
  try {
    const now = new Date();

    // Start upcoming tournaments
    const tournamentsToStart = await prisma.tournament.updateMany({
      where: {
        status: 'UPCOMING',
        startTime: {
          lte: now
        }
      },
      data: {
        status: 'ACTIVE'
      }
    });

    // End active tournaments
    const tournamentsToEnd = await prisma.tournament.updateMany({
      where: {
        status: 'ACTIVE',
        endTime: {
          lte: now
        }
      },
      data: {
        status: 'ENDED'
      }
    });

    return {
      started: tournamentsToStart.count,
      ended: tournamentsToEnd.count
    };

  } catch (error) {
    console.error('❌ Error updating tournament statuses:', error);
    throw error;
  }
}

// Helper functions
function selectRandomTokens(count) {
  const shuffled = TOURNAMENT_TOKENS.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getTimeString() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function getDateString() {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const prisma = getPrismaClient();

  try {
    const { action } = req.body;

    let result;
    switch (action) {
      case 'ensure_availability':
        result = await ensureTournamentAvailability();
        break;
      case 'update_statuses':
        result = await updateTournamentStatuses();
        break;
      case 'create_flash':
        result = await createFlashTournament();
        break;
      case 'create_daily':
        result = await createDailyTournament();
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.status(200).json({
      success: true,
      action,
      result
    });

  } catch (error) {
    console.error('❌ Tournament schedule API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute tournament action',
      message: error.message
    });
  } finally {
    await disconnectPrisma();
  }
}
