const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class TokenService {
  constructor() {
    this.dexScreenerAPI = 'https://api.dexscreener.com';
    this.jupiterAPI = 'https://api.jup.ag/price/v2'; // Updated Jupiter API URL
    this.heliusAPI = process.env.HELIUS_API_URL || 'https://api.helius.xyz/v0';
    this.cache = new Map();
    this.tokenProfilesCache = new Map();
    this.cacheTimeout = 15000; // 15 seconds for more real-time updates
  }

  // Get trending Solana tokens from DexScreener
  async getTrendingTokens(limit = 20) {
    try {
      console.log('🔥 Fetching trending Solana tokens from DexScreener...');

      // Method 1: Try to get trending from DexScreener search
      const trendingTokens = await this.getTrendingFromDexScreener(limit);

      if (trendingTokens.length >= limit) {
        console.log(`✅ Found ${trendingTokens.length} trending tokens from DexScreener`);
        return trendingTokens;
      }

      // Method 2: Use curated token list with fresh DexScreener data (more reliable)
      console.log('🔄 Using curated tokens with fresh DexScreener data...');
      const establishedTokens = this.getEstablishedTokens();
      const tokenAddresses = establishedTokens.map(t => t.address);

      // Get comprehensive data for these tokens
      const comprehensiveData = await this.getComprehensiveTokenData(tokenAddresses);

      // Convert to trending format with real DexScreener data and calculate trending scores
      const enrichedTokens = establishedTokens.map(token => {
        const richData = comprehensiveData[token.address];
        if (richData && richData.price > 0) {
          // Calculate trending score for curated tokens
          const volume24h = richData.volume24h || 0;
          const volume6h = richData.volume6h || 0;
          const volume1h = richData.volume1h || 0;
          const priceChange24h = Math.abs(richData.priceChange24h || 0);
          const priceChange6h = Math.abs(richData.priceChange6h || 0);
          const txns24h = richData.txns24h || 0;
          const liquidity = richData.liquidity || 0;
          const boosts = richData.boosts || 0;

          // Calculate trending score (same algorithm as DexScreener method)
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
            tokenAddress: token.address,
            chainId: 'solana',
            trendingScore,
            ...richData
          };
        }
        return null;
      }).filter(token => token !== null);

      // Sort by trending score and take the most active tokens
      const sortedTokens = enrichedTokens
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, limit);

      console.log(`✅ Using ${sortedTokens.length} curated tokens sorted by activity`);

      // Log top tokens
      sortedTokens.slice(0, 5).forEach((token, index) => {
        console.log(`${index + 1}. ${token.symbol} - Score: ${token.trendingScore.toFixed(1)}, Volume: $${token.volume24h?.toLocaleString()}`);
      });

      return sortedTokens;
    } catch (error) {
      console.error('❌ Error fetching trending tokens:', error.message);
      return this.getFallbackTokens();
    }
  }

  // Get trending tokens from DexScreener by analyzing high-volume pairs
  async getTrendingFromDexScreener(limit = 20) {
    try {
      console.log('📊 Analyzing DexScreener pairs for trending tokens...');

      // Method 1: Get all Solana pairs (more comprehensive)
      let allPairs = [];

      try {
        const solanaResponse = await axios.get(`${this.dexScreenerAPI}/latest/dex/pairs/solana`, {
          timeout: 20000
        });

        if (solanaResponse.data && solanaResponse.data.pairs) {
          allPairs = solanaResponse.data.pairs;
          console.log(`📈 Found ${allPairs.length} Solana pairs from pairs endpoint`);
        }
      } catch (error) {
        console.warn('⚠️ Solana pairs endpoint failed, trying search method...');

        // Fallback: Use search method
        const searchResponse = await axios.get(`${this.dexScreenerAPI}/latest/dex/search/?q=solana`, {
          timeout: 15000
        });

        if (searchResponse.data && searchResponse.data.pairs) {
          allPairs = searchResponse.data.pairs;
          console.log(`📈 Found ${allPairs.length} pairs from search endpoint`);
        }
      }

      if (allPairs.length === 0) {
        throw new Error('No pairs data received from any endpoint');
      }

      // Filter and score Solana pairs for trending potential
      const solanaPairs = allPairs
        .filter(pair => {
          return pair.chainId === 'solana' &&
                 pair.baseToken?.address &&
                 pair.baseToken?.symbol &&
                 pair.priceUsd &&
                 parseFloat(pair.priceUsd) > 0 &&
                 pair.volume?.h24 > 1000 && // Minimum $1k volume
                 pair.liquidity?.usd > 5000; // Minimum $5k liquidity
        })
        .map(pair => {
          // Calculate trending score based on multiple factors
          const volume24h = pair.volume?.h24 || 0;
          const volume6h = pair.volume?.h6 || 0;
          const volume1h = pair.volume?.h1 || 0;
          const priceChange24h = Math.abs(pair.priceChange?.h24 || 0);
          const priceChange6h = Math.abs(pair.priceChange?.h6 || 0);
          const txns24h = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
          const liquidity = pair.liquidity?.usd || 0;
          const boosts = pair.boosts?.active || 0;

          // Trending score calculation
          let trendingScore = 0;

          // Volume momentum (higher weight for recent volume)
          trendingScore += Math.log10(volume24h + 1) * 10;
          trendingScore += Math.log10(volume6h + 1) * 15; // 6h volume weighted higher
          trendingScore += Math.log10(volume1h + 1) * 20; // 1h volume weighted highest

          // Price volatility (indicates activity)
          trendingScore += priceChange24h * 2;
          trendingScore += priceChange6h * 3;

          // Transaction count (indicates interest)
          trendingScore += Math.log10(txns24h + 1) * 5;

          // Liquidity (stability factor)
          trendingScore += Math.log10(liquidity + 1) * 3;

          // DexScreener boosts (official trending indicator)
          trendingScore += boosts * 50;

          return {
            ...pair,
            trendingScore,
            tokenAddress: pair.baseToken.address,
            // Normalize data structure
            address: pair.baseToken.address,
            name: pair.baseToken.name,
            symbol: pair.baseToken.symbol,
            price: parseFloat(pair.priceUsd),
            volume24h: volume24h,
            volume6h: volume6h,
            volume1h: volume1h,
            priceChange24h: pair.priceChange?.h24 || 0,
            priceChange6h: pair.priceChange?.h6 || 0,
            priceChange1h: pair.priceChange?.h1 || 0,
            marketCap: pair.marketCap,
            fdv: pair.fdv,
            liquidity: liquidity,
            txns24h: txns24h,
            buys24h: pair.txns?.h24?.buys || 0,
            sells24h: pair.txns?.h24?.sells || 0,
            boosts: boosts,
            labels: pair.labels || [],
            dexId: pair.dexId,
            pairAddress: pair.pairAddress,
            url: pair.url,
            chainId: 'solana'
          };
        })
        .sort((a, b) => b.trendingScore - a.trendingScore) // Sort by trending score
        .slice(0, limit * 2); // Get more than needed for filtering

      console.log(`🎯 Found ${solanaPairs.length} potential trending tokens`);

      // Remove duplicates by token address (keep highest scoring)
      const uniqueTokens = [];
      const seenAddresses = new Set();

      for (const pair of solanaPairs) {
        if (!seenAddresses.has(pair.address)) {
          seenAddresses.add(pair.address);
          uniqueTokens.push(pair);
        }
      }

      const finalTrending = uniqueTokens.slice(0, limit);

      console.log(`🚀 Selected ${finalTrending.length} unique trending tokens`);

      // Log top trending tokens
      finalTrending.slice(0, 5).forEach((token, index) => {
        console.log(`${index + 1}. ${token.symbol} - Score: ${token.trendingScore.toFixed(1)}, Volume: $${token.volume24h.toLocaleString()}`);
      });

      return finalTrending;

    } catch (error) {
      console.error('❌ Error getting trending from DexScreener:', error.message);
      return [];
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

      const prices = {};

      // Primary: DexScreener API (more reliable)
      try {
        const addressesString = tokenAddresses.join(',');
        const dexResponse = await axios.get(
          `${this.dexScreenerAPI}/latest/dex/tokens/${addressesString}`
        );

        if (dexResponse.data.pairs && dexResponse.data.pairs.length > 0) {
          // Group pairs by token address
          const pairsByToken = {};
          dexResponse.data.pairs.forEach(pair => {
            const tokenAddress = pair.baseToken.address;
            if (!pairsByToken[tokenAddress]) {
              pairsByToken[tokenAddress] = [];
            }
            pairsByToken[tokenAddress].push(pair);
          });

          // Process each token
          for (const [tokenAddress, pairs] of Object.entries(pairsByToken)) {
            if (pairs.length > 0) {
              // Select best pair (highest liquidity)
              const bestPair = pairs.sort((a, b) => {
                const liquidityA = a.liquidity?.usd || 0;
                const liquidityB = b.liquidity?.usd || 0;
                return liquidityB - liquidityA;
              })[0];

              prices[tokenAddress] = {
                address: tokenAddress,
                price: parseFloat(bestPair.priceUsd || 0),
                marketCap: bestPair.marketCap,
                volume24h: bestPair.volume?.h24 || 0,
                priceChange: bestPair.priceChange?.h24 || 0,
                liquidity: bestPair.liquidity?.usd || 0,
                source: 'dexscreener',
                timestamp: Date.now()
              };
            }
          }
        }
      } catch (dexError) {
        console.warn('⚠️ DexScreener API error:', dexError.message);
      }

      // Fallback: Jupiter Price API for missing tokens
      const missingTokens = tokenAddresses.filter(addr => !prices[addr]);
      if (missingTokens.length > 0) {
        try {
          const jupiterResponse = await axios.get(
            `${this.jupiterAPI}/price?ids=${missingTokens.join(',')}`
          );

          for (const [address, data] of Object.entries(jupiterResponse.data.data || {})) {
            if (!prices[address]) {
              prices[address] = {
                address,
                price: data.price,
                source: 'jupiter',
                timestamp: Date.now()
              };
            }
          }
        } catch (jupError) {
          console.warn('⚠️ Jupiter API error:', jupError.message);
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

  // Get comprehensive Solana token list (verified addresses) + trending candidates
  getEstablishedTokens() {
    return [
      // Major Solana Ecosystem Tokens
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
        address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        name: 'Raydium',
        symbol: 'RAY'
      },
      {
        address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
        name: 'Orca',
        symbol: 'ORCA'
      },
      {
        address: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
        name: 'Serum',
        symbol: 'SRM'
      },
      {
        address: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
        name: 'Mango',
        symbol: 'MNGO'
      },

      // Stablecoins
      {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        name: 'USD Coin',
        symbol: 'USDC'
      },
      {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        name: 'Tether USD',
        symbol: 'USDT'
      },

      // Liquid Staking Tokens
      {
        address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
        name: 'Marinade Staked SOL',
        symbol: 'mSOL'
      },
      {
        address: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
        name: 'BlazeStake Staked SOL',
        symbol: 'bSOL'
      },
      {
        address: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
        name: 'Jito Staked SOL',
        symbol: 'JitoSOL'
      },
      {
        address: 'LSoLi4A4Pk4i8DPFYcfHziRdEbH9otvSJcSrkMVq99c',
        name: 'Lido Staked SOL',
        symbol: 'stSOL'
      },

      // Popular Meme Coins
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
        address: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump',
        name: 'Peanut the Squirrel',
        symbol: 'PNUT'
      },
      {
        address: '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump',
        name: 'Pepe',
        symbol: 'PEPE'
      },
      {
        address: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
        name: 'Bome',
        symbol: 'BOME'
      },
      {
        address: 'CATSs8pBhNrKGjGjdJHCfnKJKa1UJbJsJzrZHmWeump',
        name: 'Cat in a Dogs World',
        symbol: 'MEW'
      },
      {
        address: 'nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7',
        name: 'Nosana',
        symbol: 'NOS'
      },

      // Infrastructure & Utility Tokens
      {
        address: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC',
        name: 'Helium',
        symbol: 'HNT'
      },
      {
        address: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
        name: 'Helium Network Token',
        symbol: 'HNT'
      },
      {
        address: 'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y',
        name: 'Shadow Token',
        symbol: 'SHDW'
      },
      {
        address: 'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6',
        name: 'Kin',
        symbol: 'KIN'
      },
      {
        address: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT',
        name: 'Step Finance',
        symbol: 'STEP'
      },
      {
        address: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
        name: 'Render Token',
        symbol: 'RNDR'
      },

      // Gaming & NFT Tokens
      {
        address: 'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx',
        name: 'Star Atlas',
        symbol: 'ATLAS'
      },
      {
        address: 'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk',
        name: 'Star Atlas DAO',
        symbol: 'POLIS'
      },
      {
        address: 'SLCLww7nc1PD2gQPQdGayHviVVcpMthnqUz2iWKhNQV',
        name: 'Solice',
        symbol: 'SLC'
      },

      // DeFi Protocols
      {
        address: 'PoRTjZMPXb9T7dyU7tpLEZRQj7e6ssfAE62j2oQuc6y',
        name: 'Port Finance',
        symbol: 'PORT'
      },
      {
        address: 'CWE8jPTUYhdCTZYWPTe1o5DFqfdjzWKc9WKz6rSjQUdG',
        name: 'Cope',
        symbol: 'COPE'
      },
      {
        address: 'RLBxxFkseAZ4RgJH3Sqn8jXxhmGoz9jWxDNJMh8pL7a',
        name: 'Rollbit Coin',
        symbol: 'RLB'
      },

      // Newer Trending Tokens
      {
        address: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
        name: 'Cat in a Dogs World',
        symbol: 'MEW'
      },
      {
        address: 'JTO4BdwjNO6MLrpE7rhHXt6qzxgBZNEJQCBrVX5VNy3',
        name: 'Jito',
        symbol: 'JTO'
      },
      {
        address: 'WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk',
        name: 'Wen',
        symbol: 'WEN'
      },
      {
        address: 'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6',
        name: 'Tensor',
        symbol: 'TNSR'
      },
      {
        address: 'DRiP2Pn2K6fuMLKQmt5rZWxa4eaYXFfL1dUKBLiRhDzK',
        name: 'DRiP',
        symbol: 'DRIP'
      },

      // AI & Tech Tokens
      {
        address: 'GDfnEsia2WLAW5t8yx2X5j2mkfA74i5kwGdDuZHt7XmG',
        name: 'Goatseus Maximus',
        symbol: 'GOAT'
      },
      {
        address: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
        name: 'Book of Meme',
        symbol: 'BOME'
      },
      {
        address: 'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4',
        name: 'Myro',
        symbol: 'MYRO'
      },

      // Additional Popular Tokens
      {
        address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
        name: 'Orca',
        symbol: 'ORCA'
      },
      {
        address: 'SLNDpmoWTVADgEdndyvWzroNL7zSi1dF9PC3xHGtPwp',
        name: 'Solend',
        symbol: 'SLND'
      },
      {
        address: 'LFNTYraetVioAPnGJht4yNg2aUZFXR776cMeN9VMjXp',
        name: 'Lifinity',
        symbol: 'LFNTY'
      },
      {
        address: 'BLZEEuZUBVqFhj8adcCFPJvPVCiCyVmh3hkJMrU8KuJA',
        name: 'Blaze',
        symbol: 'BLZE'
      },
      {
        address: 'HxhWkVpk5NS4Ltg5nij2G671CKXFRKPK8vy271Ub4uEK',
        name: 'Hubble',
        symbol: 'HBB'
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
