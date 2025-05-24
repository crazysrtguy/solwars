// SWARS token balance API for Vercel
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { wallet } = req.query;

    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    console.log(`💰 Fetching SWARS balance for wallet: ${wallet}`);

    const user = await prisma.user.findUnique({
      where: { walletAddress: wallet },
      select: {
        swarsTokenBalance: true
      }
    });

    const balance = user ? user.swarsTokenBalance : 0;

    console.log(`💰 SWARS balance for ${wallet}: ${balance}`);
    res.status(200).json({ 
      walletAddress: wallet,
      balance 
    });

  } catch (error) {
    console.error('❌ SWARS balance API error:', error);
    res.status(500).json({
      error: 'Server error fetching balance',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
