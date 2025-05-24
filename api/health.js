const { testConnection } = require('./_lib/prisma');

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
    console.log('🏥 Running health check...');

    // Check environment variables
    const envCheck = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      HELIUS_RPC: !!process.env.HELIUS_RPC,
      TREASURY_WALLET: !!process.env.TREASURY_WALLET,
      SWARS_TOKEN_MINT: !!process.env.SWARS_TOKEN_MINT
    };

    // Test database connection
    const dbConnected = await testConnection();

    const healthStatus = {
      success: true,
      message: 'SolWars Tournament Platform is running!',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      features: {
        tournaments: true,
        realTimePrices: true,
        walletAuth: true,
        trading: true,
        database: dbConnected
      },
      envVars: envCheck,
      runtime: {
        node: process.version,
        platform: process.platform,
        memory: process.memoryUsage()
      }
    };

    console.log('✅ Health check completed successfully');
    res.status(200).json(healthStatus);

  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
