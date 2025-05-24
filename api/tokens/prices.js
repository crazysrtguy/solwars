// Token prices API for Vercel deployment
const axios = require('axios');

// Get token prices from DexScreener
async function getTokenPrices(tokenAddresses) {
  try {
    if (!tokenAddresses || tokenAddresses.length === 0) {
      return {};
    }

    console.log(`💰 Fetching prices for ${tokenAddresses.length} tokens from DexScreener...`);

    const results = {};

    // Process in chunks of 30 (DexScreener API limit)
    for (let i = 0; i < tokenAddresses.length; i += 30) {
      const chunk = tokenAddresses.slice(i, i + 30);
      const chunkPrices = await fetchPriceChunk(chunk);
      Object.assign(results, chunkPrices);

      // Small delay between chunks to avoid rate limiting
      if (i + 30 < tokenAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ Retrieved prices for ${Object.keys(results).length} tokens`);
    return results;

  } catch (error) {
    console.error('❌ Error fetching token prices:', error);
    return {};
  }
}

// Fetch prices for a chunk of tokens
async function fetchPriceChunk(addresses) {
  try {
    const addressList = addresses.join(',');
    const response = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${addressList}`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SolWars/1.0)',
          'Accept': 'application/json'
        }
      }
    );

    if (!response.data || !response.data.pairs) {
      console.warn('⚠️ No pairs data received from DexScreener');
      return {};
    }

    const prices = {};

    // Group pairs by token address and find best price data
    const tokenPairs = new Map();

    for (const pair of response.data.pairs) {
      if (!pair.baseToken?.address || pair.chainId !== 'solana') continue;

      const address = pair.baseToken.address;
      const existing = tokenPairs.get(address);

      // Use pair with highest liquidity for most accurate pricing
      if (!existing || (pair.liquidity?.usd || 0) > (existing.liquidity?.usd || 0)) {
        tokenPairs.set(address, pair);
      }
    }

    // Convert to price data format
    for (const [address, pair] of tokenPairs) {
      if (pair.priceUsd && parseFloat(pair.priceUsd) > 0) {
        prices[address] = {
          price: parseFloat(pair.priceUsd),
          priceChange: pair.priceChange?.h24 || 0,
          priceChange24h: pair.priceChange?.h24 || 0,
          priceChange6h: pair.priceChange?.h6 || 0,
          priceChange1h: pair.priceChange?.h1 || 0,
          volume24h: pair.volume?.h24 || 0,
          volume6h: pair.volume?.h6 || 0,
          volume1h: pair.volume?.h1 || 0,
          liquidity: pair.liquidity?.usd || 0,
          marketCap: pair.marketCap || 0,
          fdv: pair.fdv || 0,
          txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
          buys24h: pair.txns?.h24?.buys || 0,
          sells24h: pair.txns?.h24?.sells || 0,
          lastUpdated: Date.now(),
          source: 'dexscreener',
          pairAddress: pair.pairAddress,
          dexId: pair.dexId
        };
      }
    }

    return prices;

  } catch (error) {
    console.error('❌ Error fetching price chunk:', error);
    return {};
  }
}

// Fallback prices for common tokens
function getFallbackPrices(tokenAddresses) {
  const fallbackData = {
    'So11111111111111111111111111111111111111112': { price: 180.50, priceChange24h: 2.5, volume24h: 1500000000 },
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { price: 0.85, priceChange24h: -1.2, volume24h: 45000000 },
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { price: 0.000025, priceChange24h: 8.7, volume24h: 25000000 },
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { price: 1.17, priceChange24h: -3.4, volume24h: 18000000 },
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { price: 3.45, priceChange24h: 1.8, volume24h: 12000000 },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { price: 1.00, priceChange24h: 0.1, volume24h: 800000000 }
  };

  const result = {};
  for (const address of tokenAddresses) {
    if (fallbackData[address]) {
      result[address] = {
        ...fallbackData[address],
        priceChange: fallbackData[address].priceChange24h,
        liquidity: Math.random() * 50000000,
        marketCap: Math.random() * 1000000000,
        txns24h: Math.floor(Math.random() * 10000),
        lastUpdated: Date.now(),
        source: 'fallback'
      };
    }
  }

  return result;
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tokenAddresses } = req.body;

    if (!tokenAddresses || !Array.isArray(tokenAddresses)) {
      return res.status(400).json({ error: 'Token addresses array required' });
    }

    console.log(`💰 Price API request for ${tokenAddresses.length} tokens`);

    // Try to get real prices from DexScreener
    let prices = await getTokenPrices(tokenAddresses);

    // If no prices received, use fallback
    if (Object.keys(prices).length === 0) {
      console.log('🔄 Using fallback prices...');
      prices = getFallbackPrices(tokenAddresses);
    }

    res.status(200).json(prices);

  } catch (error) {
    console.error('❌ Token prices API error:', error);

    // Return fallback prices on error
    const { tokenAddresses } = req.body || {};
    const fallbackPrices = Array.isArray(tokenAddresses) ? getFallbackPrices(tokenAddresses) : {};

    res.status(200).json(fallbackPrices);
  }
}
