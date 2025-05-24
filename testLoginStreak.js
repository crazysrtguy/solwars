// Test Progressive Login Streak System
require('dotenv').config();
const SwarsTokenService = require('./services/swarsTokenService');

async function testLoginStreak() {
  console.log('🧪 Testing Progressive Login Streak System');
  console.log('==========================================\n');

  const swarsService = new SwarsTokenService();
  const testWallet = 'AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR'; // Your treasury wallet for testing

  try {
    // First, create a test user if it doesn't exist
    console.log('👤 Setting up test user...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.user.upsert({
      where: { walletAddress: testWallet },
      update: {},
      create: {
        walletAddress: testWallet,
        username: 'Test User',
        swarsTokenBalance: 0,
        tournamentsPlayed: 2,
        tournamentsWon: 1
      }
    });
    console.log('✅ Test user ready\n');
    console.log('📊 Initial streak info:');
    let streakInfo = await swarsService.getLoginStreakInfo(testWallet);
    console.log(JSON.stringify(streakInfo, null, 2));

    console.log('\n🎯 Testing daily bonus claims...\n');

    // Test claiming bonus for multiple days
    for (let day = 1; day <= 7; day++) {
      try {
        console.log(`--- Day ${day} ---`);
        const result = await swarsService.claimDailyBonus(testWallet);

        if (typeof result === 'object') {
          console.log(`✅ Claimed ${result.amount} SWARS`);
          console.log(`🔥 Current streak: ${result.currentStreak} days`);
          console.log(`🏆 Longest streak: ${result.longestStreak} days`);
          console.log(`📅 Next day bonus: ${result.nextDayBonus} SWARS`);
        } else {
          console.log(`✅ Claimed ${result} SWARS (legacy format)`);
        }

        // Wait a moment between claims
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.log(`❌ Day ${day} error: ${error.message}`);

        // If already claimed today, that's expected for testing
        if (error.message.includes('already claimed')) {
          console.log('   (This is expected if testing multiple times in one day)');
        }
      }
    }

    console.log('\n📈 Final streak info:');
    streakInfo = await swarsService.getLoginStreakInfo(testWallet);
    console.log(JSON.stringify(streakInfo, null, 2));

    console.log('\n🎯 Progressive Bonus Structure:');
    console.log('===============================');
    console.log('Day 1: 5 SWARS');
    console.log('Day 2: 10 SWARS');
    console.log('Day 3: 15 SWARS');
    console.log('Day 4: 20 SWARS');
    console.log('Day 5: 25 SWARS');
    console.log('Day 6: 30 SWARS');
    console.log('Day 7: 35 SWARS + 20 bonus = 55 SWARS (Week completion!)');
    console.log('Day 8: 6 SWARS (Cycle restarts with 20% week bonus)');
    console.log('...');
    console.log('Day 30: 150+ SWARS (Month completion bonus!)');

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testLoginStreak();
