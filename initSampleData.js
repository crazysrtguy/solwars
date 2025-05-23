// Initialize sample tournament data for testing
const TournamentService = require('./services/tournamentService');
const SwarsTokenService = require('./services/swarsTokenService');

async function initSampleData() {
  console.log('🚀 Initializing sample tournament data...');
  
  try {
    const tournamentService = new TournamentService();
    const swarsService = new SwarsTokenService();
    
    // Create a sample daily tournament
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0); // Start at noon UTC
    
    const endTime = new Date(tomorrow);
    endTime.setHours(36, 0, 0, 0); // 24 hour duration
    
    console.log('📅 Creating sample daily tournament...');
    
    const sampleTournament = await tournamentService.createTournament({
      name: `Epic Galactic Championship - ${tomorrow.toDateString()}`,
      description: 'Trade real Solana tokens and compete for massive prizes! Use SWARS tokens for bonus jackpot chances.',
      type: 'DAILY',
      entryFeeSol: 0.01,
      entryFeeSwars: 100,
      maxParticipants: 1000,
      startTime: tomorrow,
      endTime: endTime,
      tokenCount: 8
    });
    
    if (sampleTournament) {
      console.log(`✅ Created sample tournament: ${sampleTournament.id}`);
    } else {
      console.log('⚠️ Tournament creation returned null (likely using mock data)');
    }
    
    // Create a flash tournament starting soon
    const flashStart = new Date();
    flashStart.setMinutes(flashStart.getMinutes() + 30); // Start in 30 minutes
    
    const flashEnd = new Date(flashStart);
    flashEnd.setHours(flashEnd.getHours() + 2); // 2 hour duration
    
    console.log('⚡ Creating sample flash tournament...');
    
    const flashTournament = await tournamentService.createTournament({
      name: `Lightning Strike Tournament`,
      description: 'Fast-paced 2-hour trading battle! Quick profits, quick glory!',
      type: 'FLASH',
      entryFeeSol: 0.005,
      entryFeeSwars: 50,
      maxParticipants: 500,
      startTime: flashStart,
      endTime: flashEnd,
      tokenCount: 5
    });
    
    if (flashTournament) {
      console.log(`✅ Created flash tournament: ${flashTournament.id}`);
    } else {
      console.log('⚠️ Flash tournament creation returned null (likely using mock data)');
    }
    
    console.log('🎉 Sample data initialization complete!');
    console.log('');
    console.log('🏆 Available tournaments:');
    console.log(`   • Daily Championship: ${tomorrow.toDateString()} at 12:00 UTC`);
    console.log(`   • Flash Tournament: Starting in 30 minutes`);
    console.log('');
    console.log('💎 SWARS Token Features:');
    console.log('   • Daily bonus: 10-50 SWARS tokens');
    console.log('   • Tournament rewards: Up to 500 SWARS for winners');
    console.log('   • Bonus jackpot: Use SWARS for entry to win extra prizes');
    console.log('');
    console.log('🚀 Ready for epic trading battles!');
    
  } catch (error) {
    console.error('❌ Error initializing sample data:', error.message);
    console.log('');
    console.log('📝 Note: This is expected if the database is not fully set up.');
    console.log('   The tournament system will work with mock data for now.');
    console.log('   To enable full functionality:');
    console.log('   1. Set up PostgreSQL database');
    console.log('   2. Configure DATABASE_URL in .env');
    console.log('   3. Run: npx prisma migrate dev');
    console.log('   4. Run: npx prisma generate');
  }
}

// Run if called directly
if (require.main === module) {
  initSampleData().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Failed to initialize sample data:', error);
    process.exit(1);
  });
}

module.exports = { initSampleData };
