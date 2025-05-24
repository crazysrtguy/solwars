// Tournament API using real database tournaments
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      console.log('🏆 Fetching real tournaments from database...');

      // Get real tournaments from database
      const tournaments = await prisma.tournament.findMany({
        where: {
          status: {
            in: ['UPCOMING', 'ACTIVE']
          }
        },
        include: {
          participants: true,
          _count: {
            select: {
              participants: true
            }
          }
        },
        orderBy: {
          startTime: 'asc'
        }
      });

      // Format tournaments for frontend
      const formattedTournaments = tournaments.map(tournament => {
        const now = new Date();
        const participantCount = tournament._count.participants;

        return {
          ...tournament,
          participantCount,
          spotsLeft: tournament.maxParticipants - participantCount,
          timeUntilStart: Math.max(0, tournament.startTime.getTime() - now.getTime()),
          timeUntilEnd: Math.max(0, tournament.endTime.getTime() - now.getTime()),
          isJoinable: tournament.status === 'UPCOMING' ||
                     (tournament.status === 'ACTIVE' && participantCount < tournament.maxParticipants),
          canJoin: participantCount < tournament.maxParticipants,
          prizePoolSol: participantCount * tournament.entryFeeSol,
          totalJackpot: tournament.bonusJackpot + (participantCount * tournament.entryFeeSwars * 0.1),
          // Ensure selectedTokens is properly formatted
          selectedTokens: Array.isArray(tournament.selectedTokens) ? tournament.selectedTokens : [],
          participants: [] // Don't expose participant details in list view
        };
      });

      // Categorize tournaments
      const activeTournaments = formattedTournaments.filter(t => t.status === 'ACTIVE');
      const upcomingTournaments = formattedTournaments.filter(t => t.status === 'UPCOMING');
      const joinableTournaments = formattedTournaments.filter(t => t.isJoinable);

      console.log(`📊 Found ${formattedTournaments.length} tournaments (${activeTournaments.length} active, ${upcomingTournaments.length} upcoming, ${joinableTournaments.length} joinable)`);

      // Return tournament data in enhanced format
      const response = {
        tournaments: formattedTournaments,
        categories: {
          active: activeTournaments,
          upcoming: upcomingTournaments,
          joinable: joinableTournaments
        },
        stats: {
          total: formattedTournaments.length,
          active: activeTournaments.length,
          upcoming: upcomingTournaments.length,
          joinable: joinableTournaments.length
        },
        message: `Real tournaments from database (${formattedTournaments.length} found)`
      };

      console.log(`📈 API Response Stats:`, response.stats);
      res.status(200).json(response);

    } else if (req.method === 'POST') {
      res.status(201).json({
        success: true,
        message: 'Tournament creation handled by main server',
        tournament: { id: 'redirect', name: 'Use main server endpoints' }
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('❌ Tournament API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      tournaments: [], // Return empty array as fallback
      categories: { active: [], upcoming: [], joinable: [] },
      stats: { total: 0, active: 0, upcoming: 0, joinable: 0 }
    });
  }
}
