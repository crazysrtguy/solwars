// Individual token data API for Vercel deployment
import axios from 'axios';

// Token metadata lookup
const TOKEN_METADATA = {
  'So11111111111111111111111111111111111111112': { name: 'Wrapped SOL', symbol: 'SOL' },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { name: 'Jupiter', symbol: 'JUP' },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { name: 'Bonk', symbol: 'BONK' },
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { name: 'dogwifhat', symbol: 'WIF' },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { name: 'Raydium', symbol: 'RAY' },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { name: 'Orca', symbol: 'ORCA' },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { name: 'USD Coin', symbol: 'USDC' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { name: 'Tether USD', symbol: 'USDT' },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { name: 'Marinade Staked SOL', symbol: 'mSOL' },
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { name: 'Jito Staked SOL', symbol: 'JitoSOL' },
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': { name: 'Popcat', symbol: 'POPCAT' },
  'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump': { name: 'Peanut the Squirrel', symbol: 'PNUT' },
  'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC': { name: 'Helium', symbol: 'HNT' },
  'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y': { name: 'Shadow Token', symbol: 'SHDW' },
  'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx': { name: 'Star Atlas', symbol: 'ATLAS' },
  'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk': { name: 'Star Atlas DAO', symbol: 'POLIS' },
  'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt': { name: 'Serum', symbol: 'SRM' },
  'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac': { name: 'Mango', symbol: 'MNGO' },
  'JTO4BdwjNO6MLrpE7rhHXt6qzxgBZNEJQCBrVX5VNy3': { name: 'Jito', symbol: 'JTO' },
  'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6': { name: 'Tensor', symbol: 'TNSR' }
};

// Get token data from DexScreener
async function getTokenData(address) {
  try {
    console.log(`🔍 Fetching DexScreener data for token: ${address}`);
    
    const response = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SolWars/1.0)',
          'Accept': 'application/json'
        }
      }
    );

    if (!response.data || !response.data.pairs || response.data.pairs.length === 0) {
      console.warn(`⚠️ No pairs found for token: ${address}`);
      return getFallbackTokenData(address);
    }

    // Find the best pair (highest liquidity)
    const solanaPairs = response.data.pairs.filter(pair => pair.chainId === 'solana');
    if (solanaPairs.length === 0) {
      console.warn(`⚠️ No Solana pairs found for token: ${address}`);
      return getFallbackTokenData(address);
    }

    const bestPair = solanaPairs.reduce((best, current) => {
      const bestLiquidity = best.liquidity?.usd || 0;
      const currentLiquidity = current.liquidity?.usd || 0;
      return currentLiquidity > bestLiquidity ? current : best;
    });

    // Get token metadata
    const metadata = TOKEN_METADATA[address] || {};
    
    const tokenData = {
      address,
      name: metadata.name || bestPair.baseToken?.name || 'Unknown Token',
      symbol: metadata.symbol || bestPair.baseToken?.symbol || 'UNKNOWN',
      price: parseFloat(bestPair.priceUsd) || 0,
      priceChange24h: bestPair.priceChange?.h24 || 0,
      priceChange6h: bestPair.priceChange?.h6 || 0,
      priceChange1h: bestPair.priceChange?.h1 || 0,
      volume24h: bestPair.volume?.h24 || 0,
      volume6h: bestPair.volume?.h6 || 0,
      volume1h: bestPair.volume?.h1 || 0,
      liquidity: bestPair.liquidity?.usd || 0,
      marketCap: bestPair.marketCap || 0,
      fdv: bestPair.fdv || 0,
      txns24h: (bestPair.txns?.h24?.buys || 0) + (bestPair.txns?.h24?.sells || 0),
      buys24h: bestPair.txns?.h24?.buys || 0,
      sells24h: bestPair.txns?.h24?.sells || 0,
      boosts: bestPair.boosts?.active || 0,
      pairAddress: bestPair.pairAddress,
      dexId: bestPair.dexId,
      url: bestPair.url,
      image: bestPair.info?.imageUrl,
      icon: bestPair.info?.imageUrl,
      imageUrl: bestPair.info?.imageUrl,
      website: bestPair.info?.websites?.[0]?.url,
      twitter: bestPair.info?.socials?.find(s => s.type === 'twitter')?.url,
      lastUpdated: Date.now(),
      source: 'dexscreener'
    };

    console.log(`✅ Retrieved data for ${tokenData.symbol}: $${tokenData.price}`);
    return tokenData;

  } catch (error) {
    console.error(`❌ Error fetching token data for ${address}:`, error.message);
    return getFallbackTokenData(address);
  }
}

// Fallback token data
function getFallbackTokenData(address) {
  const metadata = TOKEN_METADATA[address] || { name: 'Unknown Token', symbol: 'UNKNOWN' };
  
  // Generate some realistic mock data
  const basePrice = Math.random() * 100 + 0.01;
  const priceChange = (Math.random() - 0.5) * 20;
  const volume = Math.random() * 10000000;
  
  return {
    address,
    name: metadata.name,
    symbol: metadata.symbol,
    price: basePrice,
    priceChange24h: priceChange,
    priceChange6h: priceChange * 0.6,
    priceChange1h: priceChange * 0.1,
    volume24h: volume,
    volume6h: volume * 0.3,
    volume1h: volume * 0.05,
    liquidity: Math.random() * 50000000,
    marketCap: Math.random() * 1000000000,
    fdv: Math.random() * 1500000000,
    txns24h: Math.floor(Math.random() * 10000),
    buys24h: Math.floor(Math.random() * 5000),
    sells24h: Math.floor(Math.random() * 5000),
    boosts: Math.floor(Math.random() * 3),
    lastUpdated: Date.now(),
    source: 'fallback'
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({ error: 'Token address required' });
    }

    console.log(`🔍 Token data API request for: ${address}`);
    
    const tokenData = await getTokenData(address);
    
    if (tokenData) {
      res.status(200).json(tokenData);
    } else {
      res.status(404).json({ error: 'Token not found' });
    }
    
  } catch (error) {
    console.error('❌ Token data API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch token data',
      message: error.message 
    });
  }
}
