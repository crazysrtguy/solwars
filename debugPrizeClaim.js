// Debug Prize Claim Lookup
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugPrizeClaim() {
  try {
    console.log('🔍 Debugging prize claim lookup...');
    
    const walletAddress = 'Guc2c6ADvejYCt5GnPSVojFgZ4orFm3vMK3s4M3fRHQY';
    const tournamentId = '5977beb0-40ce-4e1b-b641-ae2b920f6b3b';
    
    console.log(`\n🎯 Looking for:`);
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   Tournament: ${tournamentId}`);
    
    // Check all prize claims
    const allClaims = await prisma.prizeClaim.findMany({
      include: {
        tournament: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log(`\n📊 All prize claims in database (${allClaims.length}):`);
    for (const claim of allClaims) {
      console.log(`\n   ID: ${claim.id}`);
      console.log(`   Tournament ID: ${claim.tournamentId}`);
      console.log(`   Tournament Name: ${claim.tournament.name}`);
      console.log(`   Wallet: ${claim.walletAddress}`);
      console.log(`   SOL Prize: ${claim.solPrize}`);
      console.log(`   SWARS Prize: ${claim.swarsPrize}`);
      console.log(`   Claimed: ${claim.claimed}`);
      
      // Check if this matches our search
      const walletMatch = claim.walletAddress === walletAddress;
      const tournamentMatch = claim.tournamentId === tournamentId;
      console.log(`   Wallet Match: ${walletMatch}`);
      console.log(`   Tournament Match: ${tournamentMatch}`);
      console.log(`   Overall Match: ${walletMatch && tournamentMatch}`);
    }
    
    // Try the exact lookup that the server uses
    console.log(`\n🔍 Testing exact server lookup...`);
    const prizeClaim = await prisma.prizeClaim.findUnique({
      where: {
        tournamentId_walletAddress: {
          tournamentId,
          walletAddress
        }
      },
      include: {
        tournament: true
      }
    });
    
    if (prizeClaim) {
      console.log(`✅ Found prize claim:`);
      console.log(`   ID: ${prizeClaim.id}`);
      console.log(`   Tournament: ${prizeClaim.tournament.name}`);
      console.log(`   SOL Prize: ${prizeClaim.solPrize}`);
      console.log(`   SWARS Prize: ${prizeClaim.swarsPrize}`);
      console.log(`   Claimed: ${prizeClaim.claimed}`);
    } else {
      console.log(`❌ Prize claim not found with unique constraint`);
    }
    
    // Try alternative lookup
    console.log(`\n🔍 Testing alternative lookup...`);
    const altClaim = await prisma.prizeClaim.findFirst({
      where: {
        tournamentId,
        walletAddress,
        claimed: false
      },
      include: {
        tournament: true
      }
    });
    
    if (altClaim) {
      console.log(`✅ Found with alternative lookup:`);
      console.log(`   ID: ${altClaim.id}`);
      console.log(`   Tournament: ${altClaim.tournament.name}`);
    } else {
      console.log(`❌ Not found with alternative lookup either`);
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error debugging prize claim:', error);
    await prisma.$disconnect();
  }
}

debugPrizeClaim();
