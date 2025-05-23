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
    for (const [tokenAddress, priceData] of Object.entries(this.realTimePrices)) {
      const priceElement = document.getElementById(`price-${tokenAddress}`);
      const changeElement = document.getElementById(`change-${tokenAddress}`);

      if (priceElement && priceData.price) {
        const oldPrice = parseFloat(priceElement.textContent.replace('$', '')) || 0;
        const newPrice = priceData.price;

        priceElement.textContent = `$${newPrice.toFixed(6)}`;

        // Add visual feedback for price changes
        if (oldPrice > 0 && oldPrice !== newPrice) {
          const changeClass = newPrice > oldPrice ? 'price-up' : 'price-down';
          priceElement.classList.add(changeClass);
          setTimeout(() => priceElement.classList.remove(changeClass), 1000);
        }
      }

      if (changeElement && priceData.priceChange24h !== undefined) {
        const change = priceData.priceChange24h;
        const changeClass = change >= 0 ? 'positive' : 'negative';
        const changeIcon = change >= 0 ? '↗' : '↘';

        changeElement.textContent = `${changeIcon} ${Math.abs(change).toFixed(2)}%`;
        changeElement.className = `price-change ${changeClass}`;
      }
    }
  }

  // Update portfolio value (placeholder for now)
  updatePortfolioValue() {
    // This will be called when prices update to recalculate portfolio values
    if (this.currentTournament && authState.isAuthenticated) {
      // Trigger portfolio reload if we're in a tournament
      this.loadUserPortfolio(this.currentTournament.id);
    }
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

  // Load active tournaments
  async loadTournaments() {
    try {
      console.log('🏆 Loading active tournaments...');
      const response = await fetch('/api/tournaments');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.tournaments) {
        this.activeTournaments = data.tournaments;
        console.log(`✅ Loaded ${data.tournaments.length} active tournaments`);

        // If showing my tournaments, also load user tournaments
        if (this.currentFilter === 'my-tournaments' && authState.isAuthenticated) {
          await this.loadUserTournaments();
        } else {
          // Apply current filter
          this.filterTournaments();
          this.displayTournaments();
        }
      } else {
        throw new Error(data.error || 'Failed to load tournaments');
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
    if (!container) return;

    container.innerHTML = '';

    // Use filtered tournaments for display
    const tournamentsToShow = this.filteredTournaments;

    if (tournamentsToShow.length === 0) {
      const filterText = this.currentFilter === 'all' ? 'tournaments' : `${this.currentFilter} tournaments`;
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-trophy" style="font-size: 48px; color: var(--primary); margin-bottom: 20px;"></i>
          <h3>No Active ${this.currentFilter === 'all' ? 'Tournaments' : this.currentFilter.charAt(0).toUpperCase() + this.currentFilter.slice(1) + ' Tournaments'}</h3>
          <p>Check back soon for epic trading battles!</p>
        </div>
      `;
      return;
    }

    tournamentsToShow.forEach(tournament => {
      const tournamentCard = this.createTournamentCard(tournament);
      container.appendChild(tournamentCard);
    });
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

      <div class="tournament-timing">
        <div class="time-info">
          <span class="time-label">${tournament.status === 'ACTIVE' ? 'Ends in' : 'Starts in'}</span>
          <span class="time-value">${tournament.status === 'ACTIVE' ? timeUntilEnd : timeUntilStart}</span>
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

      // Load user portfolio
      await this.loadUserPortfolio(tournamentId);

      // Load leaderboard
      this.updateLeaderboard(tournament.leaderboard || []);

      console.log('✅ Tournament interface loaded successfully');
    } catch (error) {
      console.error('❌ Error loading tournament interface:', error);
      showNotification('Failed to load tournament interface', 'error');
    }
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

        // Reload portfolio to get latest data
        await this.loadUserPortfolio(this.currentTournament.id);

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

        // Update UI
        await this.loadUserPortfolio(this.currentTournament.id);
        this.clearTradeInput(tokenAddress);
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

      // Update header
      const balance = document.getElementById('tournamentBalance');
      const profitLoss = document.getElementById('tournamentProfitLoss');

      if (balance) {
        const totalValue = portfolio.totalValue || portfolio.total || 0;
        balance.textContent = `$${totalValue.toFixed(2)}`;
      }

      if (profitLoss) {
        const profit = portfolio.profit || 0;
        const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
        const profitIcon = profit >= 0 ? '+' : '';
        profitLoss.textContent = `${profitIcon}$${profit.toFixed(2)}`;
        profitLoss.className = `value ${profitClass}`;
      }

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

  // Clear trade input
  clearTradeInput(tokenAddress) {
    const amountInput = document.getElementById(`amount-${tokenAddress}`);
    if (amountInput) {
      amountInput.value = '';
    }
  }

  // Start tournament updates
  startTournamentUpdates(tournamentId) {
    // Update portfolio every 10 seconds
    this.portfolioUpdateInterval = setInterval(async () => {
      await this.loadUserPortfolio(tournamentId);
    }, 10000);
  }

  // Stop tournament updates
  stopTournamentUpdates() {
    if (this.portfolioUpdateInterval) {
      clearInterval(this.portfolioUpdateInterval);
    }
  }

  // Format number for display
  formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(2);
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
