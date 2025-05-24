// Check Wallet Address Format
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PublicKey } = require('@solana/web3.js');

const prisma = new PrismaClient();

async function checkWalletAddress() {
  try {
    console.log('🔍 Checking wallet addresses in database...');
    
    // Get all unique wallet addresses
    const participants = await prisma.tournamentParticipant.findMany({
      select: {
        walletAddress: true
      },
      distinct: ['walletAddress']
    });
    
    console.log(`\n📊 Found ${participants.length} unique wallet addresses:`);
    
    for (const participant of participants) {
      const address = participant.walletAddress;
      console.log(`\n🔍 Checking: ${address}`);
      console.log(`   Length: ${address.length} characters`);
      
      try {
        const pubkey = new PublicKey(address);
        console.log(`   ✅ Valid Solana address: ${pubkey.toString()}`);
      } catch (error) {
        console.log(`   ❌ Invalid Solana address: ${error.message}`);
      }
    }
    
    // Check prize claims
    const prizeClaims = await prisma.prizeClaim.findMany({
      select: {
        walletAddress: true
      },
      distinct: ['walletAddress']
    });
    
    console.log(`\n🏆 Prize claim wallet addresses:`);
    for (const claim of prizeClaims) {
      const address = claim.walletAddress;
      console.log(`\n🎯 Prize wallet: ${address}`);
      console.log(`   Length: ${address.length} characters`);
      
      try {
        const pubkey = new PublicKey(address);
        console.log(`   ✅ Valid Solana address: ${pubkey.toString()}`);
      } catch (error) {
        console.log(`   ❌ Invalid Solana address: ${error.message}`);
      }
    }
    
    // Check treasury address
    console.log(`\n🏦 Treasury wallet from env:`);
    const treasuryAddress = process.env.TREASURY_WALLET;
    if (treasuryAddress) {
      console.log(`   Address: ${treasuryAddress}`);
      console.log(`   Length: ${treasuryAddress.length} characters`);
      
      try {
        const pubkey = new PublicKey(treasuryAddress);
        console.log(`   ✅ Valid treasury address: ${pubkey.toString()}`);
      } catch (error) {
        console.log(`   ❌ Invalid treasury address: ${error.message}`);
      }
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error checking wallet addresses:', error);
    await prisma.$disconnect();
  }
}

checkWalletAddress();
