const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class TournamentScheduler {
  constructor(tokenService) {
    this.tokenService = tokenService;
    this.isRunning = false;
    this.scheduledJobs = new Map();
  }

  // Start the tournament scheduler
  start() {
    if (this.isRunning) return;
    
    console.log('🏆 Starting tournament scheduler...');
    this.isRunning = true;

    // Schedule different tournament types
    this.scheduleFlashTournaments();
    this.scheduleDailyTournaments();
    this.scheduleWeeklyTournaments();
    this.scheduleSpecialEvents();

    // Clean up expired tournaments every hour
    this.scheduleCleanup();

    console.log('✅ Tournament scheduler started with multiple tournament types');
  }

  // Stop the scheduler
  stop() {
    console.log('🛑 Stopping tournament scheduler...');
    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs.clear();
    this.isRunning = false;
  }

  // Schedule Flash Tournaments (every 30 minutes)
  scheduleFlashTournaments() {
    const job = cron.schedule('*/30 * * * *', async () => {
      await this.createFlashTournament();
    });
    this.scheduledJobs.set('flash', job);
    console.log('⚡ Flash tournaments scheduled every 30 minutes');
  }

  // Schedule Daily Tournaments (every 4 hours)
  scheduleDailyTournaments() {
    const job = cron.schedule('0 */4 * * *', async () => {
      await this.createDailyTournament();
    });
    this.scheduledJobs.set('daily', job);
    console.log('📅 Daily tournaments scheduled every 4 hours');
  }

  // Schedule Weekly Tournaments (every Sunday at 12:00)
  scheduleWeeklyTournaments() {
    const job = cron.schedule('0 12 * * 0', async () => {
      await this.createWeeklyTournament();
    });
    this.scheduledJobs.set('weekly', job);
    console.log('📆 Weekly tournaments scheduled every Sunday at 12:00');
  }

  // Schedule Special Events (random times)
  scheduleSpecialEvents() {
    const job = cron.schedule('0 */6 * * *', async () => {
      // 30% chance to create a special event
      if (Math.random() < 0.3) {
        await this.createSpecialEvent();
      }
    });
    this.scheduledJobs.set('special', job);
    console.log('🎉 Special events scheduled randomly every 6 hours');
  }

  // Schedule cleanup of expired tournaments
  scheduleCleanup() {
    const job = cron.schedule('0 * * * *', async () => {
      await this.cleanupExpiredTournaments();
    });
    this.scheduledJobs.set('cleanup', job);
    console.log('🧹 Tournament cleanup scheduled every hour');
  }

  // Create Flash Tournament (30 minutes, low entry fee)
  async createFlashTournament() {
    try {
      console.log('⚡ Creating Flash Tournament...');
      
      const now = new Date();
      const startTime = new Date(now.getTime() + 2 * 60 * 1000); // Start in 2 minutes
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes duration

      const tokens = await this.selectRandomTokens(4); // 4 tokens for flash
      
      const tournament = await prisma.tournament.create({
        data: {
          name: `⚡ Flash Blitz ${this.getTimeString()}`,
          description: 'Quick 30-minute trading battle with trending tokens!',
          type: 'FLASH',
          entryFeeSol: 0.01,
          entryFeeSwars: 100,
          bonusJackpot: 50,
          maxParticipants: 25,
          startTime,
          endTime,
          selectedTokens: tokens,
          tokenAddresses: tokens.map(t => t.address),
          status: 'UPCOMING'
        }
      });

      console.log(`✅ Created Flash Tournament: ${tournament.name}`);
      return tournament;
    } catch (error) {
      console.error('❌ Error creating Flash Tournament:', error);
    }
  }

  // Create Daily Tournament (4 hours, medium entry fee)
  async createDailyTournament() {
    try {
      console.log('📅 Creating Daily Tournament...');
      
      const now = new Date();
      const startTime = new Date(now.getTime() + 5 * 60 * 1000); // Start in 5 minutes
      const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours duration

      const tokens = await this.selectRandomTokens(6); // 6 tokens for daily
      
      const tournament = await prisma.tournament.create({
        data: {
          name: `📅 Daily Championship ${this.getDateString()}`,
          description: 'Intense 4-hour trading competition with diverse token portfolio!',
          type: 'DAILY',
          entryFeeSol: 0.05,
          entryFeeSwars: 500,
          bonusJackpot: 250,
          maxParticipants: 50,
          startTime,
          endTime,
          selectedTokens: tokens,
          tokenAddresses: tokens.map(t => t.address),
          status: 'UPCOMING'
        }
      });

      console.log(`✅ Created Daily Tournament: ${tournament.name}`);
      return tournament;
    } catch (error) {
      console.error('❌ Error creating Daily Tournament:', error);
    }
  }

  // Create Weekly Tournament (24 hours, high entry fee)
  async createWeeklyTournament() {
    try {
      console.log('📆 Creating Weekly Tournament...');
      
      const now = new Date();
      const startTime = new Date(now.getTime() + 10 * 60 * 1000); // Start in 10 minutes
      const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours duration

      const tokens = await this.selectRandomTokens(10); // 10 tokens for weekly
      
      const tournament = await prisma.tournament.create({
        data: {
          name: `📆 Weekly Masters ${this.getWeekString()}`,
          description: 'Epic 24-hour trading marathon with premium token selection!',
          type: 'WEEKLY',
          entryFeeSol: 0.1,
          entryFeeSwars: 1000,
          bonusJackpot: 500,
          maxParticipants: 100,
          startTime,
          endTime,
          selectedTokens: tokens,
          tokenAddresses: tokens.map(t => t.address),
          status: 'UPCOMING'
        }
      });

      console.log(`✅ Created Weekly Tournament: ${tournament.name}`);
      return tournament;
    } catch (error) {
      console.error('❌ Error creating Weekly Tournament:', error);
    }
  }

  // Create Special Event Tournament
  async createSpecialEvent() {
    try {
      console.log('🎉 Creating Special Event Tournament...');
      
      const events = [
        {
          name: '🚀 Moonshot Madness',
          description: 'High-risk, high-reward trading with volatile tokens!',
          duration: 2 * 60 * 60 * 1000, // 2 hours
          entryFeeSol: 0.02,
          tokenCount: 5,
          maxParticipants: 30
        },
        {
          name: '💎 Diamond Hands Challenge',
          description: 'Long-term strategy tournament with established tokens!',
          duration: 6 * 60 * 60 * 1000, // 6 hours
          entryFeeSol: 0.08,
          tokenCount: 8,
          maxParticipants: 75
        },
        {
          name: '⚡ Speed Trader Showdown',
          description: 'Ultra-fast 15-minute trading sprint!',
          duration: 15 * 60 * 1000, // 15 minutes
          entryFeeSol: 0.005,
          tokenCount: 3,
          maxParticipants: 20
        }
      ];

      const event = events[Math.floor(Math.random() * events.length)];
      const now = new Date();
      const startTime = new Date(now.getTime() + 3 * 60 * 1000); // Start in 3 minutes
      const endTime = new Date(startTime.getTime() + event.duration);

      const tokens = await this.selectRandomTokens(event.tokenCount);
      
      const tournament = await prisma.tournament.create({
        data: {
          name: `${event.name} ${this.getTimeString()}`,
          description: event.description,
          type: 'SPECIAL',
          entryFeeSol: event.entryFeeSol,
          entryFeeSwars: event.entryFeeSol * 1000, // 1000 SWARS per 0.001 SOL
          bonusJackpot: event.entryFeeSol * 500, // 500x entry fee
          maxParticipants: event.maxParticipants,
          startTime,
          endTime,
          selectedTokens: tokens,
          tokenAddresses: tokens.map(t => t.address),
          status: 'UPCOMING'
        }
      });

      console.log(`✅ Created Special Event: ${tournament.name}`);
      return tournament;
    } catch (error) {
      console.error('❌ Error creating Special Event:', error);
    }
  }

  // Select random tokens for tournament
  async selectRandomTokens(count) {
    try {
      // Get trending tokens
      const trendingTokens = await this.tokenService.getTrendingTokens(25);
      
      if (trendingTokens.length === 0) {
        return this.getFallbackTokens().slice(0, count);
      }

      // Shuffle and select random tokens
      const shuffled = trendingTokens.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    } catch (error) {
      console.error('❌ Error selecting tokens:', error);
      return this.getFallbackTokens().slice(0, count);
    }
  }

  // Clean up expired tournaments
  async cleanupExpiredTournaments() {
    try {
      const now = new Date();
      const expiredTournaments = await prisma.tournament.findMany({
        where: {
          endTime: { lt: now },
          status: { in: ['ACTIVE', 'UPCOMING'] }
        }
      });

      for (const tournament of expiredTournaments) {
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: { status: 'COMPLETED' }
        });
      }

      if (expiredTournaments.length > 0) {
        console.log(`🧹 Cleaned up ${expiredTournaments.length} expired tournaments`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up tournaments:', error);
    }
  }

  // Helper methods for naming
  getTimeString() {
    return new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }

  getDateString() {
    return new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }

  getWeekString() {
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    return weekStart.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }

  // Fallback tokens if API fails
  getFallbackTokens() {
    return [
      {
        address: 'So11111111111111111111111111111111111111112',
        name: 'Wrapped SOL',
        symbol: 'SOL',
        price: 180.50,
        icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
      },
      {
        address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        name: 'Jupiter',
        symbol: 'JUP',
        price: 0.85,
        icon: 'https://static.jup.ag/jup/icon.png'
      },
      {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        name: 'Bonk',
        symbol: 'BONK',
        price: 0.000025,
        icon: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I'
      }
    ];
  }
}

module.exports = TournamentScheduler;
