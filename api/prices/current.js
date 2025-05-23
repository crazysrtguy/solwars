// Mock price data for Vercel deployment
// In production, this would connect to real price feeds

const MOCK_PRICES = {
  'So11111111111111111111111111111111111111112': {
    price: 180.50 + (Math.random() - 0.5) * 10,
    priceChange24h: (Math.random() - 0.5) * 10,
    volume24h: 1500000000,
    liquidity: 85000000000,
    lastUpdated: Date.now()
  },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {
    price: 0.85 + (Math.random() - 0.5) * 0.1,
    priceChange24h: (Math.random() - 0.5) * 5,
    volume24h: 45000000,
    liquidity: 1200000000,
    lastUpdated: Date.now()
  },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
    price: 0.000025 + (Math.random() - 0.5) * 0.000005,
    priceChange24h: (Math.random() - 0.5) * 15,
    volume24h: 25000000,
    liquidity: 1800000000,
    lastUpdated: Date.now()
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    price: 1.00 + (Math.random() - 0.5) * 0.01,
    priceChange24h: (Math.random() - 0.5) * 0.5,
    volume24h: 2000000000,
    liquidity: 32000000000,
    lastUpdated: Date.now()
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    price: 1.00 + (Math.random() - 0.5) * 0.01,
    priceChange24h: (Math.random() - 0.5) * 0.3,
    volume24h: 1800000000,
    liquidity: 95000000000,
    lastUpdated: Date.now()
  },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': {
    price: 195.20 + (Math.random() - 0.5) * 12,
    priceChange24h: (Math.random() - 0.5) * 8,
    volume24h: 15000000,
    liquidity: 1500000000,
    lastUpdated: Date.now()
  },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': {
    price: 3200.00 + (Math.random() - 0.5) * 200,
    priceChange24h: (Math.random() - 0.5) * 6,
    volume24h: 800000000,
    liquidity: 385000000000,
    lastUpdated: Date.now()
  },
  'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM': {
    price: 1.00 + (Math.random() - 0.5) * 0.01,
    priceChange24h: (Math.random() - 0.5) * 0.2,
    volume24h: 120000000,
    liquidity: 28000000000,
    lastUpdated: Date.now()
  }
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Add some randomness to simulate real price movements
    const currentPrices = {};
    
    for (const [address, baseData] of Object.entries(MOCK_PRICES)) {
      // Add small random variations to simulate real-time updates
      const priceVariation = (Math.random() - 0.5) * 0.02; // ±1% variation
      const changeVariation = (Math.random() - 0.5) * 0.5; // ±0.25% change variation
      
      currentPrices[address] = {
        price: baseData.price * (1 + priceVariation),
        priceChange24h: baseData.priceChange24h + changeVariation,
        volume24h: baseData.volume24h,
        liquidity: baseData.liquidity,
        lastUpdated: Date.now()
      };
    }

    res.status(200).json({
      success: true,
      type: 'price_update',
      prices: currentPrices,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ Prices API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
