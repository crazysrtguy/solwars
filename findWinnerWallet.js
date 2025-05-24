const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findWinnerWallet() {
  try {
    console.log('🔍 Finding wallet addresses in tournaments...');
    
    // Check all prize claims
    const allPrizeClaims = await prisma.prizeClaim.findMany({
      include: {
        tournament: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log(`\n🏆 Found ${allPrizeClaims.length} total prize claims:`);
    
    for (const prize of allPrizeClaims) {
      console.log(`\n  Tournament: ${prize.tournament.name}`);
      console.log(`  Wallet: ${prize.walletAddress}`);
      console.log(`  Rank: ${prize.rank}`);
      console.log(`  SOL Prize: ${prize.solPrize.toFixed(4)} SOL`);
      console.log(`  SWARS Prize: ${prize.swarsPrize.toFixed(0)} SWARS`);
      console.log(`  Claimed: ${prize.claimed}`);
    }
    
    // Also check participants
    const participants = await prisma.tournamentParticipant.findMany({
      where: {
        tournament: {
          status: 'ENDED'
        }
      },
      include: {
        tournament: {
          select: {
            name: true,
            status: true
          }
        }
      }
    });
    
    console.log(`\n👥 Found ${participants.length} participants in ended tournaments:`);
    
    for (const participant of participants) {
      console.log(`\n  Tournament: ${participant.tournament.name}`);
      console.log(`  Wallet: ${participant.walletAddress}`);
      console.log(`  Final Rank: ${participant.finalRank || 'Not set'}`);
      console.log(`  Prize Won: ${participant.prizeWon.toFixed(4)} SOL`);
      console.log(`  Bonus Won: ${participant.bonusWon.toFixed(0)} SWARS`);
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error finding wallet:', error);
    await prisma.$disconnect();
  }
}

findWinnerWallet();
