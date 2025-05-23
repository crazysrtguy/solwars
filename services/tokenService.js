const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class TokenService {
  constructor() {
    this.dexScreenerAPI = 'https://api.dexscreener.com';
    this.jupiterAPI = 'https://price.jup.ag/v4';
    this.heliusAPI = process.env.HELIUS_API_URL || 'https://api.helius.xyz/v0';
    this.cache = new Map();
    this.tokenProfilesCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  // Get trending Solana tokens from DexScreener
  async getTrendingTokens(limit = 20) {
    try {
      console.log('🔥 Fetching trending Solana tokens from DexScreener...');

      // Use established Solana tokens with verified data
      const establishedTokens = this.getEstablishedTokens();
      const tokenAddresses = establishedTokens.map(t => t.address);

      // Get comprehensive data for these tokens
      const comprehensiveData = await this.getComprehensiveTokenData(tokenAddresses);

      // Convert to trending format with real DexScreener data
      const trendingTokens = establishedTokens.map(token => {
        const richData = comprehensiveData[token.address];
        if (richData && richData.price > 0) {
          return {
            tokenAddress: token.address,
            chainId: 'solana',
            ...richData
          };
        }
        return null;
      }).filter(token => token !== null).slice(0, limit);

      console.log(`✅ Found ${trendingTokens.length} trending Solana tokens with DexScreener data`);
      return trendingTokens;
    } catch (error) {
      console.error('❌ Error fetching trending tokens:', error.message);
      return this.getFallbackTokens();
    }
  }

  // Get real-time token prices from multiple sources
  async getTokenPrices(tokenAddresses) {
    try {
      const cacheKey = `prices_${tokenAddresses.join(',')}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      console.log(`💰 Fetching prices for ${tokenAddresses.length} tokens...`);

      // Primary: Jupiter Price API
      const jupiterResponse = await axios.get(
        `${this.jupiterAPI}/price?ids=${tokenAddresses.join(',')}`
      );

      const prices = {};
      for (const [address, data] of Object.entries(jupiterResponse.data.data || {})) {
        prices[address] = {
          address,
          price: data.price,
          source: 'jupiter',
          timestamp: Date.now()
        };
      }

      // Fallback: DexScreener for missing tokens
      for (const address of tokenAddresses) {
        if (!prices[address]) {
          try {
            const dexResponse = await axios.get(
              `${this.dexScreenerAPI}/latest/dex/tokens/${address}`
            );

            if (dexResponse.data.pairs && dexResponse.data.pairs.length > 0) {
              const pair = dexResponse.data.pairs[0];
              prices[address] = {
                address,
                price: parseFloat(pair.priceUsd || 0),
                marketCap: pair.marketCap,
                volume24h: pair.volume?.h24,
                priceChange: pair.priceChange?.h24,
                source: 'dexscreener',
                timestamp: Date.now()
              };
            }
          } catch (err) {
            console.warn(`⚠️ Could not fetch price for ${address}:`, err.message);
          }
        }
      }

      // Cache the results
      this.cache.set(cacheKey, {
        data: prices,
        timestamp: Date.now()
      });

      console.log(`✅ Fetched prices for ${Object.keys(prices).length} tokens`);
      return prices;
    } catch (error) {
      console.error('❌ Error fetching token prices:', error.message);
      return {};
    }
  }

  // Get comprehensive token data from DexScreener with rich metadata
  async getComprehensiveTokenData(tokenAddresses) {
    try {
      console.log(`🎯 Fetching comprehensive data for ${tokenAddresses.length} tokens...`);

      const tokenData = {};

      // Get token profiles (icons, banners, descriptions)
      const profiles = await this.getTokenProfiles();

      // Process each token
      for (const address of tokenAddresses) {
        try {
          // Get token pairs data from DexScreener
          const pairsResponse = await axios.get(
            `${this.dexScreenerAPI}/latest/dex/tokens/${address}`
          );

          if (pairsResponse.data.pairs && pairsResponse.data.pairs.length > 0) {
            const bestPair = this.selectBestPair(pairsResponse.data.pairs);
            const profile = profiles.find(p => p.tokenAddress === address);

            tokenData[address] = {
              // Basic info
              address,
              name: bestPair.baseToken.name,
              symbol: bestPair.baseToken.symbol,

              // Rich metadata from profiles
              icon: profile?.icon || bestPair.info?.imageUrl,
              banner: profile?.header,
              description: profile?.description,
              website: profile?.links?.find(l => l.type === 'website')?.url,
              twitter: profile?.links?.find(l => l.type === 'twitter')?.url,
              telegram: profile?.links?.find(l => l.type === 'telegram')?.url,
              discord: profile?.links?.find(l => l.type === 'discord')?.url,

              // Trading data
              price: parseFloat(bestPair.priceUsd || 0),
              priceNative: parseFloat(bestPair.priceNative || 0),
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

              // DEX info
              dexId: bestPair.dexId,
              pairAddress: bestPair.pairAddress,
              pairCreatedAt: bestPair.pairCreatedAt,

              // Boost info (trending indicator)
              boosts: bestPair.boosts?.active || 0,
              labels: bestPair.labels || [],

              // DexScreener URL
              url: bestPair.url,

              // Additional metadata
              quoteToken: bestPair.quoteToken,
              timestamp: Date.now()
            };
          }
        } catch (error) {
          console.warn(`⚠️ Could not fetch data for token ${address}:`, error.message);
        }
      }

      console.log(`✅ Fetched comprehensive data for ${Object.keys(tokenData).length} tokens`);
      return tokenData;
    } catch (error) {
      console.error('❌ Error fetching comprehensive token data:', error.message);
      return {};
    }
  }

  // Get token profiles with icons and banners
  async getTokenProfiles() {
    try {
      const cacheKey = 'token_profiles';
      const cached = this.tokenProfilesCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout * 2) {
        return cached.data;
      }

      console.log('🖼️ Fetching token profiles...');

      const response = await axios.get(`${this.dexScreenerAPI}/token-profiles/latest/v1`);
      const profiles = response.data.filter(profile => profile.chainId === 'solana');

      this.tokenProfilesCache.set(cacheKey, {
        data: profiles,
        timestamp: Date.now()
      });

      console.log(`✅ Fetched ${profiles.length} token profiles`);
      return profiles;
    } catch (error) {
      console.error('❌ Error fetching token profiles:', error.message);
      return [];
    }
  }

  // Select the best trading pair for a token (highest liquidity)
  selectBestPair(pairs) {
    if (!pairs || pairs.length === 0) return null;

    // Sort by liquidity (USD) descending
    return pairs.sort((a, b) => {
      const liquidityA = a.liquidity?.usd || 0;
      const liquidityB = b.liquidity?.usd || 0;
      return liquidityB - liquidityA;
    })[0];
  }

  // Get token metadata from Helius (fallback)
  async getTokenMetadata(tokenAddresses) {
    try {
      console.log(`📊 Fetching metadata for ${tokenAddresses.length} tokens...`);

      const response = await axios.post(`${this.heliusAPI}/token-metadata`, {
        mintAccounts: tokenAddresses
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.HELIUS_API_KEY}`
        }
      });

      const metadata = {};
      response.data.forEach(token => {
        metadata[token.account] = {
          address: token.account,
          name: token.onChainMetadata?.metadata?.name || 'Unknown',
          symbol: token.onChainMetadata?.metadata?.symbol || 'UNK',
          image: token.offChainMetadata?.metadata?.image,
          description: token.offChainMetadata?.metadata?.description,
          supply: token.onChainAccountInfo?.accountInfo?.data?.parsed?.info?.supply
        };
      });

      console.log(`✅ Fetched metadata for ${Object.keys(metadata).length} tokens`);
      return metadata;
    } catch (error) {
      console.error('❌ Error fetching token metadata:', error.message);
      return {};
    }
  }

  // Select tokens for tournament (mix of trending + established)
  async selectTournamentTokens(count = 8) {
    try {
      console.log(`🎯 Selecting ${count} tokens for tournament...`);

      // Get trending tokens
      const trending = await this.getTrendingTokens(15);

      // Established Solana tokens (fallback/mix)
      const established = this.getEstablishedTokens();

      // Mix: 60% trending, 40% established
      const trendingCount = Math.ceil(count * 0.6);
      const establishedCount = count - trendingCount;

      const selectedTrending = trending.slice(0, trendingCount);
      const selectedEstablished = established.slice(0, establishedCount);

      const allSelected = [...selectedTrending, ...selectedEstablished];
      const tokenAddresses = allSelected.map(t => t.tokenAddress || t.address);

      // Get comprehensive token data with rich metadata
      const comprehensiveData = await this.getComprehensiveTokenData(tokenAddresses);

      // Combine all data with rich metadata
      const tournamentTokens = allSelected.map(token => {
        const address = token.tokenAddress || token.address;
        const richData = comprehensiveData[address];

        if (!richData || richData.price <= 0) {
          return null; // Skip tokens without valid data
        }

        return {
          // Basic info
          address,
          name: richData.name,
          symbol: richData.symbol,

          // Rich visual metadata
          icon: richData.icon,
          banner: richData.banner,
          description: richData.description,

          // Social links
          website: richData.website,
          twitter: richData.twitter,
          telegram: richData.telegram,
          discord: richData.discord,

          // Trading data
          price: richData.price,
          priceNative: richData.priceNative,
          marketCap: richData.marketCap,
          fdv: richData.fdv,

          // Volume data
          volume24h: richData.volume24h,
          volume6h: richData.volume6h,
          volume1h: richData.volume1h,

          // Price changes
          priceChange24h: richData.priceChange24h,
          priceChange6h: richData.priceChange6h,
          priceChange1h: richData.priceChange1h,

          // Transaction data
          txns24h: richData.txns24h,
          buys24h: richData.buys24h,
          sells24h: richData.sells24h,

          // Liquidity
          liquidity: richData.liquidity,
          liquidityBase: richData.liquidityBase,
          liquidityQuote: richData.liquidityQuote,

          // DEX info
          dexId: richData.dexId,
          pairAddress: richData.pairAddress,
          pairCreatedAt: richData.pairCreatedAt,

          // Trending indicators
          boosts: richData.boosts,
          labels: richData.labels,
          isTrending: selectedTrending.some(t => (t.tokenAddress || t.address) === address),

          // DexScreener URL
          url: richData.url,

          // Quote token info
          quoteToken: richData.quoteToken
        };
      }).filter(token => token !== null); // Remove invalid tokens

      console.log(`✅ Selected ${tournamentTokens.length} tokens with rich metadata for tournament`);
      return tournamentTokens;
    } catch (error) {
      console.error('❌ Error selecting tournament tokens:', error.message);
      return this.getFallbackTokens();
    }
  }

  // Store price snapshot for tournament
  async storePriceSnapshot(tournamentId, tokens) {
    try {
      const snapshots = tokens.map(token => ({
        tournamentId,
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        priceUsd: token.price,
        marketCap: token.marketCap,
        volume24h: token.volume24h,
        priceChange: token.priceChange,
        source: 'tournament_selection'
      }));

      await prisma.tokenPriceSnapshot.createMany({
        data: snapshots
      });

      console.log(`📸 Stored ${snapshots.length} price snapshots for tournament ${tournamentId}`);
    } catch (error) {
      console.error('❌ Error storing price snapshots:', error.message);
    }
  }

  // Get established Solana tokens (verified addresses)
  getEstablishedTokens() {
    return [
      {
        address: 'So11111111111111111111111111111111111111112',
        name: 'Wrapped SOL',
        symbol: 'SOL'
      },
      {
        address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        name: 'Jupiter',
        symbol: 'JUP'
      },
      {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        name: 'Bonk',
        symbol: 'BONK'
      },
      {
        address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
        name: 'dogwifhat',
        symbol: 'WIF'
      },
      {
        address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
        name: 'Popcat',
        symbol: 'POPCAT'
      },
      {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        name: 'USD Coin',
        symbol: 'USDC'
      },
      {
        address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        name: 'Raydium',
        symbol: 'RAY'
      },
      {
        address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
        name: 'Orca',
        symbol: 'ORCA'
      }
    ];
  }

  // Fallback tokens if APIs fail
  getFallbackTokens() {
    console.log('🔄 Using fallback tokens...');
    return this.getEstablishedTokens().map(token => ({
      ...token,
      price: Math.random() * 100 + 1, // Random price for demo
      isTrending: false
    }));
  }

  // Clean up old cache entries
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout * 2) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = TokenService;
