// Utility function for safe notifications
function safeShowNotification(message, type = 'success') {
  if (typeof window.showNotification === 'function') {
    window.showNotification(message, type);
  } else if (typeof showNotification === 'function') {
    showNotification(message, type);
  } else {
    console.log(`Notification: ${message} (${type})`);
    alert(message);
  }
}

// Epic Tournament System for SolWars
class TournamentManager {
  constructor() {
    this.ws = null;
    this.currentTournament = null;
    this.activeTournaments = [];
    this.filteredTournaments = [];
    this.currentFilter = 'all';
    this.realTimePrices = {};
    this.userPortfolio = {};
    this.isConnected = false;

    this.initializePricePolling();
    this.loadTournaments();
    this.setupEventListeners();
    this.setupFilterListeners();
    this.loadTrendingTokens();
    this.initializeLiveMarket(); // This will load top traders
    this.startTimerUpdates();

    // Load user prizes when authenticated
    if (authState.isAuthenticated) {
      this.loadUserPrizes();
    }
  }

  // Initialize price polling for Vercel deployment (replaces WebSocket)
  initializePricePolling() {
    try {
      console.log('🔌 Starting price polling for real-time updates');

      // Poll prices every 5 seconds
      this.pricePollingInterval = setInterval(async () => {
        await this.fetchCurrentPrices();
      }, 5000);

      // Initial fetch
      this.fetchCurrentPrices();

      console.log('✅ Price polling initialized');
      this.isConnected = true;
      this.updateConnectionStatus(true);

    } catch (error) {
      console.error('❌ Failed to initialize price polling:', error);
      this.isConnected = false;
      this.updateConnectionStatus(false);
    }
  }

