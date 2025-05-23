const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

export default async function handler(req, res) {
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
      // Get all tournaments
      const tournaments = await prisma.tournament.findMany({
        include: {
          participants: {
            select: {
              id: true,
              userId: true,
              currentBalance: true,
              startingBalance: true,
              joinedAt: true
            }
          },
          jackpotPool: true
        },
        orderBy: {
          startTime: 'asc'
        }
      });

      // Calculate derived fields
      const enrichedTournaments = tournaments.map(tournament => {
        const participantCount = tournament.participants.length;
        const prizePoolSol = tournament.entryFeeSol * participantCount;
        const totalJackpot = tournament.bonusJackpot + (tournament.jackpotPool?.currentPool || 0);

        // Determine status
        const now = new Date();
        let status = 'upcoming';
        if (now >= tournament.startTime && now <= tournament.endTime) {
          status = 'active';
        } else if (now > tournament.endTime) {
          status = 'ended';
        }

        return {
          ...tournament,
          participantCount,
          prizePoolSol,
          totalJackpot,
          status,
          // Convert dates to ISO strings for JSON serialization
          startTime: tournament.startTime.toISOString(),
          endTime: tournament.endTime.toISOString(),
          createdAt: tournament.createdAt.toISOString(),
          updatedAt: tournament.updatedAt.toISOString(),
          participants: tournament.participants.map(p => ({
            ...p,
            joinedAt: p.joinedAt.toISOString()
          }))
        };
      });

      res.status(200).json({
        success: true,
        tournaments: enrichedTournaments
      });

    } else if (req.method === 'POST') {
      // Create new tournament
      const {
        name,
        description,
        type,
        entryFeeSol,
        entryFeeSwars,
        bonusJackpot,
        maxParticipants,
        startTime,
        endTime,
        selectedTokens,
        tokenMetadata
      } = req.body;

      const tournament = await prisma.tournament.create({
        data: {
          name,
          description,
          type,
          entryFeeSol: parseFloat(entryFeeSol),
          entryFeeSwars: parseInt(entryFeeSwars),
          bonusJackpot: parseInt(bonusJackpot),
          maxParticipants: parseInt(maxParticipants),
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          selectedTokens: selectedTokens || [],
          tokenMetadata: tokenMetadata || {}
        }
      });

      // Create jackpot pool
      await prisma.jackpotPool.create({
        data: {
          tournamentId: tournament.id,
          bonusMultip: 1.5 + Math.random() * 0.5 // 1.5x to 2.0x multiplier
        }
      });

      res.status(201).json({
        success: true,
        tournament: {
          ...tournament,
          startTime: tournament.startTime.toISOString(),
          endTime: tournament.endTime.toISOString(),
          createdAt: tournament.createdAt.toISOString(),
          updatedAt: tournament.updatedAt.toISOString()
        }
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
