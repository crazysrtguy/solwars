// Tournament API endpoints for Vercel
const { getPrismaClient, disconnectPrisma } = require('./_lib/prisma');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const prisma = getPrismaClient();

  try {
    if (req.method === 'GET') {
      // Get active tournaments
      console.log('🏆 Fetching active tournaments...');

      try {
        const tournaments = await prisma.tournament.findMany({
          where: {
            status: {
              in: ['UPCOMING', 'ACTIVE']
            }
          },
          include: {
            _count: {
              select: { participants: true }
            }
          },
          orderBy: { startTime: 'asc' }
        });

        // Calculate stats for the availability indicator
        const activeTournaments = tournaments.filter(t => t.status === 'ACTIVE');
        const upcomingTournaments = tournaments.filter(t => t.status === 'UPCOMING');
        const joinableTournaments = tournaments.filter(t =>
          t.status === 'UPCOMING' ||
          (t.status === 'ACTIVE' && t._count.participants < t.maxParticipants)
        );

        const response = {
          tournaments: tournaments.map(tournament => ({
            ...tournament,
            participantCount: tournament._count.participants
          })),
          stats: {
            total: tournaments.length,
            active: activeTournaments.length,
            upcoming: upcomingTournaments.length,
            joinable: joinableTournaments.length
          }
        };

        console.log(`📊 Found ${tournaments.length} tournaments (${activeTournaments.length} active, ${upcomingTournaments.length} upcoming)`);
        res.status(200).json(response);

      } catch (dbError) {
        console.error('❌ Database error fetching tournaments:', dbError);

        // Return empty tournaments if database error
        const fallbackResponse = {
          tournaments: [],
          stats: {
            total: 0,
            active: 0,
            upcoming: 0,
            joinable: 0
          },
          message: 'No tournaments available at the moment'
        };

        res.status(200).json(fallbackResponse);
      }

    } else if (req.method === 'POST') {
      // Join tournament
      const { tournamentId, walletAddress } = req.body;

      if (!tournamentId || !walletAddress) {
        return res.status(400).json({ error: 'Tournament ID and wallet address required' });
      }

      console.log(`🎯 User ${walletAddress} joining tournament ${tournamentId}`);

      // Check if tournament exists and is joinable
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          _count: {
            select: { participants: true }
          }
        }
      });

      if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
      }

      if (tournament.status === 'COMPLETED') {
        return res.status(400).json({ error: 'Tournament has already ended' });
      }

      if (tournament._count.participants >= tournament.maxParticipants) {
        return res.status(400).json({ error: 'Tournament is full' });
      }

      // Check if user already joined
      const existingParticipant = await prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId: walletAddress // Using wallet as user ID for now
          }
        }
      });

      if (existingParticipant) {
        return res.status(400).json({ error: 'Already joined this tournament' });
      }

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { walletAddress }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            walletAddress,
            username: `Trader ${walletAddress.slice(0, 8)}`,
            swarsTokenBalance: 0,
            tournamentsPlayed: 0,
            tournamentsWon: 0
          }
        });
      }

      // Join tournament
      const participant = await prisma.tournamentParticipant.create({
        data: {
          tournamentId,
          userId: user.id,
          currentBalance: tournament.startingBalance,
          joinedAt: new Date()
        }
      });

      // Update user stats
      await prisma.user.update({
        where: { id: user.id },
        data: {
          tournamentsPlayed: {
            increment: 1
          }
        }
      });

      console.log(`✅ User ${walletAddress} joined tournament ${tournamentId}`);
      res.status(200).json({
        success: true,
        participant,
        message: 'Successfully joined tournament'
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('❌ Tournament API error:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  } finally {
    await disconnectPrisma();
  }
}