  // Fetch current prices from API
  async fetchCurrentPrices() {
    try {
      const response = await fetch('/api/prices/current');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.prices) {
        this.handlePriceUpdate(data);
      }

    } catch (error) {
      console.error('❌ Error fetching current prices:', error);
    }
  }

  // Stop price polling
  stopPricePolling() {
    if (this.pricePollingInterval) {
      clearInterval(this.pricePollingInterval);
      this.pricePollingInterval = null;
      console.log('🔌 Price polling stopped');
    }
  }

  // Initialize live market display
  initializeLiveMarket() {
    console.log('📊 Initializing live market display');

    // Show initial loading state
    const liveMarketList = document.getElementById('liveMarketList');
    if (liveMarketList) {
      console.log('✅ Found liveMarketList element');
      liveMarketList.innerHTML = `
        <div class="loading-state">
          <i class="fas fa-chart-line"></i>
          <p>Loading market data...</p>
        </div>
      `;
    } else {
      console.error('❌ liveMarketList element not found');
    }

    // Initialize and load top traders list
    this.loadTopTraders();

    // Update market display when prices are available
    if (Object.keys(this.realTimePrices).length > 0) {
      this.updateLiveMarketDisplay();
    }
  }

  // Handle WebSocket messages
  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'welcome':
        console.log('🎉 Welcome to SolWars real-time feed');
        break;

      case 'price_update':
        this.handlePriceUpdate(data.prices);
        break;

      case 'tournament_update':
        this.handleTournamentUpdate(data);
        break;

      case 'tournament_data':
        this.handleTournamentData(data);
        break;

      case 'trending_tokens':
        this.handleTrendingTokens(data);
        break;

      case 'pong':
        // Keep-alive response
        break;

      default:
        console.log('📡 Unknown message type:', data.type);
    }
  }

  // Handle real-time price updates
  handlePriceUpdate(data) {
    // Handle both old format (direct prices) and new format (data.prices)
    const prices = data.prices || data;

    if (prices && typeof prices === 'object') {
      // Update real-time prices cache
      for (const [tokenAddress, priceData] of Object.entries(prices)) {
        this.realTimePrices[tokenAddress] = {
          price: priceData.price,
          priceChange24h: priceData.priceChange24h,
          volume24h: priceData.volume24h,
          liquidity: priceData.liquidity,
          lastUpdated: Date.now()
        };
      }

      console.log(`💰 Updated prices for ${Object.keys(prices).length} tokens`);
      this.updatePriceDisplays();
      this.updatePortfolioValue();
    }
  }

  // Update price displays in trading interface
  updatePriceDisplays() {
    console.log(`🔄 Updating price displays for ${Object.keys(this.realTimePrices).length} tokens...`);

    for (const [tokenAddress, priceData] of Object.entries(this.realTimePrices)) {
      // Update main price display
      const priceElement = document.getElementById(`price-${tokenAddress}`);
      if (priceElement && priceData.price) {
        const oldPrice = parseFloat(priceElement.textContent.replace('$', '')) || 0;
        const newPrice = priceData.price;

        priceElement.textContent = `$${newPrice.toFixed(6)}`;

        // Add visual feedback for price changes
        if (oldPrice > 0 && oldPrice !== newPrice) {
          const changeClass = newPrice > oldPrice ? 'price-up' : 'price-down';
          priceElement.classList.add(changeClass);
          setTimeout(() => priceElement.classList.remove(changeClass), 1000);
          console.log(`💰 Price updated for ${tokenAddress}: $${oldPrice.toFixed(6)} → $${newPrice.toFixed(6)}`);
        }
      }

      // Update 24h price change display
      const change24hElement = document.getElementById(`change-24h-${tokenAddress}`);
      if (change24hElement && priceData.priceChange24h !== undefined) {
        const change = priceData.priceChange24h;
        const changeClass = change >= 0 ? 'positive' : 'negative';
        const changeIcon = change >= 0 ? '↗' : '↘';

        change24hElement.textContent = `24h: ${changeIcon} ${Math.abs(change).toFixed(2)}%`;
        change24hElement.className = `price-change ${changeClass}`;
      }

      // Update 6h price change display if available
      const change6hElement = document.getElementById(`change-6h-${tokenAddress}`);
      if (change6hElement && priceData.priceChange6h !== undefined) {
        const change6h = priceData.priceChange6h;
        const changeClass6h = change6h >= 0 ? 'positive' : 'negative';
        const changeIcon6h = change6h >= 0 ? '↗' : '↘';

        change6hElement.textContent = `6h: ${changeIcon6h} ${Math.abs(change6h).toFixed(2)}%`;
        change6hElement.className = `price-change-6h ${changeClass6h}`;
      }

      // Update volume and other stats if elements exist
      const volumeElement = document.querySelector(`[data-token-address="${tokenAddress}"] .stat-value`);
      if (volumeElement && priceData.volume24h !== undefined) {
        // Find the volume stat specifically
        const tokenCard = document.querySelector(`[data-token-address="${tokenAddress}"]`);
        if (tokenCard) {
          const volumeStat = Array.from(tokenCard.querySelectorAll('.stat')).find(stat =>
            stat.querySelector('.stat-label')?.textContent.includes('24h Volume')
          );
          if (volumeStat) {
            const volumeValue = volumeStat.querySelector('.stat-value');
            if (volumeValue) {
              volumeValue.textContent = this.formatNumber(priceData.volume24h || 0);
            }
          }
        }
      }
    }

    console.log(`✅ Price displays updated for ${Object.keys(this.realTimePrices).length} tokens`);
  }

  // Update portfolio value (placeholder for now)
  updatePortfolioValue() {
    // This will be called when prices update to recalculate portfolio values
    if (this.currentTournament && authState.isAuthenticated) {
      // Trigger portfolio reload if we're in a tournament
      this.loadUserPortfolio(this.currentTournament.id);
    }
  }

  // Load trending tokens for live market
  async loadTrendingTokens() {
    try {
      console.log('🔥 Loading trending tokens for live market...');

      const response = await fetch('/api/tokens/trending?limit=25');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const trendingTokens = await response.json();
      console.log(`✅ Loaded ${trendingTokens.length} trending tokens`);

      this.displayTrendingTokens(trendingTokens);

    } catch (error) {
      console.error('❌ Error loading trending tokens:', error);
      this.showLiveMarketError();
    }
  }

  // Display trending tokens in live market
  displayTrendingTokens(tokens) {
    const liveMarketList = document.getElementById('liveMarketList');
    if (!liveMarketList) return;

    if (!tokens || tokens.length === 0) {
      liveMarketList.innerHTML = `
        <div class="loading-state">
          <i class="fas fa-chart-line"></i>
          <p>No trending tokens available</p>
        </div>
      `;
      return;
    }

    // Sort by 24h volume (highest first)
    const sortedTokens = tokens
      .filter(token => token && token.symbol && token.price > 0)
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, 25); // Top 25 trending tokens

    liveMarketList.innerHTML = '';

    sortedTokens.forEach((token, index) => {
      const marketItem = document.createElement('div');
      marketItem.className = 'market-token-item';
      marketItem.setAttribute('data-token-address', token.address || token.tokenAddress);

      const priceChange = token.priceChange24h || 0;
      const priceChangeClass = priceChange >= 0 ? 'positive' : 'negative';
      const priceChangeIcon = priceChange >= 0 ? '↗' : '↘';
      const priceChangeText = `${priceChangeIcon} ${Math.abs(priceChange).toFixed(2)}%`;

      // Format price based on value
      let formattedPrice;
      if (token.price >= 1) {
        formattedPrice = `$${token.price.toFixed(4)}`;
      } else if (token.price >= 0.01) {
        formattedPrice = `$${token.price.toFixed(6)}`;
      } else {
        formattedPrice = `$${token.price.toExponential(2)}`;
      }

      marketItem.innerHTML = `
        <div class="market-token-info">
          <div class="token-rank">#${index + 1}</div>
          <div class="token-details">
            <div class="token-symbol">${token.symbol}</div>
            <div class="token-price">${formattedPrice}</div>
          </div>
        </div>
        <div class="market-token-stats">
          <div class="token-change ${priceChangeClass}">${priceChangeText}</div>
          <div class="token-volume">Vol: $${this.formatNumber(token.volume24h || 0)}</div>
        </div>
      `;

      // Add click handler to show token details
      marketItem.addEventListener('click', () => {
        this.showTokenDetails(token);
      });

      liveMarketList.appendChild(marketItem);
    });

    console.log(`📊 Displayed ${sortedTokens.length} trending tokens in live market`);
  }

  // Show error state in live market
  showLiveMarketError() {
    const liveMarketList = document.getElementById('liveMarketList');
    if (liveMarketList) {
      liveMarketList.innerHTML = `
        <div class="loading-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Unable to load market data</p>
          <button class="btn btn-small" onclick="tournamentManager.loadTrendingTokens()">
            <i class="fas fa-refresh"></i> Retry
          </button>
        </div>
      `;
    }
  }

  // Update live market display with real-time data
  updateLiveMarketDisplay() {
    const liveMarketList = document.getElementById('liveMarketList');
    if (!liveMarketList) return;

    // Get all available tokens from real-time prices
    const marketTokens = Object.entries(this.realTimePrices)
      .map(([address, priceData]) => {
        // Try to get token metadata from current tournament or create basic info
        let tokenInfo = { address, symbol: 'UNKNOWN', name: 'Unknown Token' };

        if (this.currentTournament && this.currentTournament.selectedTokens) {
          const tournamentToken = this.currentTournament.selectedTokens.find(t => t.address === address);
          if (tournamentToken) {
            tokenInfo = tournamentToken;
          }
        }

        return {
          ...tokenInfo,
          ...priceData,
          address
        };
      })
      .sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h)); // Sort by biggest price changes

    if (marketTokens.length === 0) {
      liveMarketList.innerHTML = `
        <div class="loading-state">
          <i class="fas fa-chart-line"></i>
          <p>Waiting for market data...</p>
        </div>
      `;
      return;
    }

    // Create market items
    liveMarketList.innerHTML = '';

    marketTokens.slice(0, 8).forEach(token => { // Show top 8 tokens
      const marketItem = document.createElement('div');
      marketItem.className = 'market-token-item';
      marketItem.setAttribute('data-token-address', token.address);

      const priceChangeClass = token.priceChange24h >= 0 ? 'positive' : 'negative';
      const priceChangeIcon = token.priceChange24h >= 0 ? '↗' : '↘';
      const priceChangeText = `${priceChangeIcon} ${Math.abs(token.priceChange24h).toFixed(2)}%`;

      marketItem.innerHTML = `
        <div class="market-token-info">
          <div class="token-symbol">${token.symbol}</div>
          <div class="token-price">$${token.price.toFixed(6)}</div>
        </div>
        <div class="market-token-stats">
          <div class="token-change ${priceChangeClass}">${priceChangeText}</div>
          <div class="token-volume">Vol: $${this.formatNumber(token.volume24h)}</div>
        </div>
      `;

      // Add click handler to show token details
      marketItem.addEventListener('click', () => {
        this.showTokenDetails(token);
      });

      liveMarketList.appendChild(marketItem);
    });

    console.log(`📊 Updated live market with ${marketTokens.length} tokens`);
  }

  // Format large numbers for display
  formatNumber(num) {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(1) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(1) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  }

  // Show token details modal
  showTokenDetails(token) {
    console.log(`📊 Showing details for token: ${token.symbol}`);

    // Create or get existing modal
    let modal = document.getElementById('tokenDetailsModal');
    if (!modal) {
      modal = this.createTokenDetailsModal();
    }

    // Update modal content
    const modalContent = modal.querySelector('#tokenDetailsContent');
    const priceChangeClass = token.priceChange24h >= 0 ? 'positive' : 'negative';
    const priceChangeIcon = token.priceChange24h >= 0 ? '↗' : '↘';

    modalContent.innerHTML = `
      <div class="token-details-header">
        <div class="token-details-title">
          <h3>${token.name || token.symbol}</h3>
          <span class="token-details-symbol">${token.symbol}</span>
        </div>
        <div class="token-details-price">
          <div class="current-price">$${token.price.toFixed(6)}</div>
          <div class="price-change ${priceChangeClass}">
            ${priceChangeIcon} ${Math.abs(token.priceChange24h).toFixed(2)}% (24h)
          </div>
        </div>
      </div>

      <div class="token-details-stats">
        <div class="stat-row">
          <span class="stat-label">24h Volume:</span>
          <span class="stat-value">$${this.formatNumber(token.volume24h)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Liquidity:</span>
          <span class="stat-value">$${this.formatNumber(token.liquidity)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Last Updated:</span>
          <span class="stat-value">${new Date(token.lastUpdated).toLocaleTimeString()}</span>
        </div>
      </div>

      <div class="token-details-actions">
        <button class="btn btn-secondary" onclick="closeTokenDetailsModal()">Close</button>
        ${this.currentTournament ? `
          <button class="btn btn-primary" onclick="tournamentManager.quickTradeToken('${token.address}')">
            <i class="fas fa-bolt"></i> Quick Trade
          </button>
        ` : ''}
      </div>
    `;

    modal.classList.add('active');
  }

  // Create token details modal
  createTokenDetailsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'tokenDetailsModal';
    modal.innerHTML = `
      <div class="modal">
        <button class="close-modal" onclick="closeTokenDetailsModal()">&times;</button>
        <h2>Token Details</h2>
        <div id="tokenDetailsContent">
          <!-- Content will be populated dynamically -->
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  // Quick trade functionality
  quickTradeToken(tokenAddress) {
    if (!this.currentTournament) {
      showNotification('Please join a tournament to trade', 'warning');
      return;
    }

    // Close token details modal
    const modal = document.getElementById('tokenDetailsModal');
    if (modal) {
      modal.classList.remove('active');
    }

    // Scroll to trading interface if not visible
    const tradingPanel = document.querySelector('.trading-panel');
    if (tradingPanel) {
      tradingPanel.scrollIntoView({ behavior: 'smooth' });
    }

    // Highlight the specific token card
    setTimeout(() => {
      const tokenCard = document.querySelector(`[data-token-address="${tokenAddress}"]`);
      if (tokenCard) {
        tokenCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tokenCard.classList.add('highlight-token');
        setTimeout(() => tokenCard.classList.remove('highlight-token'), 3000);
      }
    }, 500);

    showNotification(`Navigate to ${this.getTokenSymbol(tokenAddress)} trading card below`, 'info');
  }

  // Get token symbol by address
  getTokenSymbol(address) {
    if (this.currentTournament && this.currentTournament.selectedTokens) {
      const token = this.currentTournament.selectedTokens.find(t => t.address === address);
      return token ? token.symbol : 'Token';
    }
    return 'Token';
  }

  // Start live timer updates
  startTimerUpdates() {
    // Update timers every second
    this.timerInterval = setInterval(() => {
      this.updateAllTimers();
    }, 1000);
    console.log('⏰ Started live timer updates');
  }

  // Stop timer updates
  stopTimerUpdates() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      console.log('⏰ Stopped timer updates');
    }
  }

  // Update all tournament timers
  updateAllTimers() {
    const tournamentCards = document.querySelectorAll('.tournament-card');
    tournamentCards.forEach(card => {
      const tournamentId = card.getAttribute('data-tournament-id');
      const tournament = this.activeTournaments.find(t => t.id === tournamentId);

      if (tournament) {
        this.updateTournamentTimer(card, tournament);
      }
    });

    // Update current tournament timer if in one
    if (this.currentTournament) {
      this.updateCurrentTournamentTimer();
    }
  }

  // Update individual tournament timer
  updateTournamentTimer(card, tournament) {
    const timerElement = card.querySelector('.tournament-timer');
    if (!timerElement) return;

    const now = Date.now();
    const startTime = new Date(tournament.startTime).getTime();
    const endTime = new Date(tournament.endTime).getTime();

    let timeText = '';
    let statusClass = '';

    if (now < startTime) {
      // Tournament hasn't started yet
      const timeUntilStart = startTime - now;
      timeText = `Starts in ${this.formatTimeRemaining(timeUntilStart)}`;
      statusClass = 'upcoming';
    } else if (now >= startTime && now < endTime) {
      // Tournament is active
      const timeUntilEnd = endTime - now;
      timeText = `${this.formatTimeRemaining(timeUntilEnd)} remaining`;
      statusClass = 'active';
    } else {
      // Tournament has ended
      timeText = 'Tournament ended';
      statusClass = 'ended';
    }

    timerElement.textContent = timeText;
    timerElement.className = `tournament-timer ${statusClass}`;
  }

  // Update current tournament timer in trading interface
  updateCurrentTournamentTimer() {
    const timerElement = document.getElementById('tournamentTimer');
    if (!timerElement) return;

    const now = Date.now();
    const endTime = new Date(this.currentTournament.endTime).getTime();

    if (now < endTime) {
      const timeRemaining = endTime - now;
      timerElement.textContent = this.formatTimeRemaining(timeRemaining);
      timerElement.className = 'tournament-timer active';
    } else {
      timerElement.textContent = 'Tournament ended';
      timerElement.className = 'tournament-timer ended';
      // Optionally show tournament results
      this.showTournamentResults();
    }
  }

  // Format time remaining in human-readable format
  formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return '0s';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Show tournament results when ended
  showTournamentResults() {
    if (this.tournamentResultsShown) return;
    this.tournamentResultsShown = true;

    showNotification('Tournament has ended! Check the leaderboard for final results.', 'info');

    // Optionally redirect to results page or show modal
    setTimeout(() => {
      this.showTournamentLeaderboard();
    }, 2000);
  }

  // Handle tournament updates
  handleTournamentUpdate(data) {
    if (this.currentTournament && this.currentTournament.id === data.tournamentId) {
      this.updateLeaderboard(data.leaderboard);
    }
  }

  // Handle tournament data
  handleTournamentData(data) {
    this.currentTournament = data.tournament;
    this.updateTournamentDisplay();
    this.updateLeaderboard(data.leaderboard);

    // Subscribe to token price updates
    if (data.tournament.selectedTokens) {
      data.tournament.selectedTokens.forEach(token => {
        this.subscribeToToken(token.address);
      });
    }
  }

  // Handle trending tokens from WebSocket
  handleTrendingTokens(data) {
    console.log(`🔥 Received ${data.tokens?.length || 0} trending tokens via WebSocket`);

    if (data.tokens && Array.isArray(data.tokens)) {
      // Store trending tokens with timestamp
      this.trendingTokens = data.tokens.map(token => ({
        ...token,
        receivedAt: Date.now(),
        isFromWebSocket: true
      }));

      console.log(`✅ Stored ${this.trendingTokens.length} trending tokens:`,
        this.trendingTokens.map(t => `${t.symbol} ($${t.price?.toFixed(4) || 'N/A'})`).join(', '));

      // Update any active token displays
      this.updateTrendingTokenDisplays();
    }
  }

  // Subscribe to tournament updates
  subscribeToTournament(tournamentId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe_tournament',
        tournamentId
      }));
    }
  }

  // Subscribe to token price updates
  subscribeToToken(tokenAddress) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe_token',
        tokenAddress
      }));
    }
  }

  // Subscribe to trending tokens
  subscribeToTrendingTokens() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe_trending'
      }));
      console.log('📡 Subscribed to trending tokens WebSocket feed');
    }
  }

  // Update trending token displays
  updateTrendingTokenDisplays() {
    // Update any visible trending token lists or displays
    const trendingContainer = document.getElementById('trendingTokensContainer');
    if (trendingContainer && this.trendingTokens) {
      // Update trending tokens display if visible
      this.displayTrendingTokens(trendingContainer);
    }
  }

  // Load active tournaments with enhanced scheduling
  async loadTournaments() {
    try {
      console.log('🏆 Loading tournaments with continuous availability...');
      const response = await fetch('/api/tournaments');
      const data = await response.json();

      // Handle enhanced tournament API response
      let tournaments;
      let categories = {};
      let stats = {};

      console.log('🔍 Raw API response:', data);

      if (Array.isArray(data)) {
        // Legacy format - just tournaments array
        tournaments = data;
        console.log('📊 Using legacy format with', tournaments.length, 'tournaments');
      } else if (data.tournaments) {
        // Enhanced format with categories and stats
        tournaments = data.tournaments;
        categories = data.categories || {};
        stats = data.stats || {};

        console.log('📊 Tournament stats:', stats);
        console.log('📂 Tournament categories:', {
          active: categories.active?.length || 0,
          upcoming: categories.upcoming?.length || 0,
          joinable: categories.joinable?.length || 0
        });
        console.log('🎯 Using enhanced format with', tournaments.length, 'tournaments');
      } else {
        console.error('❌ Invalid response format:', data);
        throw new Error('Invalid response format');
      }

      // Validate tournaments array
      if (!Array.isArray(tournaments)) {
        console.error('❌ Tournaments is not an array:', tournaments);
        throw new Error('Tournaments data is not an array');
      }

      this.activeTournaments = tournaments;
      this.tournamentCategories = categories;
      this.tournamentStats = stats;

      // Update tournament availability indicator
      this.updateTournamentAvailabilityIndicator(stats);

      // If showing my tournaments, also load user tournaments
      if (this.currentFilter === 'my-tournaments' && authState.isAuthenticated) {
        await this.loadUserTournaments();
      } else {
        // Apply current filter
        this.filterTournaments();
        this.displayTournaments();
      }

      console.log(`✅ Loaded ${tournaments.length} tournaments (${stats.active || 0} active, ${stats.upcoming || 0} upcoming)`);

      // Show availability notification if needed
      if (stats.joinable === 0) {
        console.log('⚠️ No joinable tournaments available, triggering emergency creation...');
        this.triggerEmergencyTournamentCreation();
      }

    } catch (error) {
      console.error('❌ Error loading tournaments:', error);
      showNotification('Failed to load tournaments', 'error');

      // Initialize as empty array to prevent iteration errors
      this.activeTournaments = [];
      this.displayTournaments();
    }
  }

  // Load user's tournaments
  async loadUserTournaments() {
    try {
      if (!authState.isAuthenticated || !authState.walletAddress) {
        console.log('❌ User not authenticated, cannot load user tournaments');
        return;
      }

      console.log(`🏆 Loading tournaments for user: ${authState.walletAddress}`);
      const response = await fetch(`/api/tournaments/user/${authState.walletAddress}`);
      const userTournaments = await response.json();

      // Store user tournaments separately and display them
      this.userTournaments = userTournaments;
      this.filteredTournaments = userTournaments;
      this.displayTournaments();

      console.log(`✅ Loaded ${userTournaments.length} user tournaments`);
    } catch (error) {
      console.error('❌ Error loading user tournaments:', error);
      showNotification('Failed to load your tournaments', 'error');
    }
  }

  // Setup filter event listeners
  setupFilterListeners() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = e.target.getAttribute('data-filter');
        this.setFilter(filter);
      });
    });
  }

  // Set tournament filter
  setFilter(filter) {
    this.currentFilter = filter;

    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

    // Handle my-tournaments filter specially
    if (filter === 'my-tournaments') {
      if (authState.isAuthenticated) {
        this.loadUserTournaments();
      } else {
        showNotification('Please connect your wallet to view your tournaments', 'warning');
        this.setFilter('all');
      }
    } else {
      // Filter tournaments
      this.filterTournaments();
      // Display filtered tournaments
      this.displayTournaments();
    }
  }

  // Filter tournaments based on current filter
  filterTournaments() {
    // Ensure activeTournaments is always an array
    if (!Array.isArray(this.activeTournaments)) {
      console.warn('⚠️ activeTournaments is not an array, initializing as empty array');
      this.activeTournaments = [];
    }

    console.log(`🔍 Filtering ${this.activeTournaments.length} tournaments with filter: ${this.currentFilter}`);
    console.log('🎯 Available tournaments:', this.activeTournaments.map(t => `${t.name} (${t.type}, ${t.status})`));

    if (this.currentFilter === 'all') {
      this.filteredTournaments = [...this.activeTournaments];
    } else if (this.currentFilter === 'my-tournaments') {
      // Show only tournaments the user has joined
      this.filteredTournaments = this.activeTournaments.filter(tournament =>
        tournament.participants && tournament.participants.some(p =>
          p.walletAddress === authState.walletAddress
        )
      );
    } else {
      this.filteredTournaments = this.activeTournaments.filter(tournament =>
        tournament.type.toLowerCase() === this.currentFilter.toLowerCase()
      );
    }

    console.log(`✅ Filtered to ${this.filteredTournaments.length} tournaments`);
    console.log('🎯 Filtered tournaments:', this.filteredTournaments.map(t => `${t.name} (${t.type})`));
  }

  // Show/hide My Tournaments button based on authentication
  updateMyTournamentsButton() {
    const myTournamentsBtn = document.getElementById('myTournamentsBtn');
    if (myTournamentsBtn) {
      if (authState.isAuthenticated) {
        myTournamentsBtn.style.display = 'block';
      } else {
        myTournamentsBtn.style.display = 'none';
        // If currently showing my tournaments, switch to all
        if (this.currentFilter === 'my-tournaments') {
          this.setFilter('all');
        }
      }
    }
  }

  // Display tournaments in the UI
  displayTournaments() {
    const container = document.getElementById('tournamentsContainer');
    if (!container) {
      console.error('❌ Tournament container not found!');
      return;
    }

    container.innerHTML = '';

    // Use filtered tournaments for display
    const tournamentsToShow = this.filteredTournaments;

    console.log(`🎮 Displaying ${tournamentsToShow.length} tournaments (filter: ${this.currentFilter})`);
    console.log('🎯 Tournaments to show:', tournamentsToShow.map(t => `${t.name} (${t.status}, joinable: ${t.isJoinable})`));

    if (tournamentsToShow.length === 0) {
      const filterText = this.currentFilter === 'all' ? 'tournaments' : `${this.currentFilter} tournaments`;
      console.log(`⚠️ No tournaments to display for filter: ${this.currentFilter}`);
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-trophy" style="font-size: 48px; color: var(--primary); margin-bottom: 20px;"></i>
          <h3>No Active ${this.currentFilter === 'all' ? 'Tournaments' : this.currentFilter.charAt(0).toUpperCase() + this.currentFilter.slice(1) + ' Tournaments'}</h3>
          <p>Check back soon for epic trading battles!</p>
          <button class="btn btn-primary" onclick="tournamentManager.loadTournaments()">
            <i class="fas fa-sync-alt"></i> Refresh Tournaments
          </button>
        </div>
      `;
      return;
    }

    tournamentsToShow.forEach((tournament, index) => {
      console.log(`🏗️ Creating card ${index + 1}: ${tournament.name}`);
      try {
        const tournamentCard = this.createTournamentCard(tournament);
        container.appendChild(tournamentCard);
        console.log(`✅ Card ${index + 1} created successfully`);
      } catch (error) {
        console.error(`❌ Error creating card ${index + 1}:`, error);
      }
    });

    console.log(`✅ Successfully displayed ${tournamentsToShow.length} tournament cards`);
  }

  // Create tournament card element
  createTournamentCard(tournament) {
    const card = document.createElement('div');
    card.className = 'tournament-card';
    card.setAttribute('data-tournament-id', tournament.id);

    const timeUntilStart = tournament.timeUntilStart > 0 ?
      this.formatTimeRemaining(tournament.timeUntilStart) : 'LIVE';

    const timeUntilEnd = tournament.timeUntilEnd > 0 ?
      this.formatTimeRemaining(tournament.timeUntilEnd) : 'ENDED';

    const statusClass = tournament.status.toLowerCase();
    const statusText = tournament.status === 'ACTIVE' ? 'LIVE' : tournament.status;

    card.innerHTML = `
      <div class="tournament-header">
        <div class="tournament-status ${statusClass}">${statusText}</div>
        <div class="tournament-type">${tournament.type}</div>
      </div>

      <h3 class="tournament-name">${tournament.name}</h3>
      <p class="tournament-description">${tournament.description || 'Epic trading battle with real Solana tokens!'}</p>

      <div class="tournament-stats">
        <div class="stat">
          <span class="stat-label">Participants</span>
          <span class="stat-value">${tournament.participantCount}/${tournament.maxParticipants}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Prize Pool</span>
          <span class="stat-value">${tournament.prizePoolSol.toFixed(3)} SOL</span>
        </div>
        <div class="stat">
          <span class="stat-label">Bonus Jackpot</span>
          <span class="stat-value">${tournament.bonusJackpot.toFixed(0)} SWARS</span>
        </div>
      </div>

      <div class="prize-breakdown">
        <div class="prize-breakdown-header">
          <i class="fas fa-trophy"></i>
          <span>Prize Breakdown</span>
          <button class="prize-details-btn" onclick="tournamentManager.showPrizeDetails('${tournament.id}')">
            <i class="fas fa-info-circle"></i>
          </button>
        </div>
        <div class="prize-tiers">
          <div class="prize-tier first-place">
            <span class="tier-label">🥇 1st</span>
            <span class="tier-amount">${(tournament.prizePoolSol * 0.5).toFixed(3)} SOL</span>
          </div>
          <div class="prize-tier second-place">
            <span class="tier-label">🥈 2nd</span>
            <span class="tier-amount">${(tournament.prizePoolSol * 0.3).toFixed(3)} SOL</span>
          </div>
          <div class="prize-tier third-place">
            <span class="tier-label">🥉 3rd</span>
            <span class="tier-amount">${(tournament.prizePoolSol * 0.2).toFixed(3)} SOL</span>
          </div>
        </div>
      </div>

      <div class="tournament-timing">
        <div class="time-info">
          <span class="time-label">${tournament.status === 'ACTIVE' ? 'Ends in' : 'Starts in'}</span>
          <span class="time-value">${tournament.status === 'ACTIVE' ? timeUntilEnd : timeUntilStart}</span>
        </div>
        <div class="tournament-timer upcoming">
          Loading timer...
        </div>
      </div>

      <div class="entry-options">
        ${this.currentFilter === 'my-tournaments' && tournament.userParticipant ? `
          <div class="user-tournament-info">
            <div class="user-stats-grid">
              <div class="user-stat">
                <span class="stat-label">Your Rank</span>
                <span class="stat-value rank-${tournament.userParticipant.rank <= 3 ? 'top' : 'normal'}">#${tournament.userParticipant.rank}</span>
              </div>
              <div class="user-stat">
                <span class="stat-label">Portfolio</span>
                <span class="stat-value">$${tournament.userParticipant.currentBalance.toFixed(2)}</span>
              </div>
              <div class="user-stat">
                <span class="stat-label">Profit/Loss</span>
                <span class="stat-value ${tournament.userParticipant.profit >= 0 ? 'positive' : 'negative'}">
                  ${tournament.userParticipant.profit >= 0 ? '+' : ''}$${tournament.userParticipant.profit.toFixed(2)}
                </span>
              </div>
            </div>
            <button class="btn btn-primary resume-tournament-btn" onclick="tournamentManager.showTournamentInterface('${tournament.id}')">
              <i class="fas fa-play"></i> Resume Trading
            </button>
          </div>
        ` : `
          <div class="entry-option">
            <span class="entry-label">SOL Entry</span>
            <span class="entry-fee">${tournament.entryFeeSol} SOL</span>
            <button class="btn btn-primary join-btn" data-entry-type="SOL">
              Join with SOL
            </button>
          </div>
          <div class="entry-option bonus">
            <span class="entry-label">SWARS Entry</span>
            <span class="entry-fee">${tournament.entryFeeSwars} SWARS</span>
            <button class="btn btn-accent join-btn" data-entry-type="SWARS">
              Join for Bonus Jackpot!
            </button>
          </div>
        `}
      </div>

      <div class="tournament-tokens">
        <span class="tokens-label">Trading Tokens:</span>
        <div class="token-list">
          ${tournament.selectedTokens.map(token => `
            <div class="token-chip">
              ${token.image || token.icon ?
                `<img src="${token.image || token.icon}" alt="${token.symbol}" class="token-icon" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <div class="token-initials" style="display: none;">${(token.symbol || '?').substring(0, 2).toUpperCase()}</div>` :
                `<div class="token-initials">${(token.symbol || '?').substring(0, 2).toUpperCase()}</div>`
              }
              <span class="token-symbol">${token.symbol}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Add event listeners for join buttons
    const joinButtons = card.querySelectorAll('.join-btn');
    joinButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const entryType = btn.getAttribute('data-entry-type');
        console.log(`🎯 Join button clicked: ${entryType} for tournament ${tournament.id}`);

        try {
          this.showJoinTournamentModal(tournament, entryType);
        } catch (error) {
          console.error('❌ Error showing join modal:', error);
          safeShowNotification('Error opening join modal', 'error');
        }
      });
    });

    // Add click listener for tournament details
    card.addEventListener('click', (e) => {
      if (!e.target.classList.contains('join-btn')) {
        this.showTournamentDetails(tournament.id);
      }
    });

    return card;
  }

  // Show join tournament modal
  showJoinTournamentModal(tournament, entryType) {
    console.log(`🎯 showJoinTournamentModal called: ${tournament.name}, ${entryType}`);
    console.log('Auth state:', authState.isAuthenticated);

    if (!authState.isAuthenticated) {
      console.log('❌ User not authenticated');
      safeShowNotification('Please connect your wallet first!', 'error');
      return;
    }

    // Get the existing modal from HTML
    let modal = document.getElementById('joinTournamentModal');
    console.log('Existing modal:', modal);

    if (!modal) {
      console.log('❌ Modal not found in DOM! This should not happen.');
      return;
    }

    // Update modal content
    const modalContent = modal.querySelector('#joinTournamentContent');
    console.log('Modal content element:', modalContent);

    const entryFee = entryType === 'SOL' ? tournament.entryFeeSol : tournament.entryFeeSwars;
    const bonusText = entryType === 'SWARS' ?
      `<div class="bonus-highlight">🎰 Eligible for ${tournament.bonusJackpot.toFixed(0)} SWARS bonus jackpot!</div>` : '';

    modalContent.innerHTML = `
      <div class="join-tournament-info">
        <h3>${tournament.name}</h3>
        <div class="tournament-entry-details">
          <div class="entry-detail">
            <span class="detail-label">Entry Fee:</span>
            <span class="detail-value">${entryFee} ${entryType}</span>
          </div>
          <div class="entry-detail">
            <span class="detail-label">Prize Pool:</span>
            <span class="detail-value">${tournament.prizePoolSol.toFixed(3)} SOL</span>
          </div>
          <div class="entry-detail">
            <span class="detail-label">Duration:</span>
            <span class="detail-value">${this.formatTimeRemaining(tournament.timeUntilEnd)}</span>
          </div>
          <div class="entry-detail">
            <span class="detail-label">Participants:</span>
            <span class="detail-value">${tournament.participantCount}/${tournament.maxParticipants}</span>
          </div>
        </div>

        <div class="prize-preview">
          <h4><i class="fas fa-trophy"></i> Prize Breakdown</h4>
          <div class="prize-preview-grid">
            <div class="prize-preview-item first">
              <span class="prize-rank">🥇 1st Place</span>
              <span class="prize-amount">${(tournament.prizePoolSol * 0.5).toFixed(3)} SOL</span>
              <span class="prize-percentage">50%</span>
            </div>
            <div class="prize-preview-item second">
              <span class="prize-rank">🥈 2nd Place</span>
              <span class="prize-amount">${(tournament.prizePoolSol * 0.3).toFixed(3)} SOL</span>
              <span class="prize-percentage">30%</span>
            </div>
            <div class="prize-preview-item third">
              <span class="prize-rank">🥉 3rd Place</span>
              <span class="prize-amount">${(tournament.prizePoolSol * 0.2).toFixed(3)} SOL</span>
              <span class="prize-percentage">20%</span>
            </div>
          </div>
          <div class="prize-note">
            <i class="fas fa-info-circle"></i>
            <span>Prize pool grows as more participants join! ${tournament.bonusJackpot > 0 ? 'SWARS entries get bonus jackpot rewards.' : ''}</span>
          </div>
        </div>

        ${bonusText}

        <div class="tournament-tokens-preview">
          <h4>Trading Tokens:</h4>
          <div class="token-preview-grid">
            ${tournament.selectedTokens.map(token => `
              <div class="token-preview-card">
                ${token.icon || token.image ?
                  `<img src="${token.icon || token.image}" alt="${token.symbol}" class="token-preview-icon"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="token-preview-initials" style="display: none;">${(token.symbol || '?').substring(0, 2).toUpperCase()}</div>` :
                  `<div class="token-preview-initials">${(token.symbol || '?').substring(0, 2).toUpperCase()}</div>`
                }
                <div class="token-preview-info">
                  <span class="token-preview-symbol">${token.symbol}</span>
                  <span class="token-preview-price">$${token.price?.toFixed(6) || '0.000000'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeJoinTournamentModal()">Cancel</button>
          <button class="btn btn-primary confirm-join-btn" onclick="tournamentManager.processPaymentAndJoin('${tournament.id}', '${entryType}', ${entryFee})">
            Pay ${entryFee} ${entryType} & Join
          </button>
        </div>
      </div>
    `;

    console.log('Adding active class to modal...');
    modal.classList.add('active');
    console.log('Modal classes after adding active:', modal.className);
    console.log('✅ Modal should now be visible');
  }

  // Create join tournament modal
  createJoinTournamentModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'joinTournamentModal';
    modal.innerHTML = `
      <div class="modal">
        <button class="close-modal" onclick="closeJoinTournamentModal()">&times;</button>
        <h2>Join Tournament</h2>
        <div id="joinTournamentContent">
          <!-- Content will be populated dynamically -->
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  // Process payment and join tournament
  async processPaymentAndJoin(tournamentId, entryType, entryFee) {
    try {
      console.log(`💳 Processing ${entryType} payment of ${entryFee} for tournament ${tournamentId}`);

      // Show loading state
      const confirmBtn = document.querySelector('.confirm-join-btn');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Payment...';
      }

      // Process payment based on entry type
      let paymentResult;
      if (entryType === 'SOL') {
        paymentResult = await this.processSolPayment(entryFee);
      } else if (entryType === 'SWARS') {
        paymentResult = await this.processSwarsPayment(entryFee);
      } else {
        throw new Error('Invalid entry type');
      }

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment failed');
      }

      // Payment successful, now join the tournament
      await this.joinTournament(tournamentId, entryType, paymentResult.transactionId);

    } catch (error) {
      console.error('❌ Error processing payment:', error);
      showNotification(error.message || 'Payment failed', 'error');

      // Reset button state
      const confirmBtn = document.querySelector('.confirm-join-btn');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `Pay ${entryFee} ${entryType} & Join`;
      }
    }
  }

  // Process SOL payment
  async processSolPayment(amount) {
    try {
      if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Phantom wallet not found');
      }

      console.log(`💰 Processing SOL payment of ${amount} SOL on Solana mainnet`);

      // Import Solana web3 library
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = window.solanaWeb3;

      // Get RPC endpoint from server (Helius or fallback)
      let rpcEndpoint;
      try {
        console.log('🌐 Fetching RPC endpoint from server...');
        const rpcResponse = await fetch('/api/payment/rpc');

        if (!rpcResponse.ok) {
          throw new Error(`RPC endpoint returned ${rpcResponse.status}: ${rpcResponse.statusText}`);
        }

        const rpcData = await rpcResponse.json();
        rpcEndpoint = rpcData.rpcEndpoint;
        console.log(`✅ RPC endpoint received: ${rpcEndpoint.substring(0, 50)}...`);
      } catch (error) {
        console.error('❌ Error fetching RPC endpoint:', error);
        // Use fallback RPC endpoint - REPLACE WITH YOUR HELIUS RPC URL
        rpcEndpoint = 'https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY_HERE';
        console.log(`🔄 Using fallback RPC: ${rpcEndpoint.substring(0, 50)}...`);
      }

      // Connect to Solana mainnet using Helius RPC
      const connection = new Connection(rpcEndpoint, 'confirmed');

      // Get treasury wallet from server
      let treasuryAddress;
      try {
        console.log('🔍 Fetching treasury wallet from server...');
        const treasuryResponse = await fetch('/api/payment/treasury');

        if (!treasuryResponse.ok) {
          throw new Error(`Treasury endpoint returned ${treasuryResponse.status}: ${treasuryResponse.statusText}`);
        }

        const treasuryData = await treasuryResponse.json();
        treasuryAddress = treasuryData.treasuryWallet;
        console.log(`✅ Treasury wallet received: ${treasuryAddress}`);
      } catch (error) {
        console.error('❌ Error fetching treasury wallet:', error);
        // Use fallback treasury address
        treasuryAddress = 'So11111111111111111111111111111111111111112';
        console.log(`🔄 Using fallback treasury: ${treasuryAddress}`);
      }

      const treasuryWallet = new PublicKey(treasuryAddress);
      console.log(`💰 Sending payment to treasury: ${treasuryAddress}`);

      // Get user's wallet public key
      const fromPubkey = new PublicKey(authState.walletAddress);

      // Check user's SOL balance first
      const balance = await connection.getBalance(fromPubkey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;
      const requiredAmount = amount + 0.001; // Add small buffer for transaction fees

      if (balanceInSol < requiredAmount) {
        throw new Error(`Insufficient SOL balance. You have ${balanceInSol.toFixed(4)} SOL but need ${requiredAmount.toFixed(4)} SOL (including fees).`);
      }

      console.log(`✅ Balance check passed: ${balanceInSol.toFixed(4)} SOL available`);

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: treasuryWallet,
          lamports: amount * LAMPORTS_PER_SOL,
        })
      );

      // Get recent blockhash
      const { blockhash } = await connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Sign and send transaction
      const signedTransaction = await window.solana.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());

      // Wait for confirmation
      await connection.confirmTransaction(signature);

      console.log('✅ SOL payment successful:', signature);
      safeShowNotification(`Payment of ${amount} SOL successful!`, 'success');

      return {
        success: true,
        transactionId: signature,
        amount,
        currency: 'SOL'
      };

    } catch (error) {
      console.error('❌ SOL payment failed:', error);

      // Handle specific mainnet errors
      if (error.message.includes('insufficient funds') || error.message.includes('Attempt to debit an account')) {
        throw new Error(`Insufficient SOL balance. You need at least ${amount} SOL plus transaction fees.`);
      }

      if (error.message.includes('Transaction simulation failed')) {
        throw new Error('Transaction failed. Please check your SOL balance and try again.');
      }

      if (error.message.includes('User rejected')) {
        throw new Error('Transaction was cancelled by user.');
      }

      // For demo purposes when Web3 is not available, allow payment to proceed
      if (error.message.includes('Phantom') || error.message.includes('solanaWeb3') || error.message.includes('Cannot read properties')) {
        console.log('🎮 Demo mode: Simulating SOL payment');
        safeShowNotification(`Demo: SOL payment of ${amount} SOL simulated`, 'info');
        return {
          success: true,
          transactionId: 'demo_sol_' + Date.now(),
          amount,
          currency: 'SOL'
        };
      }

      throw error;
    }
  }

  // Process SWARS payment
  async processSwarsPayment(amount) {
    try {
      console.log(`💎 Processing SWARS payment of ${amount} SWARS`);

      // Check if user has enough SWARS balance
      if (authState.swarsBalance < amount) {
        throw new Error(`Insufficient SWARS balance. You have ${authState.swarsBalance} SWARS, need ${amount} SWARS`);
      }

      // Call server to deduct SWARS tokens
      const response = await fetch('/api/swars/spend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress: authState.walletAddress,
          amount,
          purpose: 'tournament_entry'
        })
      });

      const result = await response.json();

      if (result.success) {
        // Update local SWARS balance
        authState.swarsBalance -= amount;
        updateSwarsUI();

        console.log('✅ SWARS payment successful');
        safeShowNotification(`Payment of ${amount} SWARS successful!`, 'success');

        return {
          success: true,
          transactionId: result.transactionId || 'swars_' + Date.now(),
          amount,
          currency: 'SWARS'
        };
      } else {
        throw new Error(result.error || 'SWARS payment failed');
      }

    } catch (error) {
      console.error('❌ SWARS payment failed:', error);
      throw error;
    }
  }

  // Join tournament (updated to include payment info)
  async joinTournament(tournamentId, entryType, transactionId = null) {
    try {
      console.log(`🎮 Joining tournament ${tournamentId} with ${entryType}`);

      // Show loading state
      const confirmBtn = document.querySelector('.confirm-join-btn');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Joining...';
      }

      const response = await fetch(`/api/tournaments/${tournamentId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress: authState.walletAddress,
          entryType,
          transactionId
        })
      });

      const result = await response.json();

      if (result.success) {
        showNotification(result.message, 'success');

        // Close modal
        const modal = document.getElementById('joinTournamentModal');
        if (modal) modal.classList.remove('active');

        // Subscribe to tournament updates
        this.subscribeToTournament(tournamentId);

        // Show tournament interface immediately
        await this.showTournamentInterface(tournamentId);

        // Reload tournaments to update participant count
        this.loadTournaments();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Error joining tournament:', error);
      showNotification(error.message || 'Failed to join tournament', 'error');

      // Reset button state
      const confirmBtn = document.querySelector('.confirm-join-btn');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Join Tournament';
      }
    }
  }

  // Format time remaining
  formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return 'Ended';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Update connection status indicator
  updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    if (indicator) {
      indicator.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
      indicator.innerHTML = connected ?
        '<i class="fas fa-wifi"></i> Live' :
        '<i class="fas fa-wifi"></i> Reconnecting...';
    }
  }

  // Show tournament interface
  async showTournamentInterface(tournamentId) {
    try {
      console.log(`🎮 Opening tournament interface for ${tournamentId}`);

      // Subscribe to tournament updates
      this.subscribeToTournament(tournamentId);

      // Show tournament interface modal
      const modal = document.getElementById('tournamentInterfaceModal');
      if (modal) {
        modal.classList.add('active');

        // Load tournament data
        await this.loadTournamentInterface(tournamentId);

        // Start real-time updates
        this.startTournamentUpdates(tournamentId);

        // Start aggressive price updates for trading tokens
        this.startTradingTokenPriceUpdates();
      }
    } catch (error) {
      console.error('❌ Error showing tournament interface:', error);
      showNotification('Failed to load tournament interface', 'error');
    }
  }

  // Load tournament interface data
  async loadTournamentInterface(tournamentId) {
    try {
      console.log(`🎮 Loading tournament interface for ${tournamentId}`);

      // Get tournament details
      const response = await fetch(`/api/tournaments/${tournamentId}`);
      if (!response.ok) {
        throw new Error('Failed to load tournament details');
      }

      const tournament = await response.json();
      this.currentTournament = tournament;

      console.log('🏆 Tournament loaded:', tournament.name);

      // Update tournament header
      this.updateTournamentHeader(tournament);

      // Load trading tokens with comprehensive data
      await this.loadTradingTokens(tournament.selectedTokens || []);

      // Load user portfolio and positions
      console.log('🔄 Initial load: Loading portfolio and positions...');
      await this.loadUserPortfolio(tournamentId);
      await this.loadUserPositions(tournamentId);
      console.log('✅ Initial load: Portfolio and positions loaded');

      // Load potential winnings for user
      if (authState.isAuthenticated) {
        await this.loadPotentialWinnings(tournamentId);
      }

      // Load leaderboard
      this.updateLeaderboard(tournament.leaderboard || []);

      console.log('✅ Tournament interface loaded successfully');
    } catch (error) {
      console.error('❌ Error loading tournament interface:', error);
      showNotification('Failed to load tournament interface', 'error');
    }
  }

  // Load potential winnings for the current user
  async loadPotentialWinnings(tournamentId) {
    try {
      if (!authState.walletAddress) return;

      console.log(`🎯 Loading potential winnings for ${authState.walletAddress}`);

      const response = await fetch(`/api/tournaments/${tournamentId}/potential-winnings/${authState.walletAddress}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const winningsData = await response.json();
      this.updatePotentialWinningsDisplay(winningsData);

    } catch (error) {
      console.error('❌ Error loading potential winnings:', error);
      // Don't show error notification for this as it's not critical
    }
  }

  // Update potential winnings display
  updatePotentialWinningsDisplay(winningsData) {
    const winningsContainer = document.getElementById('potentialWinnings');
    if (!winningsContainer) return;

    if (winningsData.rank === null) {
      winningsContainer.innerHTML = `
        <div class="winnings-info not-participating">
          <i class="fas fa-info-circle"></i>
          <span>Not participating in this tournament</span>
        </div>
      `;
      return;
    }

    let winningsContent = '';
    if (winningsData.rank <= 3 && winningsData.prizeInfo) {
      const prize = winningsData.prizeInfo;
      winningsContent = `
        <div class="winnings-info in-prize">
          <div class="current-position">
            <span class="position-label">Current Position:</span>
            <span class="position-rank">#${winningsData.rank}</span>
          </div>
          <div class="potential-prize">
            <span class="prize-label">Potential Prize:</span>
            <span class="prize-amount">${prize.solPrize.toFixed(4)} SOL</span>
            ${prize.bonusJackpot > 0 ? `<span class="bonus-amount">+${prize.bonusJackpot.toFixed(0)} SWARS</span>` : ''}
          </div>
          <div class="prize-tier">
            <span class="tier-info">${prize.label} (${(prize.percentage * 100).toFixed(0)}%)</span>
          </div>
        </div>
      `;
    } else {
      winningsContent = `
        <div class="winnings-info out-of-prize">
          <div class="current-position">
            <span class="position-label">Current Position:</span>
            <span class="position-rank">#${winningsData.rank} / ${winningsData.totalParticipants}</span>
          </div>
          <div class="motivation">
            <i class="fas fa-arrow-up"></i>
            <span>Climb to top 3 to win prizes!</span>
          </div>
        </div>
      `;
    }

    winningsContainer.innerHTML = winningsContent;
  }

  // Update tournament header info
  updateTournamentHeader(tournament) {
    const timeRemaining = document.getElementById('tournamentTimeRemaining');
    const balance = document.getElementById('tournamentBalance');
    const rank = document.getElementById('tournamentRank');
    const profitLoss = document.getElementById('tournamentProfitLoss');

    if (timeRemaining) {
      const timeLeft = tournament.timeUntilEnd > 0 ?
        this.formatTimeRemaining(tournament.timeUntilEnd) : 'ENDED';
      timeRemaining.textContent = timeLeft;
    }

    // These will be updated when portfolio loads
    if (balance) balance.textContent = '$10,000.00';
    if (rank) rank.textContent = '#--';
    if (profitLoss) profitLoss.textContent = '$0.00';
  }

  // Load trading tokens interface
  async loadTradingTokens(tokens) {
    const container = document.getElementById('tournamentTokens');
    if (!container) {
      console.warn('Tournament tokens container not found');
      return;
    }

    console.log(`🪙 Loading ${tokens.length} trading tokens...`);
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading trading tokens...</p></div>';

    try {
      // If no tokens provided, get them from the tournament or fetch trending tokens
      if (!tokens || tokens.length === 0) {
        console.log('🔄 No tokens provided, fetching tournament tokens...');

        // Try to get tokens from tournament selectedTokens
        if (this.currentTournament?.selectedTokens && this.currentTournament.selectedTokens.length > 0) {
          tokens = this.currentTournament.selectedTokens;
          console.log(`✅ Using ${tokens.length} tokens from tournament configuration`);

          // Check if tournament tokens need enrichment
          const needsEnrichment = tokens.some(token => !token.price || token.price === 0);
          if (needsEnrichment) {
            console.log('🔍 Tournament tokens need DexScreener enrichment...');
            tokens = await this.enrichTokensWithTradingData(tokens);
          }
        } else {
          // First try WebSocket trending tokens, then fallback to API
          if (this.trendingTokens && this.trendingTokens.length > 0) {
            console.log(`🔥 Using ${this.trendingTokens.length} trending tokens from WebSocket`);
            tokens = this.trendingTokens.slice(0, 10);
          } else {
            // Fallback: fetch trending tokens from server
            console.log('🔄 No WebSocket trending tokens, fetching from server...');
            try {
              const response = await fetch('/api/tokens/trending?limit=10');
              if (response.ok) {
                const enrichedTrending = await response.json();

                if (enrichedTrending && enrichedTrending.length > 0) {
                  tokens = enrichedTrending; // Already enriched with DexScreener data
                  console.log(`✅ Using ${tokens.length} pre-enriched trending tokens from API`);
                } else {
                  tokens = this.getFallbackTokens();
                }
              } else {
                console.error('❌ Failed to fetch trending tokens:', response.status);
                tokens = this.getFallbackTokens();
              }
            } catch (error) {
              console.error('❌ Error fetching trending tokens:', error);
              tokens = this.getFallbackTokens();
            }
          }
        }
      }

      container.innerHTML = '';

      if (!tokens || tokens.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-coins" style="font-size: 48px; color: var(--primary); margin-bottom: 20px;"></i>
            <h3>No Trading Tokens</h3>
            <p>Tournament tokens are being prepared...</p>
          </div>
        `;
        return;
      }

      for (const token of tokens) {
        const tokenCard = this.createTokenTradingCard(token);
        container.appendChild(tokenCard);

        // Subscribe to price updates for this token
        this.subscribeToToken(token.address);

        // Register token with price service
        await this.registerTokenPrice(token.address, token.symbol, token.price || 0);
      }

      console.log(`✅ Loaded ${tokens.length} trading tokens`);
    } catch (error) {
      console.error('❌ Error loading trading tokens:', error);
      container.innerHTML = `
        <div class="error-state">
          <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--error); margin-bottom: 20px;"></i>
          <h3>Error Loading Tokens</h3>
          <p>Failed to load trading tokens. Please try again.</p>
          <button class="btn btn-primary" onclick="tournamentManager.loadTradingTokens()">Retry</button>
        </div>
      `;
    }
  }

  // Create token trading card with rich metadata
  createTokenTradingCard(token) {
    const card = document.createElement('div');
    card.className = 'token-trading-card';
    card.setAttribute('data-token-address', token.address);

    const priceChange24h = token.priceChange24h || 0;
    const priceChange6h = token.priceChange6h || 0;
    const priceChangeClass = priceChange24h >= 0 ? 'positive' : 'negative';
    const priceChangeIcon = priceChange24h >= 0 ? '↗' : '↘';

    // Format social links
    const socialLinks = this.createSocialLinks(token);

    // Format trending indicators
    const trendingBadge = token.isTrending || token.boosts > 0 ?
      `<span class="trending-badge">🔥 Trending</span>` : '';

    card.innerHTML = `
      ${token.banner ? `<div class="token-banner" style="background-image: url('${token.banner}')"></div>` : ''}

      <div class="token-header">
        <div class="token-info">
          ${token.icon || token.image ?
            `<img src="${token.icon || token.image}" alt="${token.symbol}" class="token-image"
                  onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <div class="token-image-initials" style="display: none;">${(token.symbol || '?').substring(0, 2).toUpperCase()}</div>` :
            `<div class="token-image-initials">${(token.symbol || '?').substring(0, 2).toUpperCase()}</div>`
          }
          <div class="token-details">
            <div class="token-name-row">
              <h4 class="token-name">${token.name}</h4>
              ${trendingBadge}
            </div>
            <span class="token-symbol">${token.symbol}</span>
            ${token.description ? `<p class="token-description">${token.description.slice(0, 100)}...</p>` : ''}
          </div>
        </div>
        <div class="token-price-info">
          <div class="current-price" id="price-${token.address}">$${token.price?.toFixed(6) || '0.000000'}</div>
          <div class="price-changes">
            <div class="price-change ${priceChangeClass}" id="change-24h-${token.address}">
              24h: ${priceChangeIcon} ${Math.abs(priceChange24h).toFixed(2)}%
            </div>
            <div class="price-change-6h" id="change-6h-${token.address}">
              6h: ${priceChange6h >= 0 ? '↗' : '↘'} ${Math.abs(priceChange6h).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      <div class="token-stats-grid">
        <div class="stat">
          <span class="stat-label">Market Cap</span>
          <span class="stat-value">${this.formatNumber(token.marketCap || 0)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">24h Volume</span>
          <span class="stat-value">${this.formatNumber(token.volume24h || 0)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Liquidity</span>
          <span class="stat-value">${this.formatNumber(token.liquidity || 0)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">24h Txns</span>
          <span class="stat-value">${token.txns24h || 0}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Holdings</span>
          <span class="stat-value" id="holdings-${token.address}">0</span>
        </div>
        <div class="stat">
          <span class="stat-label">DEX</span>
          <span class="stat-value">${token.dexId || 'Unknown'}</span>
        </div>
      </div>

      ${socialLinks ? `<div class="token-social-links">${socialLinks}</div>` : ''}

      <div class="trading-controls">
        <div class="trade-input-group">
          <label>Amount</label>
          <input type="number" class="trade-amount-input" id="amount-${token.address}"
                 placeholder="0.00" min="0" step="0.000001">
        </div>

        <div class="trade-buttons">
          <button class="btn btn-success trade-btn" data-action="buy" data-token="${token.address}">
            <i class="fas fa-arrow-up"></i> Buy
          </button>
          <button class="btn btn-danger trade-btn" data-action="sell" data-token="${token.address}">
            <i class="fas fa-arrow-down"></i> Sell
          </button>
        </div>
      </div>

      <div class="quick-amounts">
        <button class="quick-amount-btn" data-percentage="25" data-token="${token.address}">25%</button>
        <button class="quick-amount-btn" data-percentage="50" data-token="${token.address}">50%</button>
        <button class="quick-amount-btn" data-percentage="75" data-token="${token.address}">75%</button>
        <button class="quick-amount-btn" data-percentage="100" data-token="${token.address}">MAX</button>
      </div>

      <div class="token-footer">
        <div class="token-actions">
          ${token.url ? `<a href="${token.url}" target="_blank" class="dex-link">View on DexScreener</a>` : ''}
          <button class="token-details-btn" onclick="showTokenDetails('${token.address}')">
            <i class="fas fa-info-circle"></i> Details
          </button>
        </div>
      </div>
    `;

    // Add event listeners
    this.setupTokenCardListeners(card, token);

    return card;
  }

  // Setup event listeners for token trading card
  setupTokenCardListeners(card, token) {
    // Trade buttons
    const tradeButtons = card.querySelectorAll('.trade-btn');
    tradeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.getAttribute('data-action');
        const amountInput = card.querySelector(`#amount-${token.address}`);
        const amount = parseFloat(amountInput.value);

        if (!amount || amount <= 0) {
          showNotification('Please enter a valid amount', 'error');
          return;
        }

        this.executeTrade(action, token.address, amount);
      });
    });

    // Quick amount buttons
    const quickButtons = card.querySelectorAll('.quick-amount-btn');
    quickButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const percentage = parseInt(btn.getAttribute('data-percentage'));
        const tokenAddress = btn.getAttribute('data-token');
        const amountInput = card.querySelector(`#amount-${tokenAddress}`);

        if (!amountInput) {
          console.error('Amount input not found for token:', tokenAddress);
          return;
        }

        // Calculate amount based on percentage of available balance
        this.calculateQuickAmount(tokenAddress, percentage, amountInput);
      });
    });

    // Amount input validation
    const amountInput = card.querySelector(`#amount-${token.address}`);
    if (amountInput) {
      amountInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (value < 0) {
          e.target.value = '';
        }
      });
    }
  }

  // Calculate quick amount based on percentage
  calculateQuickAmount(tokenAddress, percentage, amountInput) {
    try {
      // Get available balance (default to starting balance if no portfolio loaded)
      let availableBalance = 10000; // Default starting balance

      if (this.userPortfolio && this.userPortfolio.cashBalance !== undefined) {
        availableBalance = this.userPortfolio.cashBalance;
      }

      // Calculate USD amount based on percentage
      let usdAmount;
      if (percentage === 100) {
        // MAX button - use all available balance
        usdAmount = availableBalance;
      } else {
        // Percentage of available balance
        usdAmount = (availableBalance * percentage) / 100;
      }

      // Get current token price to calculate how many tokens we can buy
      const currentPrice = this.realTimePrices[tokenAddress]?.price || 0;

      if (currentPrice > 0) {
        // Calculate token amount based on USD amount and current price
        const tokenAmount = usdAmount / currentPrice;
        amountInput.value = tokenAmount.toFixed(6);
        console.log(`💰 ${percentage}% of $${availableBalance} = $${usdAmount} = ${tokenAmount.toFixed(6)} tokens at $${currentPrice}`);
      } else {
        // If no price available, just use USD amount
        amountInput.value = usdAmount.toFixed(2);
        console.log(`💰 ${percentage}% of $${availableBalance} = $${usdAmount} (no price available)`);
      }
    } catch (error) {
      console.error('❌ Error calculating quick amount:', error);
      showNotification('Error calculating amount', 'error');
    }
  }

  // Set quick amount based on percentage (legacy method)
  async setQuickAmount(tokenAddress, percentage, amountInput) {
    try {
      if (!this.currentTournament) {
        showNotification('No active tournament', 'error');
        return;
      }

      // Get current portfolio to calculate available balance
      const portfolioResponse = await fetch(`/api/trading/portfolio/${this.currentTournament.id}/${authState.walletAddress}`);
      const portfolio = await portfolioResponse.json();

      // For now, use a portion of cash balance for buying
      // In a real implementation, you'd calculate based on current holdings for selling
      const availableBalance = portfolio.cashBalance || 10000; // Default starting balance
      const amount = (availableBalance * percentage) / 100;

      // Get current token price to calculate how many tokens we can buy
      const currentPrice = this.realTimePrices[tokenAddress]?.price || 0;
      if (currentPrice > 0) {
        const tokenAmount = amount / currentPrice;
        amountInput.value = tokenAmount.toFixed(6);
      } else {
        amountInput.value = amount.toFixed(2);
      }
    } catch (error) {
      console.error('❌ Error setting quick amount:', error);
      showNotification('Error calculating amount', 'error');
    }
  }

  // Execute trade (buy or sell)
  async executeTrade(action, tokenAddress, amount) {
    try {
      if (!this.currentTournament) {
        showNotification('No active tournament', 'error');
        return;
      }

      console.log(`💰 Executing ${action} order: ${amount} tokens of ${tokenAddress}`);

      // Show loading state on button
      const tradeBtn = document.querySelector(`[data-action="${action}"][data-token="${tokenAddress}"]`);
      if (tradeBtn) {
        tradeBtn.disabled = true;
        tradeBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${action === 'buy' ? 'Buying' : 'Selling'}...`;
      }

      const endpoint = action === 'buy' ? '/api/trading/buy' : '/api/trading/sell';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tournamentId: this.currentTournament.id,
          walletAddress: authState.walletAddress,
          tokenAddress,
          amount
        })
      });

      const result = await response.json();

      if (result.success) {
        showNotification(result.message, 'success');

        // Update portfolio display
        this.updatePortfolioDisplay(result.newBalance, result.portfolio);

        // Update holdings display for this token
        this.updateTokenHoldings(tokenAddress, result.portfolio);

        // Clear the amount input
        const amountInput = document.querySelector(`#amount-${tokenAddress}`);
        if (amountInput) amountInput.value = '';

        // Reload portfolio and positions to get latest data
        await this.loadUserPortfolio(this.currentTournament.id);
        await this.loadUserPositions(this.currentTournament.id);

      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(`❌ Error executing ${action} order:`, error);
      showNotification(error.message || `Failed to ${action} tokens`, 'error');
    } finally {
      // Reset button state
      const tradeBtn = document.querySelector(`[data-action="${action}"][data-token="${tokenAddress}"]`);
      if (tradeBtn) {
        tradeBtn.disabled = false;
        tradeBtn.innerHTML = `<i class="fas fa-arrow-${action === 'buy' ? 'up' : 'down'}"></i> ${action === 'buy' ? 'Buy' : 'Sell'}`;
      }
    }
  }

  // Update portfolio display
  updatePortfolioDisplay(newBalance, portfolio) {
    const balanceElement = document.getElementById('tournamentBalance');
    if (balanceElement) {
      balanceElement.textContent = `$${newBalance.toFixed(2)}`;
    }

    // Update profit/loss
    const startingBalance = 10000; // Default starting balance
    const profitLoss = newBalance - startingBalance;
    const profitLossElement = document.getElementById('tournamentProfitLoss');
    if (profitLossElement) {
      profitLossElement.textContent = `$${profitLoss.toFixed(2)}`;
      profitLossElement.className = `value ${profitLoss >= 0 ? 'positive' : 'negative'}`;
    }
  }

  // Update token holdings display
  updateTokenHoldings(tokenAddress, portfolio) {
    const holdingsElement = document.getElementById(`holdings-${tokenAddress}`);
    if (holdingsElement && portfolio) {
      const holding = portfolio.find(p => p.tokenAddress === tokenAddress);
      const amount = holding ? holding.amount : 0;
      holdingsElement.textContent = amount.toFixed(6);
    }
  }

  // Create social links HTML
  createSocialLinks(token) {
    const links = [];

    if (token.website) {
      links.push(`<a href="${token.website}" target="_blank" title="Website"><i class="fas fa-globe"></i></a>`);
    }
    if (token.twitter) {
      links.push(`<a href="${token.twitter}" target="_blank" title="Twitter"><i class="fab fa-twitter"></i></a>`);
    }
    if (token.telegram) {
      links.push(`<a href="${token.telegram}" target="_blank" title="Telegram"><i class="fab fa-telegram"></i></a>`);
    }
    if (token.discord) {
      links.push(`<a href="${token.discord}" target="_blank" title="Discord"><i class="fab fa-discord"></i></a>`);
    }

    return links.length > 0 ? links.join('') : '';
  }

  // Setup event listeners for token card
  setupTokenCardListeners(card, token) {
    // Trade buttons
    const tradeButtons = card.querySelectorAll('.trade-btn');
    tradeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.getAttribute('data-action');
        const tokenAddress = btn.getAttribute('data-token');
        const amountInput = card.querySelector(`#amount-${tokenAddress}`);
        const amount = parseFloat(amountInput.value);

        if (!amount || amount <= 0) {
          showNotification('Please enter a valid amount', 'warning');
          return;
        }

        this.executeTrade(action, tokenAddress, amount);
      });
    });

    // Quick amount buttons
    const quickButtons = card.querySelectorAll('.quick-amount-btn');
    quickButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const percentage = parseInt(btn.getAttribute('data-percentage'));
        const tokenAddress = btn.getAttribute('data-token');
        this.setQuickAmount(tokenAddress, percentage);
      });
    });
  }

  // Set quick amount based on percentage
  setQuickAmount(tokenAddress, percentage) {
    const amountInput = document.getElementById(`amount-${tokenAddress}`);
    if (!amountInput || !this.userPortfolio) return;

    const currentPrice = this.realTimePrices[tokenAddress];
    if (!currentPrice) return;

    let maxAmount = 0;

    if (percentage === 100) {
      // For MAX, use either all cash (for buy) or all holdings (for sell)
      const holdings = this.userPortfolio.holdings?.[tokenAddress] || 0;
      maxAmount = Math.max(holdings, this.userPortfolio.cash / currentPrice);
    } else {
      // For percentage, use percentage of cash for buying
      maxAmount = (this.userPortfolio.cash * percentage / 100) / currentPrice;
    }

    amountInput.value = maxAmount.toFixed(6);
  }

  // Execute trade
  async executeTrade(action, tokenAddress, amount) {
    if (!authState.isAuthenticated) {
      showNotification('Please connect your wallet first!', 'error');
      return;
    }

    if (!this.currentTournament) {
      showNotification('No active tournament', 'error');
      return;
    }

    try {
      console.log(`🔄 Executing ${action.toUpperCase()} order: ${amount} tokens`);

      const response = await fetch(`/api/trading/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tournamentId: this.currentTournament.id,
          walletAddress: authState.walletAddress,
          tokenAddress,
          amount
        })
      });

      const result = await response.json();

      if (result.success) {
        showNotification(result.message, 'success');

        // Update UI - reload both portfolio and positions
        console.log('🔄 Reloading portfolio and positions after trade...');
        await this.loadUserPortfolio(this.currentTournament.id);
        await this.loadUserPositions(this.currentTournament.id);
        this.clearTradeInput(tokenAddress);
        console.log('✅ Portfolio and positions reload completed');
      } else {
        showNotification(result.error || 'Trade failed', 'error');
      }
    } catch (error) {
      console.error('❌ Error executing trade:', error);
      showNotification('Failed to execute trade', 'error');
    }
  }

  // Load user portfolio
  async loadUserPortfolio(tournamentId) {
    if (!authState.isAuthenticated) return;

    try {
      const response = await fetch(`/api/trading/portfolio/${tournamentId}/${authState.walletAddress}`);
      const portfolio = await response.json();

      // Update tournament status bar with detailed balance info
      this.updateTournamentStatusBar(portfolio);

      // Update token holdings
      console.log('📊 Portfolio data received:', portfolio);

      if (portfolio.holdings && Object.keys(portfolio.holdings).length > 0) {
        console.log('💰 Updating holdings:', portfolio.holdings);

        for (const [tokenAddress, amount] of Object.entries(portfolio.holdings)) {
          const holdingsElement = document.getElementById(`holdings-${tokenAddress}`);
          if (holdingsElement) {
            holdingsElement.textContent = amount.toFixed(6);
            console.log(`✅ Updated holdings for ${tokenAddress}: ${amount.toFixed(6)}`);
          } else {
            console.warn(`⚠️ Holdings element not found for token: ${tokenAddress}`);
          }
        }
      } else {
        console.log('📊 No holdings to display');

        // Clear all holdings displays
        const holdingsElements = document.querySelectorAll('[id^="holdings-"]');
        holdingsElements.forEach(element => {
          element.textContent = '0.000000';
        });
      }

      this.userPortfolio = portfolio;
    } catch (error) {
      console.error('❌ Error loading portfolio:', error);
    }
  }

  // Update tournament status bar with detailed balance information
  updateTournamentStatusBar(portfolio) {
    if (!portfolio) return;

    console.log('💰 Updating tournament status bar with portfolio:', portfolio);

    // Update main balance display (total value)
    const balance = document.getElementById('tournamentBalance');
    if (balance) {
      const totalValue = portfolio.totalValue || 0;
      balance.textContent = `$${totalValue.toFixed(2)}`;
    }

    // Update profit/loss display with percentage
    const profitLoss = document.getElementById('tournamentProfitLoss');
    if (profitLoss) {
      const profit = portfolio.profit || 0;
      const profitPercent = portfolio.profitPercent || 0;
      const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
      const profitIcon = profit >= 0 ? '+' : '';

      profitLoss.innerHTML = `
        <span class="profit-amount">${profitIcon}$${profit.toFixed(2)}</span>
        <span class="profit-percent">(${profitIcon}${profitPercent.toFixed(2)}%)</span>
      `;
      profitLoss.className = `value ${profitClass}`;
    }

    // Update cash balance display (virtual SOL available for trading)
    const cashBalance = document.getElementById('tournamentCash');
    if (cashBalance) {
      const cash = portfolio.cashBalance || 0;
      cashBalance.textContent = `$${cash.toFixed(2)}`;
    }

    // Update portfolio value display (value of held tokens)
    const portfolioValue = document.getElementById('tournamentPortfolio');
    if (portfolioValue) {
      const value = portfolio.portfolioValue || 0;
      portfolioValue.textContent = `$${value.toFixed(2)}`;
    }

    // Update starting balance reference
    const startingBalance = document.getElementById('tournamentStarting');
    if (startingBalance) {
      const starting = portfolio.startingBalance || 10000;
      startingBalance.textContent = `$${starting.toFixed(2)}`;
    }

    console.log(`✅ Status bar updated - Total: $${portfolio.totalValue?.toFixed(2)}, Cash: $${portfolio.cashBalance?.toFixed(2)}, Portfolio: $${portfolio.portfolioValue?.toFixed(2)}, P&L: ${portfolio.profit >= 0 ? '+' : ''}$${portfolio.profit?.toFixed(2)} (${portfolio.profitPercent?.toFixed(2)}%)`);
  }

  // Load user positions with detailed buy prices and P&L
  async loadUserPositions(tournamentId) {
    console.log('🔍 loadUserPositions called with:', { tournamentId, authState: authState.isAuthenticated, walletAddress: authState.walletAddress });

    if (!authState.isAuthenticated) {
      console.log('⚠️ Not authenticated, skipping positions load');
      return;
    }

    try {
      const url = `/api/trading/positions/${tournamentId}/${authState.walletAddress}`;
      console.log(`📊 Making positions API call to: ${url}`);

      const response = await fetch(url);
      console.log('📊 Positions API response status:', response.status);
      console.log('📊 Positions API response headers:', response.headers);

      if (!response.ok) {
        console.error('❌ Positions API response not ok:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error response body:', errorText);
        this.showNoPositions();
        return;
      }

      const positionsData = await response.json();
      console.log('📊 Positions API response data:', positionsData);

      if (positionsData.success && positionsData.positions && positionsData.positions.length > 0) {
        console.log(`✅ Found ${positionsData.positions.length} positions, updating display...`);
        this.updatePositionsDisplay(positionsData);
        console.log(`✅ Loaded ${positionsData.totalPositions} positions`);
      } else {
        console.log('⚠️ No positions data available or empty positions array');
        this.showNoPositions();
      }
    } catch (error) {
      console.error('❌ Error loading positions:', error);
      console.error('❌ Error stack:', error.stack);
      this.showNoPositions();
    }
  }

  // Update positions display
  updatePositionsDisplay(positionsData) {
    const positionsContainer = document.getElementById('positionsContainer');
    const noPositionsState = document.getElementById('noPositionsState');
    const positionsList = document.getElementById('positionsList');

    if (!positionsContainer || !positionsList) return;

    if (positionsData.positions.length === 0) {
      this.showNoPositions();
      return;
    }

    // Hide no positions state and show positions list
    if (noPositionsState) noPositionsState.style.display = 'none';
    positionsList.style.display = 'block';

    // Generate positions HTML
    const positionsHTML = positionsData.positions.map(position => {
      const pnlClass = position.pnl >= 0 ? 'profit' : 'loss';
      const pnlIcon = position.pnl >= 0 ? '+' : '';

      // Create token icon HTML
      const tokenIconHtml = position.tokenIcon ?
        `<img src="${position.tokenIcon}" alt="${position.tokenSymbol}" class="position-token-icon-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
         <div class="position-token-icon-fallback" style="display: none;">${position.tokenSymbol.slice(0, 3).toUpperCase()}</div>` :
        `<div class="position-token-icon-fallback">${position.tokenSymbol.slice(0, 3).toUpperCase()}</div>`;

      return `
        <div class="position-card">
          <div class="position-header">
            <div class="position-token-info">
              <div class="position-token-icon">
                ${tokenIconHtml}
              </div>
              <div class="position-token-details">
                <h4>${position.tokenName || position.tokenSymbol}</h4>
                <span class="position-token-symbol">${position.tokenSymbol}</span>
                <span class="position-token-address">${position.tokenAddress.slice(0, 8)}...${position.tokenAddress.slice(-4)}</span>
              </div>
            </div>
            <div class="position-pnl ${pnlClass}">
              <div class="position-pnl-amount">${pnlIcon}$${position.pnl.toFixed(2)}</div>
              <div class="position-pnl-percent">${pnlIcon}${position.pnlPercent.toFixed(2)}%</div>
            </div>
          </div>

          <div class="position-details">
            <div class="position-detail">
              <span class="position-detail-label">Amount</span>
              <span class="position-detail-value position-amount">${position.amount.toFixed(6)}</span>
            </div>
            <div class="position-detail">
              <span class="position-detail-label">Avg Buy Price</span>
              <span class="position-detail-value position-buy-price">$${position.averageBuyPrice.toFixed(6)}</span>
            </div>
            <div class="position-detail">
              <span class="position-detail-label">Current Price</span>
              <span class="position-detail-value position-current-price">$${position.currentPrice.toFixed(6)}</span>
            </div>
            <div class="position-detail">
              <span class="position-detail-label">Total Cost</span>
              <span class="position-detail-value">$${position.totalCost.toFixed(2)}</span>
            </div>
            <div class="position-detail">
              <span class="position-detail-label">Current Value</span>
              <span class="position-detail-value position-value">$${position.currentValue.toFixed(2)}</span>
            </div>
            <div class="position-detail">
              <span class="position-detail-label">Trades</span>
              <span class="position-detail-value">${position.transactionCount}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    positionsList.innerHTML = positionsHTML;

    console.log(`💰 Updated positions display with ${positionsData.positions.length} positions, Total P&L: ${positionsData.totalPnL >= 0 ? '+' : ''}$${positionsData.totalPnL.toFixed(2)}`);
  }

  // Show no positions state
  showNoPositions() {
    const noPositionsState = document.getElementById('noPositionsState');
    const positionsList = document.getElementById('positionsList');

    if (noPositionsState) noPositionsState.style.display = 'block';
    if (positionsList) {
      positionsList.style.display = 'none';
      positionsList.innerHTML = '';
    }
  }

  // Clear trade input
  clearTradeInput(tokenAddress) {
    const amountInput = document.getElementById(`amount-${tokenAddress}`);
    if (amountInput) {
      amountInput.value = '';
    }
  }

  // Start tournament updates
  startTournamentUpdates(tournamentId) {
    // Update portfolio and positions every 5 seconds for real-time experience
    this.portfolioUpdateInterval = setInterval(async () => {
      await this.loadUserPortfolio(tournamentId);
      await this.loadUserPositions(tournamentId);

      // Update potential winnings
      if (authState.isAuthenticated) {
        await this.loadPotentialWinnings(tournamentId);
      }
    }, 5000);
  }

  // Stop tournament updates
  stopTournamentUpdates() {
    if (this.portfolioUpdateInterval) {
      clearInterval(this.portfolioUpdateInterval);
    }
    if (this.tradingTokenPriceInterval) {
      clearInterval(this.tradingTokenPriceInterval);
    }
  }

  // Start aggressive price updates for trading tokens
  startTradingTokenPriceUpdates() {
    console.log('🔄 Starting aggressive price updates for trading tokens...');

    // Update trading token prices every 3 seconds for ultra real-time experience
    this.tradingTokenPriceInterval = setInterval(async () => {
      await this.updateTradingTokenPrices();
    }, 3000);

    // Also update immediately
    this.updateTradingTokenPrices();
  }

  // Update prices for all trading tokens in current tournament
  async updateTradingTokenPrices() {
    if (!this.currentTournament || !this.currentTournament.selectedTokens) {
      return;
    }

    try {
      const tokenAddresses = this.currentTournament.selectedTokens.map(token => token.address);

      if (tokenAddresses.length === 0) {
        return;
      }

      console.log(`🔄 Fetching real-time prices for ${tokenAddresses.length} trading tokens...`);

      // Fetch latest prices from the server
      const response = await fetch('/api/tokens/prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tokenAddresses })
      });

      if (response.ok) {
        const pricesData = await response.json();

        // Update real-time prices cache
        for (const [tokenAddress, priceInfo] of Object.entries(pricesData)) {
          if (priceInfo && priceInfo.price) {
            this.realTimePrices[tokenAddress] = {
              price: priceInfo.price,
              priceChange24h: priceInfo.priceChange || priceInfo.priceChange24h || 0,
              priceChange6h: priceInfo.priceChange6h || 0,
              volume24h: priceInfo.volume24h || 0,
              liquidity: priceInfo.liquidity || 0,
              lastUpdated: Date.now()
            };
          }
        }

        // Update price displays immediately
        this.updatePriceDisplays();

        console.log(`✅ Updated prices for ${Object.keys(pricesData).length} trading tokens`);
      } else {
        console.warn('⚠️ Failed to fetch trading token prices:', response.status);
      }
    } catch (error) {
      console.error('❌ Error updating trading token prices:', error);
    }
  }

  // Format number for display
  formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(2);
  }

  // Update tournament availability indicator
  updateTournamentAvailabilityIndicator(stats) {
    const indicator = document.getElementById('tournamentAvailabilityIndicator');
    if (!indicator) return;

    const joinableCount = stats.joinable || 0;
    const activeCount = stats.active || 0;
    const upcomingCount = stats.upcoming || 0;
    const totalCount = stats.total || 0;

    let statusClass = 'good';
    let statusText = `${joinableCount} Available`;
    let statusIcon = 'fas fa-check-circle';

    if (joinableCount === 0) {
      statusClass = 'warning';
      statusText = totalCount > 0 ? 'Tournaments Full' : 'Creating Tournaments...';
      statusIcon = totalCount > 0 ? 'fas fa-users' : 'fas fa-cog fa-spin';
    } else if (joinableCount === 1) {
      statusClass = 'caution';
      statusText = `${joinableCount} Available`;
      statusIcon = 'fas fa-clock';
    } else if (joinableCount >= 5) {
      statusClass = 'excellent';
      statusText = `${joinableCount} Available`;
      statusIcon = 'fas fa-star';
    }

    // Add more detailed status information
    let detailText = `${activeCount} Active • ${upcomingCount} Upcoming`;
    if (totalCount > 0 && joinableCount === 0) {
      detailText += ` • All tournaments full`;
    }

    indicator.innerHTML = `
      <i class="${statusIcon}"></i>
      <span>${statusText}</span>
      <small>${detailText}</small>
    `;
    indicator.className = `availability-indicator ${statusClass}`;

    // Auto-refresh if no tournaments are available
    if (joinableCount === 0 && totalCount === 0) {
      console.log('🔄 No tournaments available, will auto-refresh in 10 seconds...');
      setTimeout(() => {
        this.loadTournaments();
      }, 10000);
    }
  }

  // Trigger emergency tournament creation
  async triggerEmergencyTournamentCreation() {
    try {
      console.log('🚨 Triggering emergency tournament creation...');

      // Try the new debug endpoint first
      let response = await fetch('/api/tournaments/debug/force-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Fallback to schedule endpoint if debug endpoint fails
      if (!response.ok) {
        console.log('🔄 Debug endpoint failed, trying schedule endpoint...');
        response = await fetch('/api/tournaments/schedule', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'ensure_availability'
          })
        });
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ Emergency tournaments created:', result);

        // Show immediate feedback
        safeShowNotification('New tournaments are being created!', 'info');

        // Reload tournaments after a short delay
        setTimeout(() => {
          this.loadTournaments();
        }, 3000);
      } else {
        console.error('❌ Emergency creation failed:', result);
        safeShowNotification('Failed to create tournaments. Please refresh the page.', 'error');
      }
    } catch (error) {
      console.error('❌ Error triggering emergency tournament creation:', error);
      safeShowNotification('Connection error. Please check your internet and refresh.', 'error');
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Refresh tournaments button
    const refreshBtn = document.getElementById('refreshTournamentsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadTournaments();
      });
    }

    // Create instant tournament button
    const instantBtn = document.getElementById('createInstantTournamentBtn');
    if (instantBtn) {
      instantBtn.addEventListener('click', () => {
        this.createInstantTournament();
      });
    }

    // Auto-refresh tournaments every 30 seconds to maintain availability
    setInterval(() => {
      this.loadTournaments();
    }, 30000);

    // Keep WebSocket alive with ping
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  // Update tournament display
  updateTournamentDisplay() {
    // Update tournament header if in tournament interface
    const tournamentHeader = document.getElementById('tournamentHeader');
    if (tournamentHeader && this.currentTournament) {
      const timeLeft = this.currentTournament.endTime - Date.now();
      const timeLeftFormatted = this.formatTimeLeft(timeLeft);

      tournamentHeader.innerHTML = `
        <h2>${this.currentTournament.name}</h2>
        <div class="tournament-stats">
          <span>Time Left: ${timeLeftFormatted}</span>
          <span>Participants: ${this.currentTournament.participantCount || 0}</span>
          <span>Prize Pool: ${this.currentTournament.prizePoolSol || 0} SOL</span>
        </div>
      `;
    }
  }

  // Show tournament details modal
  showTournamentDetails(tournament) {
    console.log('📋 Showing tournament details:', tournament.name);

    // For now, show the join modal
    this.showJoinTournamentModal(tournament);
  }

  // Show detailed prize structure modal
  async showPrizeDetails(tournamentId) {
    try {
      console.log(`💰 Showing prize details for tournament ${tournamentId}`);

      // Fetch detailed prize structure
      const response = await fetch(`/api/tournaments/${tournamentId}/prize-structure`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const prizeStructure = await response.json();

      // Create or get existing modal
      let modal = document.getElementById('prizeDetailsModal');
      if (!modal) {
        modal = this.createPrizeDetailsModal();
      }

      // Update modal content
      const modalContent = modal.querySelector('#prizeDetailsContent');
      modalContent.innerHTML = `
        <div class="prize-details-header">
          <h3><i class="fas fa-trophy"></i> Prize Structure</h3>
          <p>Tournament: ${prizeStructure.tournamentId}</p>
        </div>

        <div class="prize-pool-summary">
          <div class="pool-stat">
            <span class="pool-label">Total SOL Prize Pool</span>
            <span class="pool-value">${prizeStructure.totalSolPrize.toFixed(4)} SOL</span>
          </div>
          <div class="pool-stat">
            <span class="pool-label">Bonus Jackpot (SWARS entries)</span>
            <span class="pool-value">${prizeStructure.totalBonusJackpot.toFixed(0)} SWARS</span>
          </div>
          <div class="pool-stat">
            <span class="pool-label">Current Participants</span>
            <span class="pool-value">${prizeStructure.participantCount}/${prizeStructure.maxParticipants}</span>
          </div>
        </div>

        <div class="prize-distribution">
          <h4>Prize Distribution</h4>
          <div class="payout-tiers">
            ${prizeStructure.payouts.map(payout => `
              <div class="payout-tier">
                <div class="tier-info">
                  <span class="tier-rank">${payout.label}</span>
                  <span class="tier-percentage">${(payout.percentage * 100).toFixed(0)}%</span>
                </div>
                <div class="tier-rewards">
                  <div class="reward-item">
                    <span class="reward-label">SOL Prize:</span>
                    <span class="reward-value">${payout.solPrize.toFixed(4)} SOL</span>
                  </div>
                  ${payout.bonusJackpot > 0 ? `
                    <div class="reward-item bonus">
                      <span class="reward-label">Bonus (SWARS entries):</span>
                      <span class="reward-value">+${payout.bonusJackpot.toFixed(0)} SWARS</span>
                    </div>
                  ` : ''}
                  <div class="reward-total">
                    <span class="reward-label">Total Value:</span>
                    <span class="reward-value">${payout.totalValue.toFixed(4)} SOL equiv.</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="prize-info">
          <div class="info-section">
            <h5><i class="fas fa-info-circle"></i> How It Works</h5>
            <ul>
              <li>Entry fees are split: ${(prizeStructure.prizePoolPercentage * 100).toFixed(0)}% goes to prize pool, ${(prizeStructure.platformFee / prizeStructure.entryFeeSol * 100).toFixed(0)}% platform fee</li>
              <li>SOL entries contribute directly to the main prize pool</li>
              <li>SWARS entries contribute to bonus jackpot with ${((prizeStructure.totalBonusJackpot / Math.max(1, prizeStructure.participantCount)) / prizeStructure.entryFeeSwars * 100).toFixed(0)}% bonus multiplier</li>
              <li>Only top 3 finishers receive prizes</li>
              <li>Prize pool grows as more participants join!</li>
            </ul>
          </div>
        </div>

        <div class="prize-actions">
          <button class="btn btn-secondary" onclick="closePrizeDetailsModal()">Close</button>
        </div>
      `;

      modal.classList.add('active');

    } catch (error) {
      console.error('❌ Error showing prize details:', error);
      safeShowNotification('Failed to load prize details', 'error');
    }
  }

  // Create prize details modal
  createPrizeDetailsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'prizeDetailsModal';
    modal.innerHTML = `
      <div class="modal-content prize-details-modal">
        <div class="modal-header">
          <button class="modal-close" onclick="closePrizeDetailsModal()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div id="prizeDetailsContent" class="modal-body">
          <!-- Content will be populated dynamically -->
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });

    return modal;
  }

  // Update leaderboard display
  updateLeaderboard(leaderboard) {
    const leaderboardContainer = document.getElementById('tournamentLeaderboard');
    if (!leaderboardContainer) return;

    if (!leaderboard || leaderboard.length === 0) {
      leaderboardContainer.innerHTML = '<div class="no-data">No participants yet</div>';
      return;
    }

    const leaderboardHTML = leaderboard.map((participant, index) => `
      <div class="leaderboard-item ${participant.walletAddress === authState.walletAddress ? 'current-user' : ''}">
        <div class="rank">#${index + 1}</div>
        <div class="player-info">
          <span class="username">${participant.username || `Trader ${participant.walletAddress.slice(-4)}`}</span>
          <span class="wallet">${participant.walletAddress.slice(0, 4)}...${participant.walletAddress.slice(-4)}</span>
        </div>
        <div class="balance">$${participant.currentBalance?.toFixed(2) || '0.00'}</div>
        <div class="profit ${(participant.profit || 0) >= 0 ? 'positive' : 'negative'}">
          ${(participant.profit || 0) >= 0 ? '+' : ''}$${(participant.profit || 0).toFixed(2)}
        </div>
      </div>
    `).join('');

    leaderboardContainer.innerHTML = leaderboardHTML;
  }

  // Format time left
  formatTimeLeft(milliseconds) {
    if (milliseconds <= 0) return 'Ended';

    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Enrich tokens with full DexScreener trading data
  async enrichTokensWithTradingData(tokens) {
    try {
      console.log(`🔍 Enriching ${tokens.length} tokens with DexScreener data...`);

      // Extract token addresses
      const tokenAddresses = tokens.map(token => token.address || token.tokenAddress).filter(Boolean);

      if (tokenAddresses.length === 0) {
        console.warn('⚠️ No valid token addresses found');
        return this.getFallbackTokens();
      }

      // Fetch full trading data from DexScreener
      const response = await fetch('/api/tokens/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tokenAddresses })
      });

      if (!response.ok) {
        console.error('❌ Failed to fetch token trading data:', response.status);
        return this.getFallbackTokens();
      }

      const tradingData = await response.json();

      // Merge original token data with trading data
      const enrichedTokens = tokens.map(token => {
        const address = token.address || token.tokenAddress;
        const trading = tradingData[address];

        if (trading && trading.price > 0) {
          return {
            // Original data
            ...token,

            // Enhanced trading data from DexScreener
            address: address,
            name: trading.name || token.name,
            symbol: trading.symbol || token.symbol,

            // Price data
            price: trading.price,
            priceNative: trading.priceNative,

            // Market data
            marketCap: trading.marketCap,
            fdv: trading.fdv,

            // Volume data
            volume24h: trading.volume24h,
            volume6h: trading.volume6h,
            volume1h: trading.volume1h,

            // Price changes
            priceChange24h: trading.priceChange24h,
            priceChange6h: trading.priceChange6h,
            priceChange1h: trading.priceChange1h,

            // Transaction data
            txns24h: trading.txns24h,
            buys24h: trading.buys24h,
            sells24h: trading.sells24h,

            // Liquidity
            liquidity: trading.liquidity,
            liquidityBase: trading.liquidityBase,
            liquidityQuote: trading.liquidityQuote,

            // Visual data
            icon: trading.icon || token.icon,
            header: trading.header,

            // Social links
            website: trading.website,
            twitter: trading.twitter,
            telegram: trading.telegram,
            discord: trading.discord,

            // DEX info
            dexId: trading.dexId,
            pairAddress: trading.pairAddress,
            url: trading.url,

            // Chain info
            chainId: trading.chainId,

            // Quote token info
            quoteToken: trading.quoteToken,

            // Pair creation time
            pairCreatedAt: trading.pairCreatedAt
          };
        } else {
          console.warn(`⚠️ No trading data found for token: ${address}`);
          return null;
        }
      }).filter(token => token !== null);

      console.log(`✅ Successfully enriched ${enrichedTokens.length}/${tokens.length} tokens`);
      return enrichedTokens.length > 0 ? enrichedTokens : this.getFallbackTokens();

    } catch (error) {
      console.error('❌ Error enriching tokens with trading data:', error);
      return this.getFallbackTokens();
    }
  }

  // Register token price with server
  async registerTokenPrice(address, symbol, price) {
    try {
      const response = await fetch('/api/prices/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address,
          symbol,
          price
        })
      });

      if (response.ok) {
        console.log(`✅ Registered ${symbol} price: $${price}`);
      } else {
        console.warn(`⚠️ Failed to register ${symbol} price`);
      }
    } catch (error) {
      console.error('❌ Error registering token price:', error);
    }
  }

  // Create instant tournament
  async createInstantTournament() {
    try {
      if (!authState.isAuthenticated) {
        showNotification('Please connect your wallet to create tournaments', 'warning');
        return;
      }

      console.log('🚀 Creating instant tournament...');
      showNotification('Creating instant tournament...', 'info');

      const response = await fetch('/api/tournaments/create-instant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        showNotification(result.message, 'success');
        console.log('✅ Instant tournament created:', result.tournament);

        // Refresh tournaments to show the new one
        await this.loadTournaments();

        // Auto-join the tournament if user wants
        setTimeout(() => {
          if (confirm('Tournament created! Would you like to join it now?')) {
            this.showJoinTournamentModal(result.tournament);
          }
        }, 1000);
      } else {
        showNotification(result.error || 'Failed to create instant tournament', 'error');
      }
    } catch (error) {
      console.error('❌ Error creating instant tournament:', error);
      showNotification('Failed to create instant tournament', 'error');
    }
  }

  // Get fallback tokens if API fails
  getFallbackTokens() {
    console.log('🔄 Using fallback tokens...');
    return [
      {
        address: 'So11111111111111111111111111111111111111112',
        name: 'Wrapped SOL',
        symbol: 'SOL',
        price: 180.50,
        icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        priceChange24h: 2.5,
        volume24h: 1500000000,
        marketCap: 85000000000
      },
      {
        address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        name: 'Jupiter',
        symbol: 'JUP',
        price: 0.85,
        icon: 'https://static.jup.ag/jup/icon.png',
        priceChange24h: -1.2,
        volume24h: 45000000,
        marketCap: 1200000000
      },
      {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        name: 'Bonk',
        symbol: 'BONK',
        price: 0.000025,
        icon: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
        priceChange24h: 5.8,
        volume24h: 25000000,
        marketCap: 1800000000
      }
    ];
  }

  // Load user's unclaimed prizes
  async loadUserPrizes() {
    try {
      if (!authState.walletAddress) return;

      console.log(`💰 Loading prizes for ${authState.walletAddress}`);

      const response = await fetch(`/api/prizes/unclaimed/${authState.walletAddress}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const unclaimedPrizes = await response.json();
      this.displayUserPrizes(unclaimedPrizes);

    } catch (error) {
      console.error('❌ Error loading user prizes:', error);
      // Don't show error notification as this is not critical
    }
  }

  // Display user's prizes
  displayUserPrizes(prizes) {
    const prizesSection = document.getElementById('prizesSection');
    const prizeCount = document.getElementById('prizeCount');
    const prizesContainer = document.getElementById('prizesContainer');

    if (!prizesSection || !prizeCount || !prizesContainer) return;

    if (prizes.length === 0) {
      prizesSection.style.display = 'none';
      return;
    }

    // Show prizes section
    prizesSection.style.display = 'block';
    prizeCount.textContent = prizes.length;

    // Clear container
    prizesContainer.innerHTML = '';

    prizes.forEach(prize => {
      const prizeCard = this.createPrizeCard(prize);
      prizesContainer.appendChild(prizeCard);
    });
  }

  // Create prize card element
  createPrizeCard(prize) {
    const card = document.createElement('div');
    card.className = 'prize-card';
    card.setAttribute('data-tournament-id', prize.tournamentId);

    const rankEmoji = prize.rank === 1 ? '🥇' : prize.rank === 2 ? '🥈' : '🥉';

    card.innerHTML = `
      <div class="prize-header">
        <div class="prize-rank">${rankEmoji} ${prize.rank}${this.getOrdinalSuffix(prize.rank)} Place</div>
        <div class="prize-tournament">${prize.tournament.name}</div>
      </div>

      <div class="prize-details">
        <div class="prize-amounts">
          ${prize.solPrize > 0 ? `
            <div class="prize-amount sol">
              <span class="amount">${prize.solPrize.toFixed(4)} SOL</span>
              <span class="label">Main Prize</span>
            </div>
          ` : ''}
          ${prize.swarsPrize > 0 ? `
            <div class="prize-amount swars">
              <span class="amount">${prize.swarsPrize.toFixed(0)} SWARS</span>
              <span class="label">Bonus Prize</span>
            </div>
          ` : ''}
        </div>

        <div class="prize-info">
          <div class="tournament-type">${prize.tournament.type}</div>
          <div class="tournament-date">${new Date(prize.tournament.endTime).toLocaleDateString()}</div>
        </div>
      </div>

      <div class="prize-actions">
        <button class="btn btn-primary claim-prize-btn" onclick="tournamentManager.claimPrize('${prize.tournamentId}')">
          <i class="fas fa-hand-holding-usd"></i>
          Claim Prize
        </button>
      </div>
    `;

    return card;
  }

  // Get ordinal suffix for numbers
  getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  // Claim a prize
  async claimPrize(tournamentId) {
    try {
      // Enhanced security checks
      if (!authState.walletAddress) {
        showNotification('Please connect your wallet first', 'error');
        return;
      }

      if (!authState.isAuthenticated) {
        showNotification('Please authenticate your wallet first', 'error');
        return;
      }

      // Prevent multiple simultaneous claims
      if (this.claimInProgress) {
        showNotification('Prize claim already in progress', 'warning');
        return;
      }

      console.log(`💰 Claiming prize for tournament ${tournamentId}`);

      // Set claim in progress flag
      this.claimInProgress = true;

      // Show loading state
      const claimBtn = document.querySelector(`[data-tournament-id="${tournamentId}"] .claim-prize-btn`);
      if (claimBtn) {
        claimBtn.disabled = true;
        claimBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending Prizes...';
      }

      const response = await fetch('/api/prizes/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress: authState.walletAddress,
          tournamentId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to claim prize');
      }

      const result = await response.json();

      // Show success notification with transaction hashes if available
      let message = `🎉 Prize claimed!`;
      if (result.solPrize > 0) {
        message += ` ${result.solPrize.toFixed(4)} SOL sent to your wallet!`;
      }
      if (result.swarsPrize > 0) {
        message += ` ${result.swarsPrize.toFixed(0)} SWARS tokens sent to your wallet!`;
      }
      if (result.transactionHashes && result.transactionHashes.length > 0) {
        const txHashes = result.transactionHashes.map(tx => `${tx.type}: ${tx.signature.substring(0, 8)}...`).join(', ');
        message += ` TX: ${txHashes}`;
      }

      showNotification(message, 'success');

      // Reload prizes to update display
      await this.loadUserPrizes();

      // Update SWARS balance
      if (window.loadSwarsBalance) {
        await window.loadSwarsBalance();
      }

    } catch (error) {
      console.error('❌ Error claiming prize:', error);
      showNotification(`Failed to claim prize: ${error.message}`, 'error');

      // Reset button state
      const claimBtn = document.querySelector(`[data-tournament-id="${tournamentId}"] .claim-prize-btn`);
      if (claimBtn) {
        claimBtn.disabled = false;
        claimBtn.innerHTML = '<i class="fas fa-hand-holding-usd"></i> Claim Prize';
      }
    } finally {
      // Always reset the claim in progress flag
      this.claimInProgress = false;
    }
  }

  // Process SOL prize transfer
  async processSolPrizeTransfer(solAmount) {
    try {
      console.log(`💸 Processing SOL prize transfer: ${solAmount} SOL`);

      // For demo mode, simulate the transfer
      if (!window.solana || !window.solana.isPhantom) {
        console.log('🎮 Demo mode: Simulating SOL prize transfer');

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        const demoTxHash = `demo_prize_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        showNotification(`Demo: Received ${solAmount.toFixed(4)} SOL prize!`, 'info');
        return demoTxHash;
      }

      // In production, this would receive SOL from the treasury wallet
      // For now, we'll simulate the transaction
      console.log('🎮 Simulating SOL prize receipt...');

      await new Promise(resolve => setTimeout(resolve, 2000));

      const simulatedTxHash = `prize_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      showNotification(`Received ${solAmount.toFixed(4)} SOL prize!`, 'success');

      return simulatedTxHash;

    } catch (error) {
      console.error('❌ Error processing SOL prize transfer:', error);
      throw error;
    }
  }

  // Load top traders for leaderboard display
  async loadTopTraders() {
    try {
      console.log('👑 Loading top traders...');
      const topTradersList = document.getElementById('topTradersList');
      const mainTopTradersContainer = document.getElementById('mainTopTradersContainer');

      // Show loading state for both sections
      if (topTradersList) {
        topTradersList.innerHTML = `
          <div class="loading-state">
            <i class="fas fa-crown"></i>
            <p>Loading top traders...</p>
          </div>
        `;
      }

      if (mainTopTradersContainer) {
        mainTopTradersContainer.innerHTML = `
          <div class="loading-state">
            <i class="fas fa-crown"></i>
            <p>Loading tournament champions...</p>
          </div>
        `;
      }

      const response = await fetch('/api/top-traders?limit=10');
      const topTraders = await response.json();

      if (topTraders && topTraders.length > 0) {
        console.log(`✅ Loaded ${topTraders.length} top traders`);
        this.displayTopTraders(topTraders);
        this.displayMainTopTraders(topTraders);
      } else {
        console.warn('⚠️ No top traders data available');
        this.showTopTradersEmpty();
        this.showMainTopTradersEmpty();
      }
    } catch (error) {
      console.error('❌ Error loading top traders:', error);
      this.showTopTradersError();
      this.showMainTopTradersError();
    }
  }

  // Display top traders in the UI
  displayTopTraders(traders) {
    const topTradersList = document.getElementById('topTradersList');
    if (!topTradersList) return;

    const tradersHTML = traders.map((trader, index) => {
      const rankClass = index < 3 ? `rank-${index + 1}` : '';
      const rankIcon = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${trader.rank}`;

      return `
        <div class="top-trader-item ${rankClass}">
          <div class="trader-rank">
            <span class="rank-icon">${rankIcon}</span>
          </div>
          <div class="trader-info">
            <div class="trader-name">${trader.username}</div>
            <div class="trader-stats">
              <span class="winnings">${trader.totalWinnings.toFixed(3)} SOL</span>
              <span class="win-rate">${trader.winRate.toFixed(1)}% WR</span>
            </div>
          </div>
          <div class="trader-details">
            <div class="tournaments-count">${trader.tournamentsWon}/${trader.tournamentsPlayed}</div>
            <div class="wallet-address">${trader.walletAddress.slice(0, 4)}...${trader.walletAddress.slice(-4)}</div>
          </div>
        </div>
      `;
    }).join('');

    topTradersList.innerHTML = tradersHTML;
  }

  // Show empty state for top traders
  showTopTradersEmpty() {
    const topTradersList = document.getElementById('topTradersList');
    if (!topTradersList) return;

    topTradersList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-crown"></i>
        <p>No tournament champions yet</p>
        <small>Be the first to win a tournament!</small>
      </div>
    `;
  }

  // Show error state for top traders
  showTopTradersError() {
    const topTradersList = document.getElementById('topTradersList');
    if (!topTradersList) return;

    topTradersList.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load top traders</p>
        <button class="btn btn-sm" onclick="window.tournamentManager.loadTopTraders()">
          <i class="fas fa-sync-alt"></i> Retry
        </button>
      </div>
    `;
  }

  // Display top traders in the main content area
  displayMainTopTraders(traders) {
    const mainTopTradersContainer = document.getElementById('mainTopTradersContainer');
    if (!mainTopTradersContainer) return;

    // Show top 6 traders in a horizontal grid layout
    const topSixTraders = traders.slice(0, 6);

    const tradersHTML = topSixTraders.map((trader, index) => {
      const rankClass = index < 3 ? `rank-${index + 1}` : '';
      const rankIcon = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

      return `
        <div class="main-trader-card ${rankClass}">
          <div class="trader-rank-badge">
            <span class="rank-icon">${rankIcon}</span>
          </div>
          <div class="trader-avatar">
            <div class="avatar-placeholder">
              ${trader.username.charAt(0).toUpperCase()}
            </div>
          </div>
          <div class="trader-details">
            <div class="trader-name">${trader.username}</div>
            <div class="trader-winnings">${trader.totalWinnings.toFixed(3)} SOL</div>
            <div class="trader-stats">
              <span class="win-rate">${trader.winRate.toFixed(1)}% WR</span>
              <span class="tournaments">${trader.tournamentsWon}W</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    mainTopTradersContainer.innerHTML = `
      <div class="main-traders-grid">
        ${tradersHTML}
      </div>
    `;
  }

  // Show empty state for main top traders
  showMainTopTradersEmpty() {
    const mainTopTradersContainer = document.getElementById('mainTopTradersContainer');
    if (!mainTopTradersContainer) return;

    mainTopTradersContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-crown"></i>
        <p>No tournament champions yet</p>
        <small>Be the first to win a tournament and claim your place in the hall of fame!</small>
      </div>
    `;
  }

  // Show error state for main top traders
  showMainTopTradersError() {
    const mainTopTradersContainer = document.getElementById('mainTopTradersContainer');
    if (!mainTopTradersContainer) return;

    mainTopTradersContainer.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load tournament champions</p>
        <button class="btn btn-sm" onclick="window.tournamentManager.loadTopTraders()">
          <i class="fas fa-sync-alt"></i> Retry
        </button>
      </div>
    `;
  }
}

// Global functions for modal controls
function closeTournamentInterface() {
  const modal = document.getElementById('tournamentInterfaceModal');
  if (modal) {
    modal.classList.remove('active');
  }

  // Stop tournament updates
  if (window.tournamentManager) {
    window.tournamentManager.stopTournamentUpdates();
  }
}

function closeJoinTournamentModal() {
  const modal = document.getElementById('joinTournamentModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function closeTokenDetailsModal() {
  const modal = document.getElementById('tokenDetailsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function closePrizeDetailsModal() {
  const modal = document.getElementById('prizeDetailsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Show How to Play modal
function showHowToPlayModal() {
  const modal = document.getElementById('howToPlayModal');
  if (modal) {
    modal.classList.add('active');
  }
}

// Close How to Play modal
function closeHowToPlayModal() {
  const modal = document.getElementById('howToPlayModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Toggle How to Play header section
function toggleHowToPlayHeader() {
  const section = document.getElementById('howToPlayHeaderSection');
  const button = document.querySelector('.how-to-play-header-btn');
  const chevron = document.getElementById('howToPlayChevron');

  if (section && button && chevron) {
    if (section.classList.contains('expanded')) {
      // Collapse
      section.classList.remove('expanded');
      button.classList.remove('expanded');
      chevron.className = 'fas fa-chevron-down';
    } else {
      // Expand
      section.classList.add('expanded');
      button.classList.add('expanded');
      chevron.className = 'fas fa-chevron-up';
    }
  }
}

// Show token details modal (placeholder for future implementation)
function showTokenDetails(tokenAddress) {
  console.log('Showing details for token:', tokenAddress);
  showNotification('Token details feature coming soon!', 'info');
}

// Initialize tournament manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.tournamentManager = new TournamentManager();
  console.log('🏆 Tournament Manager initialized');
});
