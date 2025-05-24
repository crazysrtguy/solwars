const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserPrizes() {
  try {
    // Check for the demo wallet address
    const walletAddress = 'Guc2c6ADvejYCt5GnPSVojFgZ4orFm3vMK3s4M3fRHQY';

    console.log(`🔍 Checking prizes for wallet: ${walletAddress}`);

    const unclaimedPrizes = await prisma.prizeClaim.findMany({
      where: {
        walletAddress,
        claimed: false
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            endTime: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`\n🏆 Found ${unclaimedPrizes.length} unclaimed prizes:`);

    for (const prize of unclaimedPrizes) {
      console.log(`\n  Prize from: ${prize.tournament.name}`);
      console.log(`  Rank: ${prize.rank}`);
      console.log(`  SOL Prize: ${prize.solPrize.toFixed(4)} SOL`);
      console.log(`  SWARS Prize: ${prize.swarsPrize.toFixed(0)} SWARS`);
      console.log(`  Tournament ID: ${prize.tournamentId}`);
      console.log(`  Claimed: ${prize.claimed}`);
    }

    if (unclaimedPrizes.length === 0) {
      console.log('  No unclaimed prizes found.');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error checking prizes:', error);
    await prisma.$disconnect();
  }
}

checkUserPrizes();
