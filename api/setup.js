const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Sample trending tokens for tournaments
const SAMPLE_TOKENS = [
  {
    address: 'So11111111111111111111111111111111111111112',
    name: 'Wrapped SOL',
    symbol: 'SOL',
    price: 180.50,
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    priceChange24h: 2.5,
    volume24h: 1500000000,
    marketCap: 85000000000
  },
  {
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    name: 'Jupiter',
    symbol: 'JUP',
    price: 0.85,
    icon: 'https://static.jup.ag/jup/icon.png',
    priceChange24h: -1.2,
    volume24h: 45000000,
    marketCap: 1200000000
  },
  {
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    name: 'Bonk',
    symbol: 'BONK',
    price: 0.000025,
    icon: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
    priceChange24h: 5.8,
    volume24h: 25000000,
    marketCap: 1800000000
  },
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    name: 'USD Coin',
    symbol: 'USDC',
    price: 1.00,
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    priceChange24h: 0.1,
    volume24h: 2000000000,
    marketCap: 32000000000
  }
];

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('🌱 Setting up tournaments for Vercel...');

    const now = new Date();
    const tournaments = [];

    // 1. Active tournament starting now
    tournaments.push({
      name: 'Lightning Round - Live Now!',
      description: 'Fast-paced 30-minute trading battle with trending tokens',
      type: 'FLASH',
      entryFeeSol: 0.05,
      entryFeeSwars: 500,
      bonusJackpot: 100,
      maxParticipants: 50,
      startTime: new Date(now.getTime() + 1 * 60 * 1000), // 1 minute from now
      endTime: new Date(now.getTime() + 31 * 60 * 1000), // 31 minutes from now
      selectedTokens: SAMPLE_TOKENS.slice(0, 4),
      tokenMetadata: SAMPLE_TOKENS.slice(0, 4).reduce((acc, token) => {
        acc[token.address] = token;
        return acc;
      }, {})
    });

    // 2. Starting in 5 minutes
    tournaments.push({
      name: 'Crypto Gladiator Arena',
      description: 'Epic 1-hour trading tournament with high-volume tokens',
      type: 'FLASH',
      entryFeeSol: 0.1,
      entryFeeSwars: 1000,
      bonusJackpot: 200,
      maxParticipants: 100,
      startTime: new Date(now.getTime() + 5 * 60 * 1000), // 5 minutes from now
      endTime: new Date(now.getTime() + 65 * 60 * 1000), // 1 hour 5 minutes from now
      selectedTokens: SAMPLE_TOKENS,
      tokenMetadata: SAMPLE_TOKENS.reduce((acc, token) => {
        acc[token.address] = token;
        return acc;
      }, {})
    });

    // Create tournaments
    const createdTournaments = [];
    for (const tournamentData of tournaments) {
      const tournament = await prisma.tournament.create({
        data: tournamentData
      });

      // Create jackpot pool
      await prisma.jackpotPool.create({
        data: {
          tournamentId: tournament.id,
          bonusMultip: 1.5 + Math.random() * 0.5 // 1.5x to 2.0x multiplier
        }
      });

      createdTournaments.push(tournament);
    }

    res.status(200).json({
      success: true,
      message: `Successfully created ${createdTournaments.length} tournaments`,
      tournaments: createdTournaments.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        startTime: t.startTime.toISOString(),
        endTime: t.endTime.toISOString()
      }))
    });

  } catch (error) {
    console.error('❌ Setup Error:', error);
    res.status(500).json({
      success: false,
      error: 'Setup failed',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
