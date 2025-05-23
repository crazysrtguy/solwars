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
      // Return test tournaments without database for now
      const now = new Date();
      const testTournaments = [
        {
          id: 'test-1',
          name: 'Lightning Round - Live Now!',
          description: 'Fast-paced 30-minute trading battle with trending tokens',
          type: 'FLASH',
          entryFeeSol: 0.05,
          entryFeeSwars: 500,
          bonusJackpot: 100,
          maxParticipants: 50,
          participantCount: 12,
          prizePoolSol: 0.6,
          totalJackpot: 180,
          status: 'active',
          startTime: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
          endTime: new Date(now.getTime() + 25 * 60 * 1000).toISOString(),
          createdAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
          updatedAt: now.toISOString(),
          selectedTokens: [
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
            }
          ],
          participants: [],
          jackpotPool: null
        },
        {
          id: 'test-2',
          name: 'Crypto Gladiator Arena',
          description: 'Epic 1-hour trading tournament',
          type: 'FLASH',
          entryFeeSol: 0.1,
          entryFeeSwars: 1000,
          bonusJackpot: 200,
          maxParticipants: 100,
          participantCount: 0,
          prizePoolSol: 0,
          totalJackpot: 200,
          status: 'upcoming',
          startTime: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
          endTime: new Date(now.getTime() + 65 * 60 * 1000).toISOString(),
          createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
          updatedAt: now.toISOString(),
          selectedTokens: [
            {
              address: 'So11111111111111111111111111111111111111112',
              name: 'Wrapped SOL',
              symbol: 'SOL',
              price: 180.50,
              icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
            }
          ],
          participants: [],
          jackpotPool: null
        }
      ];

      res.status(200).json(testTournaments);

    } else if (req.method === 'POST') {
      // Return test tournament creation
      res.status(201).json({
        success: true,
        message: 'Tournament creation not yet implemented',
        tournament: { id: 'test-new', name: 'Test Tournament' }
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
  }
}
