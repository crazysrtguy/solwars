// Trending tokens API for Vercel deployment
import axios from 'axios';

// Enhanced token list with more variety
const ENHANCED_TOKENS = [
  // Major Solana Ecosystem
  { address: 'So11111111111111111111111111111111111111112', name: 'Wrapped SOL', symbol: 'SOL' },
  { address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', name: 'Jupiter', symbol: 'JUP' },
  { address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', name: 'Raydium', symbol: 'RAY' },
  { address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', name: 'Orca', symbol: 'ORCA' },
  
  // Stablecoins
  { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USD Coin', symbol: 'USDC' },
  { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', name: 'Tether USD', symbol: 'USDT' },
  
  // Liquid Staking
  { address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', name: 'Marinade Staked SOL', symbol: 'mSOL' },
  { address: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', name: 'Jito Staked SOL', symbol: 'JitoSOL' },
  
  // Popular Meme Coins
  { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', name: 'Bonk', symbol: 'BONK' },
  { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', name: 'dogwifhat', symbol: 'WIF' },
  { address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', name: 'Popcat', symbol: 'POPCAT' },
  { address: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', name: 'Peanut the Squirrel', symbol: 'PNUT' },
  
  // Infrastructure
  { address: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', name: 'Helium', symbol: 'HNT' },
  { address: 'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y', name: 'Shadow Token', symbol: 'SHDW' },
  
  // Gaming & NFT
  { address: 'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx', name: 'Star Atlas', symbol: 'ATLAS' },
  { address: 'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk', name: 'Star Atlas DAO', symbol: 'POLIS' },
  
  // DeFi
  { address: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt', name: 'Serum', symbol: 'SRM' },
  { address: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac', name: 'Mango', symbol: 'MNGO' },
  
  // Newer Trending
  { address: 'JTO4BdwjNO6MLrpE7rhHXt6qzxgBZNEJQCBrVX5VNy3', name: 'Jito', symbol: 'JTO' },
  { address: 'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6', name: 'Tensor', symbol: 'TNSR' }
];

// Get trending tokens with DexScreener data
async function getTrendingTokens(limit = 25) {
  try {
    console.log('🔥 Fetching trending tokens with DexScreener data...');
    
    // Get a subset of tokens to fetch data for
    const tokensToFetch = ENHANCED_TOKENS.slice(0, Math.min(limit * 2, ENHANCED_TOKENS.length));
    const tokenAddresses = tokensToFetch.map(t => t.address);
    
    // Fetch comprehensive data from DexScreener
    const enrichedTokens = await getComprehensiveTokenData(tokenAddresses);
    
    // Calculate trending scores and sort
    const scoredTokens = enrichedTokens
      .filter(token => token && token.price > 0)
      .map(token => {
        // Calculate trending score
        const volume24h = token.volume24h || 0;
        const volume6h = token.volume6h || 0;
        const volume1h = token.volume1h || 0;
        const priceChange24h = Math.abs(token.priceChange24h || 0);
        const priceChange6h = Math.abs(token.priceChange6h || 0);
        const txns24h = token.txns24h || 0;
        const liquidity = token.liquidity || 0;
        const boosts = token.boosts || 0;

        let trendingScore = 0;
        trendingScore += Math.log10(volume24h + 1) * 10;
        trendingScore += Math.log10(volume6h + 1) * 15;
        trendingScore += Math.log10(volume1h + 1) * 20;
        trendingScore += priceChange24h * 2;
        trendingScore += priceChange6h * 3;
        trendingScore += Math.log10(txns24h + 1) * 5;
        trendingScore += Math.log10(liquidity + 1) * 3;
        trendingScore += boosts * 50;

        return {
          ...token,
          trendingScore,
          tokenAddress: token.address,
          chainId: 'solana'
        };
      })
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);

    console.log(`✅ Returning ${scoredTokens.length} trending tokens`);
    return scoredTokens;
    
  } catch (error) {
    console.error('❌ Error fetching trending tokens:', error);
    // Return fallback data
    return getFallbackTokens(limit);
  }
}

// Get comprehensive token data from DexScreener
async function getComprehensiveTokenData(tokenAddresses) {
  try {
    const results = [];
    
    // Process in chunks of 30 (DexScreener limit)
    for (let i = 0; i < tokenAddresses.length; i += 30) {
      const chunk = tokenAddresses.slice(i, i + 30);
      const chunkData = await fetchTokenChunk(chunk);
      results.push(...chunkData);
      
      // Small delay to avoid rate limiting
      if (i + 30 < tokenAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  } catch (error) {
    console.error('❌ Error getting comprehensive token data:', error);
    return [];
  }
}

// Fetch a chunk of tokens from DexScreener
async function fetchTokenChunk(addresses) {
  try {
    const addressList = addresses.join(',');
    const response = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${addressList}`,
      { timeout: 10000 }
    );

    if (!response.data || !response.data.pairs) {
      return [];
    }

    const tokenMap = new Map();
    
    // Process pairs and find best data for each token
    for (const pair of response.data.pairs) {
      if (!pair.baseToken?.address || pair.chainId !== 'solana') continue;
      
      const address = pair.baseToken.address;
      const existing = tokenMap.get(address);
      
      // Use pair with highest liquidity
      if (!existing || (pair.liquidity?.usd || 0) > (existing.liquidity || 0)) {
        const tokenInfo = ENHANCED_TOKENS.find(t => t.address === address) || {};
        
        tokenMap.set(address, {
          address,
          name: tokenInfo.name || pair.baseToken.name || 'Unknown',
          symbol: tokenInfo.symbol || pair.baseToken.symbol || 'UNKNOWN',
          price: parseFloat(pair.priceUsd) || 0,
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
          boosts: pair.boosts?.active || 0,
          pairAddress: pair.pairAddress,
          dexId: pair.dexId,
          url: pair.url,
          image: pair.info?.imageUrl,
          icon: pair.info?.imageUrl,
          imageUrl: pair.info?.imageUrl
        });
      }
    }
    
    return Array.from(tokenMap.values());
  } catch (error) {
    console.error('❌ Error fetching token chunk:', error);
    return [];
  }
}

// Fallback tokens with mock data
function getFallbackTokens(limit = 25) {
  return ENHANCED_TOKENS.slice(0, limit).map((token, index) => ({
    ...token,
    tokenAddress: token.address,
    chainId: 'solana',
    price: Math.random() * 100 + 1,
    priceChange24h: (Math.random() - 0.5) * 20,
    volume24h: Math.random() * 10000000,
    liquidity: Math.random() * 50000000,
    marketCap: Math.random() * 1000000000,
    trendingScore: 100 - index * 2,
    txns24h: Math.floor(Math.random() * 10000),
    boosts: Math.floor(Math.random() * 3)
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = parseInt(req.query.limit) || 25;
    const trendingTokens = await getTrendingTokens(limit);
    
    res.status(200).json(trendingTokens);
  } catch (error) {
    console.error('❌ Trending tokens API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trending tokens',
      message: error.message 
    });
  }
}
