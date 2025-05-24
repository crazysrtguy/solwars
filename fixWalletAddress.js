// Fix Wallet Address in Prize Claims
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixWalletAddress() {
  try {
    console.log('🔧 Fixing wallet address in prize claims...');
    
    const correctAddress = 'Guc2c6ADvejYCt5GnPSVojFgZ4orFm3vMK3s4M3fRHQY';
    const incorrectAddress = 'Guc2c6ADvejYCt5GnPSVojFgZ4orFm3s4M3fRHQY';
    
    console.log(`✅ Correct address: ${correctAddress} (${correctAddress.length} chars)`);
    console.log(`❌ Incorrect address: ${incorrectAddress} (${incorrectAddress.length} chars)`);
    
    // Find prize claims with incorrect address
    const incorrectClaims = await prisma.prizeClaim.findMany({
      where: {
        walletAddress: incorrectAddress
      }
    });
    
    console.log(`\n🔍 Found ${incorrectClaims.length} prize claims with incorrect address`);
    
    for (const claim of incorrectClaims) {
      console.log(`\n🔄 Updating prize claim ID: ${claim.id}`);
      console.log(`   Tournament: ${claim.tournamentId}`);
      console.log(`   SOL Prize: ${claim.solPrize}`);
      console.log(`   SWARS Prize: ${claim.swarsPrize}`);
      
      await prisma.prizeClaim.update({
        where: { id: claim.id },
        data: {
          walletAddress: correctAddress
        }
      });
      
      console.log(`   ✅ Updated wallet address`);
    }
    
    // Also check and fix tournament participants
    const incorrectParticipants = await prisma.tournamentParticipant.findMany({
      where: {
        walletAddress: incorrectAddress
      }
    });
    
    console.log(`\n🔍 Found ${incorrectParticipants.length} participants with incorrect address`);
    
    for (const participant of incorrectParticipants) {
      console.log(`\n🔄 Updating participant in tournament: ${participant.tournamentId}`);
      
      await prisma.tournamentParticipant.updateMany({
        where: {
          walletAddress: incorrectAddress,
          tournamentId: participant.tournamentId
        },
        data: {
          walletAddress: correctAddress
        }
      });
      
      console.log(`   ✅ Updated participant wallet address`);
    }
    
    console.log('\n✅ Wallet address fix complete!');
    console.log('Now testing with correct address...');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error fixing wallet address:', error);
    await prisma.$disconnect();
  }
}

fixWalletAddress();
