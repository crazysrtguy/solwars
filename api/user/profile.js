// User profile API for Vercel
const { getPrismaClient, disconnectPrisma } = require('../_lib/prisma');

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
      const { wallet } = req.query;

      if (!wallet) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      console.log(`👤 Fetching profile for wallet: ${wallet}`);

      const user = await prisma.user.findUnique({
        where: { walletAddress: wallet },
        select: {
          id: true,
          walletAddress: true,
          username: true,
          xUsername: true,
          bio: true,
          profileImage: true,
          totalWinnings: true,
          tournamentsWon: true,
          tournamentsPlayed: true,
          swarsTokenBalance: true,
          createdAt: true
        }
      });

      if (!user) {
        // Return default profile for new users
        return res.status(200).json({
          walletAddress: wallet,
          username: `Trader ${wallet.slice(0, 8)}`,
          xUsername: '',
          bio: '',
          profileImage: null,
          totalWinnings: 0,
          tournamentsWon: 0,
          tournamentsPlayed: 0,
          swarsTokenBalance: 0,
          createdAt: new Date()
        });
      }

      res.status(200).json(user);

    } else if (req.method === 'POST') {
      const { walletAddress, username, xUsername, bio, profileImage } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      console.log(`💾 Updating profile for wallet: ${walletAddress}`);

      // Upsert user profile
      const user = await prisma.user.upsert({
        where: { walletAddress },
        update: {
          username: username || undefined,
          xUsername: xUsername || undefined,
          bio: bio || undefined,
          profileImage: profileImage || undefined
        },
        create: {
          walletAddress,
          username: username || `Trader ${walletAddress.slice(0, 8)}`,
          xUsername: xUsername || '',
          bio: bio || '',
          profileImage: profileImage || null,
          swarsTokenBalance: 0,
          tournamentsPlayed: 0,
          tournamentsWon: 0
        },
        select: {
          id: true,
          walletAddress: true,
          username: true,
          xUsername: true,
          bio: true,
          profileImage: true,
          totalWinnings: true,
          tournamentsWon: true,
          tournamentsPlayed: true,
          swarsTokenBalance: true,
          createdAt: true
        }
      });

      console.log(`✅ Profile updated for ${walletAddress}`);
      res.status(200).json(user);

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('❌ User profile API error:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  } finally {
    await disconnectPrisma();
  }
}
