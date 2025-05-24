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
  async start() {
    if (this.isRunning) return;

    console.log('🏆 Starting enhanced tournament scheduler...');
    this.isRunning = true;

    // Ensure we have tournaments available immediately
    await this.ensureTournamentAvailability();

    // Schedule different tournament types with overlapping availability
    this.scheduleFlashTournaments();
    this.scheduleDailyTournaments();
    this.scheduleWeeklyTournaments();
    this.scheduleSpecialEvents();

    // Monitor and maintain tournament availability
    this.scheduleAvailabilityCheck();

    // Clean up expired tournaments every hour
    this.scheduleCleanup();

    // Update tournament statuses every minute
    this.scheduleStatusUpdates();

    console.log('✅ Enhanced tournament scheduler started with continuous availability');
  }

  // Stop the scheduler
  stop() {
    console.log('🛑 Stopping tournament scheduler...');
    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs.clear();
    this.isRunning = false;
  }

  // Schedule Flash Tournaments (every 15 minutes for better availability)
  scheduleFlashTournaments() {
    const job = cron.schedule('*/15 * * * *', async () => {
      await this.createFlashTournament();
    });
    this.scheduledJobs.set('flash', job);
    console.log('⚡ Flash tournaments scheduled every 15 minutes');
  }

  // Schedule Daily Tournaments (every 2 hours for better coverage)
  scheduleDailyTournaments() {
    const job = cron.schedule('0 */2 * * *', async () => {
      await this.createDailyTournament();
    });
    this.scheduledJobs.set('daily', job);
    console.log('📅 Daily tournaments scheduled every 2 hours');
  }

  // Schedule Weekly Tournaments (twice per week)
  scheduleWeeklyTournaments() {
    // Sunday at 12:00 UTC
    const job1 = cron.schedule('0 12 * * 0', async () => {
      await this.createWeeklyTournament();
    });
    // Wednesday at 18:00 UTC
    const job2 = cron.schedule('0 18 * * 3', async () => {
      await this.createWeeklyTournament();
    });
    this.scheduledJobs.set('weekly1', job1);
    this.scheduledJobs.set('weekly2', job2);
    console.log('📆 Weekly tournaments scheduled twice per week (Sun 12:00, Wed 18:00 UTC)');
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

  // Schedule availability monitoring (every 5 minutes)
  scheduleAvailabilityCheck() {
    const job = cron.schedule('*/5 * * * *', async () => {
      await this.ensureTournamentAvailability();
    });
    this.scheduledJobs.set('availability', job);
    console.log('🔍 Tournament availability check scheduled every 5 minutes');
  }

  // Schedule status updates (every minute)
  scheduleStatusUpdates() {
    const job = cron.schedule('* * * * *', async () => {
      await this.updateTournamentStatuses();
    });
    this.scheduledJobs.set('status', job);
    console.log('🔄 Tournament status updates scheduled every minute');
  }

  // Schedule cleanup of expired tournaments
  scheduleCleanup() {
    const job = cron.schedule('0 * * * *', async () => {
      await this.cleanupExpiredTournaments();
    });
    this.scheduledJobs.set('cleanup', job);
    console.log('🧹 Tournament cleanup scheduled every hour');
  }

  // Create Flash Tournament (45 minutes, low entry fee)
  async createFlashTournament() {
    try {
      console.log('⚡ Creating Flash Tournament...');

      const now = new Date();
      const startTime = new Date(now.getTime() + 1 * 60 * 1000); // Start in 1 minute
      const endTime = new Date(startTime.getTime() + 45 * 60 * 1000); // 45 minutes duration

      const tokens = await this.selectRandomTokens(6); // 6 tokens for flash

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
          status: 'UPCOMING'
        }
      });

      console.log(`✅ Created Flash Tournament: ${tournament.name}`);
      return tournament;
    } catch (error) {
      console.error('❌ Error creating Flash Tournament:', error);
    }
  }

  // Create Daily Tournament (3 hours, medium entry fee)
  async createDailyTournament() {
    try {
      console.log('📅 Creating Daily Tournament...');

      const now = new Date();
      const startTime = new Date(now.getTime() + 2 * 60 * 1000); // Start in 2 minutes
      const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000); // 3 hours duration

      const tokens = await this.selectRandomTokens(8); // 8 tokens for daily

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
      console.log(`🎯 Selecting ${count} tokens for tournament...`);

      // Try to get tokens from tokenService first
      if (this.tokenService && typeof this.tokenService.selectTournamentTokens === 'function') {
        console.log('📊 Using TokenService.selectTournamentTokens...');
        const tokens = await this.tokenService.selectTournamentTokens(count);
        if (tokens && tokens.length > 0) {
          console.log(`✅ Got ${tokens.length} tokens from TokenService:`, tokens.map(t => t.symbol).join(', '));
          return tokens;
        }
      }

      // Fallback to getTrendingTokens
      if (this.tokenService && typeof this.tokenService.getTrendingTokens === 'function') {
        console.log('📈 Trying TokenService.getTrendingTokens...');
        const trendingTokens = await this.tokenService.getTrendingTokens(25);
        if (trendingTokens && trendingTokens.length > 0) {
          const shuffled = trendingTokens.sort(() => 0.5 - Math.random());
          const selected = shuffled.slice(0, count);
          console.log(`✅ Got ${selected.length} trending tokens:`, selected.map(t => t.symbol).join(', '));
          return selected;
        }
      }

      // Final fallback to static tokens
      console.log('⚠️ Using fallback tokens...');
      const fallbackTokens = this.getFallbackTokens();
      const selected = fallbackTokens.slice(0, count);
      console.log(`✅ Using ${selected.length} fallback tokens:`, selected.map(t => t.symbol).join(', '));
      return selected;
    } catch (error) {
      console.error('❌ Error selecting tokens:', error);
      console.log('🔄 Falling back to static tokens...');
      return this.getFallbackTokens().slice(0, count);
    }
  }

  // Ensure tournament availability - always have joinable tournaments
  async ensureTournamentAvailability() {
    try {
      console.log('🔍 Checking tournament availability...');

      const now = new Date();
      const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);

      // Check for available tournaments (upcoming or active that can be joined)
      const availableTournaments = await prisma.tournament.findMany({
        where: {
          OR: [
            {
              status: 'UPCOMING',
              startTime: {
                gte: now,
                lte: in30Minutes
              }
            },
            {
              status: 'ACTIVE',
              endTime: {
                gt: now
              }
            }
          ]
        },
        include: {
          participants: true
        }
      });

      // Filter tournaments that aren't full
      const joinableTournaments = availableTournaments.filter(t =>
        t.participants.length < t.maxParticipants
      );

      console.log(`📊 Found ${joinableTournaments.length} joinable tournaments`);

      // If we have less than 2 joinable tournaments, create more
      if (joinableTournaments.length < 2) {
        console.log('⚠️ Low tournament availability, creating emergency tournaments...');

        // Create a flash tournament immediately
        await this.createFlashTournament();

        // Create a daily tournament if none exist
        const dailyTournaments = joinableTournaments.filter(t => t.type === 'DAILY');
        if (dailyTournaments.length === 0) {
          await this.createDailyTournament();
        }
      }

      // Ensure we have upcoming tournaments for the next 2 hours
      const upcomingTournaments = await prisma.tournament.findMany({
        where: {
          status: 'UPCOMING',
          startTime: {
            gte: now,
            lte: new Date(now.getTime() + 2 * 60 * 60 * 1000)
          }
        }
      });

      if (upcomingTournaments.length < 3) {
        console.log('📅 Creating additional upcoming tournaments...');

        // Stagger tournament creation
        setTimeout(() => this.createFlashTournament(), 5 * 60 * 1000); // 5 minutes
        setTimeout(() => this.createFlashTournament(), 25 * 60 * 1000); // 25 minutes
        setTimeout(() => this.createDailyTournament(), 45 * 60 * 1000); // 45 minutes
      }

    } catch (error) {
      console.error('❌ Error ensuring tournament availability:', error);
    }
  }

  // Update tournament statuses based on current time
  async updateTournamentStatuses() {
    try {
      const now = new Date();

      // Start upcoming tournaments
      const tournamentsToStart = await prisma.tournament.findMany({
        where: {
          status: 'UPCOMING',
          startTime: {
            lte: now
          }
        }
      });

      for (const tournament of tournamentsToStart) {
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: { status: 'ACTIVE' }
        });
        console.log(`🚀 Started tournament: ${tournament.name}`);
      }

      // End active tournaments
      const tournamentsToEnd = await prisma.tournament.findMany({
        where: {
          status: 'ACTIVE',
          endTime: {
            lte: now
          }
        }
      });

      for (const tournament of tournamentsToEnd) {
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: { status: 'ENDED' }
        });
        console.log(`🏁 Ended tournament: ${tournament.name}`);
      }

    } catch (error) {
      console.error('❌ Error updating tournament statuses:', error);
    }
  }

  // Clean up expired tournaments
  async cleanupExpiredTournaments() {
    try {
      console.log('🧹 Cleaning up old tournaments...');

      // Delete tournaments that ended more than 24 hours ago
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const expiredTournaments = await prisma.tournament.findMany({
        where: {
          status: 'ENDED',
          endTime: {
            lt: cutoffTime
          }
        }
      });

      for (const tournament of expiredTournaments) {
        // Clean up related data first
        await prisma.tournamentParticipant.deleteMany({
          where: { tournamentId: tournament.id }
        });

        await prisma.tokenTransaction.deleteMany({
          where: { tournamentId: tournament.id }
        });

        await prisma.tokenPriceSnapshot.deleteMany({
          where: { tournamentId: tournament.id }
        });

        // Delete the tournament
        await prisma.tournament.delete({
          where: { id: tournament.id }
        });

        console.log(`🗑️ Deleted expired tournament: ${tournament.name}`);
      }

      if (expiredTournaments.length > 0) {
        console.log(`✅ Cleaned up ${expiredTournaments.length} expired tournaments`);
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
        price: 180.50 + (Math.random() - 0.5) * 20, // ±$10 variation
        icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
      },
      {
        address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        name: 'Jupiter',
        symbol: 'JUP',
        price: 0.85 + (Math.random() - 0.5) * 0.2, // ±$0.1 variation
        icon: 'https://static.jup.ag/jup/icon.png'
      },
      {
        address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        name: 'Raydium',
        symbol: 'RAY',
        price: 3.45 + (Math.random() - 0.5) * 0.6, // ±$0.3 variation
        icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png'
      },
      {
        address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
        name: 'Orca',
        symbol: 'ORCA',
        price: 2.85 + (Math.random() - 0.5) * 0.4, // ±$0.2 variation
        icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png'
      },
      {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        name: 'USD Coin',
        symbol: 'USDC',
        price: 1.00 + (Math.random() - 0.5) * 0.02, // ±$0.01 variation
        icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
      },
      {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        name: 'Bonk',
        symbol: 'BONK',
        price: 0.000025 + (Math.random() - 0.5) * 0.00001, // ±50% variation
        icon: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I'
      },
      {
        address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
        name: 'dogwifhat',
        symbol: 'WIF',
        price: 1.17 + (Math.random() - 0.5) * 0.3, // ±$0.15 variation
        icon: 'https://cf-ipfs.com/ipfs/QmNrAodKkdadp34Uku4VbNEaramY6P2MzMH9rkLqsXTVGT'
      },
      {
        address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
        name: 'Popcat',
        symbol: 'POPCAT',
        price: 0.65 + (Math.random() - 0.5) * 0.2, // ±$0.1 variation
        icon: 'https://cf-ipfs.com/ipfs/QmNrAodKkdadp34Uku4VbNEaramY6P2MzMH9rkLqsXTVGT'
      },
      {
        address: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump',
        name: 'Peanut the Squirrel',
        symbol: 'PNUT',
        price: 1.25 + (Math.random() - 0.5) * 0.4, // ±$0.2 variation
        icon: 'https://cf-ipfs.com/ipfs/QmNrAodKkdadp34Uku4VbNEaramY6P2MzMH9rkLqsXTVGT'
      },
      {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        name: 'Tether USD',
        symbol: 'USDT',
        price: 1.00 + (Math.random() - 0.5) * 0.02, // ±$0.01 variation
        icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg'
      }
    ];
  }
}

module.exports = TournamentScheduler;
