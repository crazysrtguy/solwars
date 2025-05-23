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
  },
  {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    name: 'Tether USD',
    symbol: 'USDT',
    price: 1.00,
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
    priceChange24h: -0.05,
    volume24h: 1800000000,
    marketCap: 95000000000
  },
  {
    address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    name: 'Marinade Staked SOL',
    symbol: 'mSOL',
    price: 195.20,
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png',
    priceChange24h: 3.2,
    volume24h: 15000000,
    marketCap: 1500000000
  },
  {
    address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    name: 'Ethereum (Wormhole)',
    symbol: 'ETH',
    price: 3200.00,
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png',
    priceChange24h: 1.8,
    volume24h: 800000000,
    marketCap: 385000000000
  },
  {
    address: 'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM',
    name: 'USDCoin (Wormhole)',
    symbol: 'USDCet',
    price: 1.00,
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM/logo.png',
    priceChange24h: 0.02,
    volume24h: 120000000,
    marketCap: 28000000000
  }
];

async function createSeedTournaments() {
  try {
    console.log('🌱 Seeding tournaments...');

    // Clear existing tournaments
    await prisma.tournamentParticipant.deleteMany({});
    await prisma.tokenTransaction.deleteMany({});
    await prisma.jackpotPool.deleteMany({});
    await prisma.tournament.deleteMany({});

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
      selectedTokens: SAMPLE_TOKENS.slice(0, 6),
      tokenMetadata: SAMPLE_TOKENS.slice(0, 6).reduce((acc, token) => {
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
      selectedTokens: SAMPLE_TOKENS.slice(0, 8),
      tokenMetadata: SAMPLE_TOKENS.slice(0, 8).reduce((acc, token) => {
        acc[token.address] = token;
        return acc;
      }, {})
    });

    // 3. Starting in 15 minutes
    tournaments.push({
      name: 'Solana Speed Traders',
      description: '45-minute intense trading session with DeFi tokens',
      type: 'FLASH',
      entryFeeSol: 0.075,
      entryFeeSwars: 750,
      bonusJackpot: 150,
      maxParticipants: 75,
      startTime: new Date(now.getTime() + 15 * 60 * 1000), // 15 minutes from now
      endTime: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
      selectedTokens: SAMPLE_TOKENS.slice(1, 7),
      tokenMetadata: SAMPLE_TOKENS.slice(1, 7).reduce((acc, token) => {
        acc[token.address] = token;
        return acc;
      }, {})
    });

    // 4. Starting in 30 minutes
    tournaments.push({
      name: 'Daily Profit Hunt',
      description: '2-hour daily tournament with maximum rewards',
      type: 'DAILY',
      entryFeeSol: 0.2,
      entryFeeSwars: 2000,
      bonusJackpot: 400,
      maxParticipants: 200,
      startTime: new Date(now.getTime() + 30 * 60 * 1000), // 30 minutes from now
      endTime: new Date(now.getTime() + 150 * 60 * 1000), // 2.5 hours from now
      selectedTokens: SAMPLE_TOKENS,
      tokenMetadata: SAMPLE_TOKENS.reduce((acc, token) => {
        acc[token.address] = token;
        return acc;
      }, {})
    });

    // Create tournaments
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

      console.log(`✅ Created tournament: ${tournament.name}`);
    }

    console.log(`🎉 Successfully seeded ${tournaments.length} tournaments!`);
    console.log('🏆 Tournaments are ready for trading battles!');

  } catch (error) {
    console.error('❌ Error seeding tournaments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed script
if (require.main === module) {
  createSeedTournaments();
}

module.exports = { createSeedTournaments };
