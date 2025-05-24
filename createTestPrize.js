// Create Test Prize for Real Transfer Testing
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestPrize() {
  try {
    console.log('🧪 Creating test prize for real transfer testing...');
    
    const walletAddress = 'Guc2c6ADvejYCt5GnPSVojFgZ4orFm3s4M3fRHQY';
    
    // Find an ended tournament
    const endedTournament = await prisma.tournament.findFirst({
      where: { status: 'ENDED' }
    });
    
    if (!endedTournament) {
      console.log('❌ No ended tournaments found');
      return;
    }
    
    console.log(`📋 Using tournament: ${endedTournament.name}`);
    
    // Check if prize claim already exists
    const existingClaim = await prisma.prizeClaim.findUnique({
      where: {
        tournamentId_walletAddress: {
          tournamentId: endedTournament.id,
          walletAddress
        }
      }
    });
    
    if (existingClaim) {
      if (existingClaim.claimed) {
        console.log('🔄 Resetting existing claimed prize for testing...');
        await prisma.prizeClaim.update({
          where: { id: existingClaim.id },
          data: {
            claimed: false,
            claimedAt: null,
            transactionHash: null
          }
        });
        console.log('✅ Prize reset for testing');
      } else {
        console.log('✅ Unclaimed prize already exists');
      }
    } else {
      // Create new test prize
      console.log('🎁 Creating new test prize...');
      await prisma.prizeClaim.create({
        data: {
          tournamentId: endedTournament.id,
          walletAddress,
          rank: 1,
          solPrize: 0.001, // Small test amount
          swarsPrize: 10,  // Small test amount
          claimed: false
        }
      });
      console.log('✅ Test prize created');
    }
    
    // Verify the prize
    const testPrize = await prisma.prizeClaim.findUnique({
      where: {
        tournamentId_walletAddress: {
          tournamentId: endedTournament.id,
          walletAddress
        }
      },
      include: {
        tournament: true
      }
    });
    
    console.log('\n🏆 Test Prize Details:');
    console.log(`   Tournament: ${testPrize.tournament.name}`);
    console.log(`   Wallet: ${testPrize.walletAddress}`);
    console.log(`   Rank: ${testPrize.rank}`);
    console.log(`   SOL Prize: ${testPrize.solPrize} SOL`);
    console.log(`   SWARS Prize: ${testPrize.swarsPrize} SWARS`);
    console.log(`   Claimed: ${testPrize.claimed}`);
    
    console.log('\n🚀 Ready to test real prize claiming!');
    console.log('   1. Connect your wallet in the UI');
    console.log('   2. Look for the "Your Prizes" section');
    console.log('   3. Click "Claim Prize" to test real SOL + SWARS transfer');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error creating test prize:', error);
    await prisma.$disconnect();
  }
}

createTestPrize();
