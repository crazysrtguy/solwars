const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Sample trader names and wallet addresses
const sampleTraders = [
  { username: 'CryptoKing', wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' },
  { username: 'DiamondHands', wallet: 'H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN4Rqiaxgfdz' },
  { username: 'MoonShot', wallet: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { username: 'SolanaWhale', wallet: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
  { username: 'TokenMaster', wallet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { username: 'PumpKing', wallet: 'So11111111111111111111111111111111111111112' },
  { username: 'DegenTrader', wallet: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So' },
  { username: 'AlphaHunter', wallet: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { username: 'RiskTaker', wallet: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' },
  { username: 'ProfitSeeker', wallet: 'RLBxxFkseAZ4RgJH3Sqn8jXxhmGoz9jWxDNJMh8pL7a' },
  { username: 'BullRun', wallet: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt' },
  { username: 'BearSlayer', wallet: 'AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3' },
  { username: 'YieldFarmer', wallet: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT' },
  { username: 'FlashTrader', wallet: 'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y' },
  { username: 'HODLMaster', wallet: 'DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ' }
];

// Generate realistic tournament performance data
function generatePerformanceData() {
  const performances = [];
  
  // Create varied performance profiles
  const profiles = [
    { type: 'winner', winRate: 0.7, avgProfit: 2500, variance: 1000 },
    { type: 'consistent', winRate: 0.6, avgProfit: 800, variance: 400 },
    { type: 'volatile', winRate: 0.4, avgProfit: 200, variance: 3000 },
    { type: 'beginner', winRate: 0.3, avgProfit: -200, variance: 800 },
    { type: 'unlucky', winRate: 0.2, avgProfit: -800, variance: 600 }
  ];
  
  sampleTraders.forEach((trader, index) => {
    const profile = profiles[index % profiles.length];
    const tournamentsPlayed = Math.floor(Math.random() * 15) + 5; // 5-20 tournaments
    
    let totalWinnings = 0;
    let tournamentsWon = 0;
    
    for (let i = 0; i < tournamentsPlayed; i++) {
      const won = Math.random() < profile.winRate;
      const profit = profile.avgProfit + (Math.random() - 0.5) * profile.variance * 2;
      
      if (won) {
        tournamentsWon++;
        totalWinnings += Math.max(profit, 100); // Winners always get something
      }
    }
    
    performances.push({
      ...trader,
      tournamentsPlayed,
      tournamentsWon,
      totalWinnings: Math.max(totalWinnings, 0),
      winRate: tournamentsWon / tournamentsPlayed,
      avgProfit: totalWinnings / tournamentsPlayed
    });
  });
  
  return performances;
}

async function seedTopTraders() {
  try {
    console.log('🌱 Seeding top traders data...');
    
    const performances = generatePerformanceData();
    
    // Create users and their performance data
    for (const perf of performances) {
      console.log(`👤 Creating trader: ${perf.username}`);
      
      // Create or update user
      const user = await prisma.user.upsert({
        where: { walletAddress: perf.wallet },
        update: {
          username: perf.username,
          totalWinnings: perf.totalWinnings,
          tournamentsWon: perf.tournamentsWon,
          tournamentsPlayed: perf.tournamentsPlayed,
          swarsTokenBalance: Math.floor(Math.random() * 1000) + 100 // Random SWARS balance
        },
        create: {
          walletAddress: perf.wallet,
          username: perf.username,
          totalWinnings: perf.totalWinnings,
          tournamentsWon: perf.tournamentsWon,
          tournamentsPlayed: perf.tournamentsPlayed,
          swarsTokenBalance: Math.floor(Math.random() * 1000) + 100,
          leaderboard: {
            create: {
              score: perf.totalWinnings,
              highScore: perf.totalWinnings * 1.2,
              gamesPlayed: perf.tournamentsPlayed
            }
          }
        },
        include: { leaderboard: true }
      });
      
      console.log(`✅ Created trader ${perf.username} with ${perf.totalWinnings.toFixed(2)} SOL winnings`);
    }
    
    console.log('🎉 Top traders seeding completed!');
    
    // Display summary
    const topTraders = await prisma.user.findMany({
      orderBy: { totalWinnings: 'desc' },
      take: 10,
      select: {
        username: true,
        totalWinnings: true,
        tournamentsWon: true,
        tournamentsPlayed: true
      }
    });
    
    console.log('\n🏆 Top 10 Traders:');
    topTraders.forEach((trader, index) => {
      const winRate = trader.tournamentsPlayed > 0 ? 
        (trader.tournamentsWon / trader.tournamentsPlayed * 100).toFixed(1) : '0.0';
      console.log(`${index + 1}. ${trader.username} - ${trader.totalWinnings.toFixed(2)} SOL (${winRate}% win rate)`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding top traders:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedTopTraders()
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedTopTraders };
