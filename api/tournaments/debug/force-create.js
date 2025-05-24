// Debug endpoint to force create tournaments
const { getPrismaClient, disconnectPrisma } = require('../../_lib/prisma');

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
  
  // Popular Meme Coins
  { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', name: 'Bonk', symbol: 'BONK' },
  { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', name: 'dogwifhat', symbol: 'WIF' },
  { address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', name: 'Popcat', symbol: 'POPCAT' },
  { address: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', name: 'Peanut the Squirrel', symbol: 'PNUT' }
];

// Create emergency tournaments
async function createEmergencyTournaments() {
  const prisma = getPrismaClient();
  
  try {
    console.log('🚨 Creating emergency tournaments...');
    
    const now = new Date();
    const tournaments = [];
    
    // Create Flash Tournament
    const flashStartTime = new Date(now.getTime() + 1 * 60 * 1000); // Start in 1 minute
    const flashEndTime = new Date(flashStartTime.getTime() + 45 * 60 * 1000); // 45 minutes
    
    const flashTournament = await prisma.tournament.create({
      data: {
        name: `⚡ Emergency Flash ${getTimeString()}`,
        description: 'Quick 45-minute emergency trading battle!',
        type: 'FLASH',
        entryFeeSol: 0.01,
        entryFeeSwars: 100,
        prizePoolSol: 0,
        bonusJackpot: 50,
        maxParticipants: 25,
        startTime: flashStartTime,
        endTime: flashEndTime,
        selectedTokens: selectRandomTokens(6),
        status: 'UPCOMING'
      }
    });
    
    tournaments.push(flashTournament);
    
    // Create Daily Tournament
    const dailyStartTime = new Date(now.getTime() + 2 * 60 * 1000); // Start in 2 minutes
    const dailyEndTime = new Date(dailyStartTime.getTime() + 3 * 60 * 60 * 1000); // 3 hours
    
    const dailyTournament = await prisma.tournament.create({
      data: {
        name: `📅 Emergency Daily ${getDateString()}`,
        description: 'Emergency 3-hour trading competition!',
        type: 'DAILY',
        entryFeeSol: 0.05,
        entryFeeSwars: 500,
        prizePoolSol: 0,
        bonusJackpot: 250,
        maxParticipants: 50,
        startTime: dailyStartTime,
        endTime: dailyEndTime,
        selectedTokens: selectRandomTokens(8),
        status: 'UPCOMING'
      }
    });
    
    tournaments.push(dailyTournament);
    
    console.log(`✅ Created ${tournaments.length} emergency tournaments`);
    return tournaments;
    
  } catch (error) {
    console.error('❌ Error creating emergency tournaments:', error);
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

  try {
    console.log('🚨 Force creating emergency tournaments...');
    
    const tournaments = await createEmergencyTournaments();
    
    res.status(200).json({
      success: true,
      message: 'Emergency tournaments created successfully',
      tournaments: tournaments.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        startTime: t.startTime,
        endTime: t.endTime,
        maxParticipants: t.maxParticipants,
        status: t.status
      }))
    });

  } catch (error) {
    console.error('❌ Force create tournaments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create emergency tournaments',
      message: error.message
    });
  } finally {
    await disconnectPrisma();
  }
};
