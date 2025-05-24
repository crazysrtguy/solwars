// Mock price data for Vercel deployment
// In production, this would connect to real price feeds

// Enhanced token price configurations
const ENHANCED_PRICE_CONFIGS = {
  // Major Solana Ecosystem
  'So11111111111111111111111111111111111111112': {
    basePrice: 180.50, variation: 10, volume24h: 1500000000, liquidity: 85000000000
  },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {
    basePrice: 0.85, variation: 0.1, volume24h: 45000000, liquidity: 1200000000
  },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': {
    basePrice: 3.45, variation: 0.5, volume24h: 12000000, liquidity: 780000000
  },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': {
    basePrice: 2.85, variation: 0.3, volume24h: 8500000, liquidity: 650000000
  },

  // Stablecoins
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    basePrice: 1.00, variation: 0.01, volume24h: 2000000000, liquidity: 32000000000
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    basePrice: 1.00, variation: 0.01, volume24h: 1800000000, liquidity: 95000000000
  },

  // Liquid Staking
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': {
    basePrice: 195.20, variation: 12, volume24h: 35000000, liquidity: 2500000000
  },
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': {
    basePrice: 198.75, variation: 9, volume24h: 42000000, liquidity: 3200000000
  },

  // Popular Meme Coins
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
    basePrice: 0.000025, variation: 0.000005, volume24h: 25000000, liquidity: 1800000000
  },
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': {
    basePrice: 1.17, variation: 0.2, volume24h: 18000000, liquidity: 950000000
  },
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': {
    basePrice: 0.65, variation: 0.15, volume24h: 15000000, liquidity: 850000000
  },
  'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump': {
    basePrice: 1.25, variation: 0.3, volume24h: 28000000, liquidity: 1100000000
  },

  // Infrastructure & Utility
  'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC': {
    basePrice: 4.85, variation: 0.8, volume24h: 22000000, liquidity: 1400000000
  },
  'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y': {
    basePrice: 0.45, variation: 0.08, volume24h: 5500000, liquidity: 320000000
  },

  // Gaming & NFT
  'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx': {
    basePrice: 0.0035, variation: 0.0008, volume24h: 3200000, liquidity: 180000000
  },
  'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk': {
    basePrice: 0.125, variation: 0.025, volume24h: 2800000, liquidity: 150000000
  },

  // DeFi
  'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt': {
    basePrice: 0.28, variation: 0.05, volume24h: 4500000, liquidity: 280000000
  },
  'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac': {
    basePrice: 0.015, variation: 0.003, volume24h: 1800000, liquidity: 95000000
  },

  // Newer Trending
  'JTO4BdwjNO6MLrpE7rhHXt6qzxgBZNEJQCBrVX5VNy3': {
    basePrice: 2.15, variation: 0.4, volume24h: 18500000, liquidity: 890000000
  },
  'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6': {
    basePrice: 0.85, variation: 0.15, volume24h: 12000000, liquidity: 650000000
  }
};

// Generate realistic current prices
function generateCurrentPrices() {
  const currentPrices = {};

  for (const [address, config] of Object.entries(ENHANCED_PRICE_CONFIGS)) {
    // Add realistic price variations
    const priceVariation = (Math.random() - 0.5) * 0.02; // ±1% variation
    const changeVariation = (Math.random() - 0.5) * 0.5; // ±0.25% change variation
    const baseChange = (Math.random() - 0.5) * 10; // Base 24h change

    currentPrices[address] = {
      price: config.basePrice * (1 + priceVariation),
      priceChange24h: baseChange + changeVariation,
      priceChange6h: baseChange * 0.6,
      priceChange1h: baseChange * 0.1,
      volume24h: config.volume24h * (0.8 + Math.random() * 0.4), // ±20% volume variation
      volume6h: config.volume24h * 0.3 * (0.8 + Math.random() * 0.4),
      volume1h: config.volume24h * 0.05 * (0.8 + Math.random() * 0.4),
      liquidity: config.liquidity,
      marketCap: config.liquidity * (2 + Math.random() * 3), // Rough market cap estimate
      txns24h: Math.floor(Math.random() * 10000),
      buys24h: Math.floor(Math.random() * 5000),
      sells24h: Math.floor(Math.random() * 5000),
      lastUpdated: Date.now(),
      source: 'mock'
    };
  }

  return currentPrices;
}

module.exports = async function handler(req, res) {
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
    // Generate current prices with realistic variations
    const currentPrices = generateCurrentPrices();

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
