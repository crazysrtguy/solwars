const axios = require('axios');

class DexScreenerService {
  constructor() {
    this.baseURL = 'https://api.dexscreener.com';
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  // Get token data by contract address
  async getTokenData(tokenAddress) {
    try {
      const cacheKey = `token_${tokenAddress}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      console.log(`🔍 Fetching DexScreener data for token: ${tokenAddress}`);

      const response = await axios.get(`${this.baseURL}/tokens/v1/solana/${tokenAddress}`);

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Select the best pair (highest liquidity)
        const bestPair = this.selectBestPair(response.data);

        const tokenData = {
          address: tokenAddress,
          name: bestPair.baseToken.name,
          symbol: bestPair.baseToken.symbol,

          // Price data
          price: parseFloat(bestPair.priceUsd || 0),
          priceNative: parseFloat(bestPair.priceNative || 0),

          // Market data
          marketCap: bestPair.marketCap,
          fdv: bestPair.fdv,

          // Volume data
          volume24h: bestPair.volume?.h24 || 0,
          volume6h: bestPair.volume?.h6 || 0,
          volume1h: bestPair.volume?.h1 || 0,

          // Price changes
          priceChange24h: bestPair.priceChange?.h24 || 0,
          priceChange6h: bestPair.priceChange?.h6 || 0,
          priceChange1h: bestPair.priceChange?.h1 || 0,

          // Transaction data
          txns24h: (bestPair.txns?.h24?.buys || 0) + (bestPair.txns?.h24?.sells || 0),
          buys24h: bestPair.txns?.h24?.buys || 0,
          sells24h: bestPair.txns?.h24?.sells || 0,

          // Liquidity
          liquidity: bestPair.liquidity?.usd || 0,
          liquidityBase: bestPair.liquidity?.base || 0,
          liquidityQuote: bestPair.liquidity?.quote || 0,

          // Visual data
          icon: bestPair.info?.imageUrl,
          header: bestPair.info?.header,

          // Social links
          website: bestPair.info?.websites?.[0]?.url,
          twitter: bestPair.info?.socials?.find(s => s.type === 'twitter')?.url,
          telegram: bestPair.info?.socials?.find(s => s.type === 'telegram')?.url,
          discord: bestPair.info?.socials?.find(s => s.type === 'discord')?.url,

          // DEX info
          dexId: bestPair.dexId,
          pairAddress: bestPair.pairAddress,
          url: bestPair.url,

          // Chain info
          chainId: bestPair.chainId,

          // Quote token info
          quoteToken: bestPair.quoteToken,

          // Pair creation time
          pairCreatedAt: bestPair.pairCreatedAt,

          // Timestamp
          timestamp: Date.now()
        };

        // Cache the result
        this.cache.set(cacheKey, {
          data: tokenData,
          timestamp: Date.now()
        });

        console.log(`✅ Retrieved data for ${tokenData.symbol}: $${tokenData.price}`);
        return tokenData;
      } else {
        console.warn(`⚠️ No pairs found for token: ${tokenAddress}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error fetching token data for ${tokenAddress}:`, error.message);
      return null;
    }
  }

  // Get multiple tokens data using batch API
  async getMultipleTokensData(tokenAddresses) {
    try {
      console.log(`🔍 Fetching DexScreener data for ${tokenAddresses.length} tokens...`);

      // Use batch API for better performance
      const addressesString = tokenAddresses.join(',');
      const response = await axios.get(`${this.baseURL}/tokens/v1/solana/${addressesString}`);

      const tokenData = {};

      if (response.data && Array.isArray(response.data)) {
        // Group pairs by token address
        const pairsByToken = {};
        response.data.forEach(pair => {
          const tokenAddress = pair.baseToken.address;
          if (!pairsByToken[tokenAddress]) {
            pairsByToken[tokenAddress] = [];
          }
          pairsByToken[tokenAddress].push(pair);
        });

        // Process each token
        for (const [tokenAddress, pairs] of Object.entries(pairsByToken)) {
          if (pairs.length > 0) {
            const bestPair = this.selectBestPair(pairs);

            tokenData[tokenAddress] = {
              address: tokenAddress,
              name: bestPair.baseToken.name,
              symbol: bestPair.baseToken.symbol,

              // Price data
              price: parseFloat(bestPair.priceUsd || 0),
              priceNative: parseFloat(bestPair.priceNative || 0),

              // Market data
              marketCap: bestPair.marketCap,
              fdv: bestPair.fdv,

              // Volume data
              volume24h: bestPair.volume?.h24 || 0,
              volume6h: bestPair.volume?.h6 || 0,
              volume1h: bestPair.volume?.h1 || 0,

              // Price changes
              priceChange24h: bestPair.priceChange?.h24 || 0,
              priceChange6h: bestPair.priceChange?.h6 || 0,
              priceChange1h: bestPair.priceChange?.h1 || 0,

              // Transaction data
              txns24h: (bestPair.txns?.h24?.buys || 0) + (bestPair.txns?.h24?.sells || 0),
              buys24h: bestPair.txns?.h24?.buys || 0,
              sells24h: bestPair.txns?.h24?.sells || 0,

              // Liquidity
              liquidity: bestPair.liquidity?.usd || 0,
              liquidityBase: bestPair.liquidity?.base || 0,
              liquidityQuote: bestPair.liquidity?.quote || 0,

              // Visual data
              icon: bestPair.info?.imageUrl,
              header: bestPair.info?.header,

              // Social links
              website: bestPair.info?.websites?.[0]?.url,
              twitter: bestPair.info?.socials?.find(s => s.type === 'twitter')?.url,
              telegram: bestPair.info?.socials?.find(s => s.type === 'telegram')?.url,
              discord: bestPair.info?.socials?.find(s => s.type === 'discord')?.url,

              // DEX info
              dexId: bestPair.dexId,
              pairAddress: bestPair.pairAddress,
              url: bestPair.url,

              // Chain info
              chainId: bestPair.chainId,

              // Quote token info
              quoteToken: bestPair.quoteToken,

              // Pair creation time
              pairCreatedAt: bestPair.pairCreatedAt,

              // Timestamp
              timestamp: Date.now()
            };
          }
        }
      }

      console.log(`✅ Successfully retrieved data for ${Object.keys(tokenData).length}/${tokenAddresses.length} tokens`);
      return tokenData;
    } catch (error) {
      console.error('❌ Error fetching multiple tokens data:', error.message);
      return {};
    }
  }

  // Search for tokens
  async searchTokens(query, limit = 10) {
    try {
      console.log(`🔍 Searching DexScreener for: ${query}`);

      const response = await axios.get(`${this.baseURL}/latest/dex/search/?q=${encodeURIComponent(query)}`);

      if (response.data && response.data.pairs) {
        // Filter for Solana tokens only and limit results
        const solanaTokens = response.data.pairs
          .filter(pair => pair.chainId === 'solana')
          .slice(0, limit)
          .map(pair => ({
            address: pair.baseToken.address,
            name: pair.baseToken.name,
            symbol: pair.baseToken.symbol,
            price: parseFloat(pair.priceUsd || 0),
            marketCap: pair.marketCap,
            volume24h: pair.volume?.h24 || 0,
            priceChange24h: pair.priceChange?.h24 || 0,
            liquidity: pair.liquidity?.usd || 0,
            icon: pair.info?.imageUrl,
            url: pair.url,
            dexId: pair.dexId
          }));

        console.log(`✅ Found ${solanaTokens.length} Solana tokens for query: ${query}`);
        return solanaTokens;
      } else {
        console.warn(`⚠️ No results found for query: ${query}`);
        return [];
      }
    } catch (error) {
      console.error(`❌ Error searching tokens for query ${query}:`, error.message);
      return [];
    }
  }

  // Get trending tokens (using popular Solana tokens)
  async getTrendingTokens(limit = 10) {
    try {
      console.log('🔥 Fetching trending Solana tokens...');

      // Popular Solana token addresses
      const popularTokens = [
        'So11111111111111111111111111111111111111112', // SOL
        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
        'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
        '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
        '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ORCA
        'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
        'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1'  // bSOL
      ];

      const tokenData = await this.getMultipleTokensData(popularTokens.slice(0, limit));

      // Convert to array and sort by volume
      const trendingTokens = Object.values(tokenData)
        .filter(token => token && token.price > 0)
        .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
        .slice(0, limit);

      console.log(`✅ Retrieved ${trendingTokens.length} trending tokens`);
      return trendingTokens;
    } catch (error) {
      console.error('❌ Error fetching trending tokens:', error.message);
      return [];
    }
  }

  // Select the best trading pair (highest liquidity)
  selectBestPair(pairs) {
    if (!pairs || pairs.length === 0) return null;

    // Sort by liquidity (USD) descending
    return pairs.sort((a, b) => {
      const liquidityA = a.liquidity?.usd || 0;
      const liquidityB = b.liquidity?.usd || 0;
      return liquidityB - liquidityA;
    })[0];
  }

  // Clean cache
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout * 2) {
        this.cache.delete(key);
      }
    }
  }

  // Get real-time price for a token
  async getTokenPrice(tokenAddress) {
    const tokenData = await this.getTokenData(tokenAddress);
    return tokenData ? tokenData.price : 0;
  }

  // Get multiple token prices
  async getTokenPrices(tokenAddresses) {
    const tokenData = await this.getMultipleTokensData(tokenAddresses);
    const prices = {};

    for (const [address, data] of Object.entries(tokenData)) {
      prices[address] = data.price || 0;
    }

    return prices;
  }
}

module.exports = DexScreenerService;
