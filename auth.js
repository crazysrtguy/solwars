// Solana wallet authentication and leaderboard functionality

// Global state for authentication
const authState = {
  isAuthenticated: false,
  walletAddress: null,
  user: null,
  challenge: null,
  connectionInProgress: false, // Flag to prevent multiple connection attempts
  swarsBalance: 0,
  canClaimDailyBonus: false
};

// Check if Phantom wallet is installed
const isPhantomInstalled = () => {
  return window.solana && window.solana.isPhantom;
};

// Check if wallet is already connected
const checkWalletConnection = async () => {
  if (!isPhantomInstalled()) {
    return false;
  }

  try {
    // Check if already connected
    const resp = await window.solana.connect({ onlyIfTrusted: true });
    if (resp && resp.publicKey) {
      authState.walletAddress = resp.publicKey.toString();
      authState.isAuthenticated = true;

      console.log('Wallet already connected:', authState.walletAddress);

      // Load SWARS data for already connected wallet
      await loadSwarsBalance();

      updateAuthUI();
      return true;
    }
  } catch (error) {
    // Not already connected, which is fine
    console.log('Wallet not already connected:', error.message);
  }

  return false;
};

// Connect to Phantom wallet
const connectWallet = async () => {
  // Prevent multiple connection attempts
  if (authState.connectionInProgress) {
    console.log('Connection already in progress, please wait...');
    return false;
  }

  if (!isPhantomInstalled()) {
    showNotification('Phantom wallet is not installed. Please install it to continue.', 'error');
    return false;
  }

  // Check if already connected first
  const isAlreadyConnected = await checkWalletConnection();
  if (isAlreadyConnected) {
    showNotification(`Already connected: ${shortenAddress(authState.walletAddress)}`, 'success');
    return true;
  }

  try {
    // Set connection in progress flag
    authState.connectionInProgress = true;

    // Connect to wallet
    const resp = await window.solana.connect();
    authState.walletAddress = resp.publicKey.toString();
    console.log('🔗 Connected to wallet:', authState.walletAddress);

    // Get challenge from server - only do this once
    if (!authState.challenge) {
      const challenge = await getChallenge();
      if (!challenge) {
        authState.connectionInProgress = false;
        return false;
      }
      authState.challenge = challenge;
    }

    // Sign the challenge
    const signedMessage = await signMessage(authState.challenge);
    if (!signedMessage) {
      authState.connectionInProgress = false;
      return false;
    }

    // Verify the signature with the server
    const verified = await verifySignature(authState.walletAddress, signedMessage, authState.challenge);
    if (verified) {
      authState.isAuthenticated = true;
      showNotification(`Connected: ${shortenAddress(authState.walletAddress)}`, 'success');
      updateAuthUI();

      // Store connection in localStorage to persist between sessions
      localStorage.setItem('solWarsWalletAddress', authState.walletAddress);

      authState.connectionInProgress = false;
      return true;
    } else {
      showNotification('Authentication failed', 'error');
      authState.connectionInProgress = false;
      return false;
    }
  } catch (error) {
    console.error('❌ Error connecting to wallet:', error);

    // Demo mode fallback
    if (error.message.includes('User rejected') || error.message.includes('cancelled')) {
      showNotification('Connection cancelled by user', 'warning');
    } else {
      console.log('🎮 Enabling demo mode for testing...');
      // Use demo wallet address for testing
      authState.walletAddress = 'Guc2c6ADvejYCt5GnPSVojFgZ4orFm3vMK3s4M3fRHQY';
      authState.isAuthenticated = true;
      authState.user = {
        id: 'demo_user',
        walletAddress: authState.walletAddress,
        username: 'Demo Trader'
      };

      showNotification(`Demo mode: ${shortenAddress(authState.walletAddress)}`, 'info');
      updateAuthUI();

      // Load demo SWARS balance
      authState.swarsBalance = 1000;
      authState.canClaimDailyBonus = true;
      updateSwarsUI();
    }

    authState.connectionInProgress = false;
    return authState.isAuthenticated;
  }
};

// Disconnect wallet
const disconnectWallet = () => {
  if (window.solana) {
    window.solana.disconnect();
  }

  // Clear auth state
  authState.isAuthenticated = false;
  authState.walletAddress = null;
  authState.user = null;
  authState.challenge = null;

  // Remove stored wallet address
  localStorage.removeItem('solWarsWalletAddress');

  updateAuthUI();
  showNotification('Disconnected from wallet', 'info');
};

// Get challenge from server
const getChallenge = async () => {
  try {
    const response = await fetch('/api/auth/challenge');
    const data = await response.json();
    authState.challenge = data.challenge;
    return data.challenge;
  } catch (error) {
    console.error('Error getting challenge:', error);
    showNotification('Failed to get authentication challenge', 'error');
    return null;
  }
};

// Sign message with Phantom wallet
const signMessage = async (message) => {
  try {
    console.log('Signing message:', message);

    // Convert message to Uint8Array
    const encodedMessage = new TextEncoder().encode(message);

    // Request signature from wallet
    console.log('Requesting signature from wallet...');
    const signedMessage = await window.solana.signMessage(encodedMessage, 'utf8');

    console.log('Message signed successfully');
    // Return the signature as a base58 string
    return signedMessage.signature;
  } catch (error) {
    console.error('Error signing message:', error);
    showNotification('Failed to sign message with wallet', 'error');
    return null;
  }
};

// Verify signature with server
const verifySignature = async (walletAddress, signature, challenge) => {
  try {
    console.log('Verifying signature with server...');
    console.log('Wallet address:', walletAddress);
    console.log('Challenge:', challenge);
    console.log('Signature (truncated):', signature ? signature.substring(0, 20) + '...' : 'none');

    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        signature,
        challenge,
      }),
    });

    const data = await response.json();
    console.log('Server verification response:', data);

    if (data.authenticated) {
      authState.user = data.user;
      console.log('Authentication successful, user:', authState.user);

      // Load SWARS balance and daily bonus status
      await loadSwarsBalance();

      return true;
    }

    console.log('Authentication failed');
    return false;
  } catch (error) {
    console.error('Error verifying signature:', error);
    showNotification('Failed to verify signature', 'error');
    return false;
  }
};

// Save game results to server
const saveGameResults = async (score, netWorth, days, completed = true) => {
  if (!authState.isAuthenticated || !authState.walletAddress) {
    console.log('User not authenticated, skipping save');
    return false;
  }

  try {
    const response = await fetch('/api/game/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: authState.walletAddress,
        score,
        netWorth,
        days,
        completed,
      }),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error saving game results:', error);
    showNotification('Failed to save game results', 'error');
    return false;
  }
};

// Get leaderboard data
const getLeaderboard = async () => {
  try {
    const response = await fetch('/api/leaderboard');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    showNotification('Failed to fetch leaderboard', 'error');
    return [];
  }
};

// Load SWARS balance and login streak status
const loadSwarsBalance = async () => {
  if (!authState.walletAddress) return;

  try {
    // Load SWARS balance
    const balanceResponse = await fetch(`/api/swars/balance/${authState.walletAddress}`);
    const balanceData = await balanceResponse.json();
    authState.swarsBalance = balanceData.balance || 0;

    // Load login streak information
    const streakResponse = await fetch(`/api/swars/streak/${authState.walletAddress}`);
    const streakData = await streakResponse.json();

    console.log('📊 Streak data received:', streakData); // Debug log

    authState.loginStreak = {
      currentStreak: streakData.currentStreak || 0,
      longestStreak: streakData.longestStreak || 0,
      totalLogins: streakData.totalLogins || 0,
      canClaimToday: streakData.canClaimToday !== false, // Default to true for new users
      nextDayBonus: streakData.nextDayBonus || 5
    };

    authState.canClaimDailyBonus = streakData.canClaimToday === true; // Explicit check for true

    console.log('🎯 Streak data from server:', streakData); // Debug log
    console.log('🎯 Can claim daily bonus:', authState.canClaimDailyBonus); // Debug log

    updateSwarsUI();
  } catch (error) {
    console.error('Error loading SWARS data:', error);
    // Fallback for compatibility
    const lastClaim = localStorage.getItem(`lastDailyBonus_${authState.walletAddress}`);
    const today = new Date().toDateString();
    authState.canClaimDailyBonus = lastClaim !== today;
    updateSwarsUI();
  }
};

// Claim daily bonus with progressive streak
const claimDailyBonus = async () => {
  if (!authState.isAuthenticated || !authState.canClaimDailyBonus) {
    showNotification('Daily bonus already claimed today!', 'warning');
    return;
  }

  try {
    const response = await fetch('/api/swars/daily-bonus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: authState.walletAddress
      })
    });

    const data = await response.json();

    if (data.success) {
      authState.swarsBalance += data.amount;
      authState.canClaimDailyBonus = false;

      // Update login streak info if available
      if (data.currentStreak !== undefined) {
        authState.loginStreak = {
          currentStreak: data.currentStreak,
          longestStreak: data.longestStreak,
          nextDayBonus: data.nextDayBonus,
          canClaimToday: false
        };
      }

      // Store claim date
      const today = new Date().toDateString();
      localStorage.setItem(`lastDailyBonus_${authState.walletAddress}`, today);

      // Enhanced notification with streak info
      let message = data.message || `🎁 Claimed ${data.amount} SWARS!`;
      if (data.currentStreak > 1) {
        message += ` 🔥 ${data.currentStreak} day streak!`;
      }
      if (data.nextDayBonus) {
        message += ` Tomorrow: ${data.nextDayBonus} SWARS`;
      }

      showNotification(message, 'success');
      updateSwarsUI();

      // Start countdown timer for next bonus
      const countdownDisplay = document.getElementById('countdownDisplay');
      if (countdownDisplay) {
        countdownDisplay.style.display = 'block';
        startCountdownTimer();
      }
    } else {
      showNotification(data.error || 'Failed to claim daily bonus', 'error');
    }
  } catch (error) {
    console.error('Error claiming daily bonus:', error);
    showNotification('Failed to claim daily bonus', 'error');
  }
};

// Update SWARS UI elements
const updateSwarsUI = () => {
  const swarsBalance = document.getElementById('swarsBalance');
  const swarsAmount = document.getElementById('swarsAmount');
  const dailyBonusBtn = document.getElementById('dailyBonusBtn');

  if (authState.isAuthenticated && authState.swarsBalance !== undefined) {
    if (swarsBalance) {
      swarsBalance.style.display = 'flex';
    }
    if (swarsAmount) {
      swarsAmount.textContent = authState.swarsBalance.toLocaleString();
    }
    if (dailyBonusBtn) {
      if (authState.canClaimDailyBonus) {
        dailyBonusBtn.style.display = 'block';
        dailyBonusBtn.disabled = false;
        dailyBonusBtn.classList.add('glow-animation');

        // Enhanced button text with streak info
        let buttonText = '<i class="fas fa-gift"></i> Claim Daily Bonus';
        if (authState.loginStreak && authState.loginStreak.currentStreak >= 0) {
          const nextDay = authState.loginStreak.currentStreak + 1;
          const nextBonus = authState.loginStreak.nextDayBonus || (nextDay * 5);
          buttonText = `<i class="fas fa-fire"></i> Day ${nextDay} (${nextBonus} SWARS)`;
        }
        dailyBonusBtn.innerHTML = buttonText;
      } else {
        // Show streak info even when can't claim
        if (authState.loginStreak && authState.loginStreak.currentStreak > 0) {
          dailyBonusBtn.style.display = 'block';
          dailyBonusBtn.disabled = true;
          dailyBonusBtn.classList.remove('glow-animation');
          dailyBonusBtn.innerHTML = `<i class="fas fa-check-circle"></i> Day ${authState.loginStreak.currentStreak} Complete`;
        } else {
          dailyBonusBtn.style.display = 'none';
        }
      }
    }
  } else {
    if (swarsBalance) {
      swarsBalance.style.display = 'none';
    }
    if (dailyBonusBtn) {
      dailyBonusBtn.style.display = 'none';
    }
  }

  // Update streak display
  updateStreakDisplay();
};

// Update streak display in UI
const updateStreakDisplay = () => {
  const streakDisplay = document.getElementById('streakDisplay');
  if (streakDisplay && authState.loginStreak && authState.isAuthenticated) {
    const streak = authState.loginStreak;
    streakDisplay.innerHTML = `
      <div class="streak-info">
        <div class="streak-current">
          <i class="fas fa-fire"></i>
          <span class="streak-number">${streak.currentStreak}</span>
          <span class="streak-label">Day Streak</span>
        </div>
        <div class="streak-details">
          <div class="streak-stat">
            <span class="stat-label">Longest:</span>
            <span class="stat-value">${streak.longestStreak}</span>
          </div>
          <div class="streak-stat">
            <span class="stat-label">Next Bonus:</span>
            <span class="stat-value">${streak.nextDayBonus || 5} SWARS</span>
          </div>
        </div>
      </div>
    `;
    streakDisplay.style.display = 'block';
  } else if (streakDisplay) {
    streakDisplay.style.display = 'none';
  }

  // Update main daily bonus section
  updateDailyBonusSection();
};

// Countdown timer variables
let countdownInterval = null;

// Update the main daily bonus section in sidebar
const updateDailyBonusSection = () => {
  const connectPrompt = document.getElementById('connectPrompt');
  const streakInfoCard = document.getElementById('streakInfoCard');
  const dailyBonusMainBtn = document.getElementById('dailyBonusMainBtn');
  const countdownDisplay = document.getElementById('countdownDisplay');

  if (!connectPrompt || !streakInfoCard || !dailyBonusMainBtn) return;

  if (!authState.isAuthenticated) {
    // Show connect prompt
    connectPrompt.style.display = 'block';
    streakInfoCard.style.display = 'none';
    dailyBonusMainBtn.style.display = 'none';
    if (countdownDisplay) countdownDisplay.style.display = 'none';

    // Clear countdown timer
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  } else {
    // Show streak info and bonus button
    connectPrompt.style.display = 'none';
    streakInfoCard.style.display = 'block';
    dailyBonusMainBtn.style.display = 'block';

    // Update streak info card
    if (authState.loginStreak) {
      const streak = authState.loginStreak;
      streakInfoCard.innerHTML = `
        <div class="streak-current">
          <i class="fas fa-fire"></i>
          <span class="streak-number">${streak.currentStreak}</span>
          <span class="streak-label">Day Streak</span>
        </div>
        <div class="streak-details">
          <div class="streak-stat">
            <span class="stat-label">Longest:</span>
            <span class="stat-value">${streak.longestStreak}</span>
          </div>
          <div class="streak-stat">
            <span class="stat-label">Total Logins:</span>
            <span class="stat-value">${streak.totalLogins || 0}</span>
          </div>
          <div class="streak-stat">
            <span class="stat-label">Next Bonus:</span>
            <span class="stat-value">${streak.nextDayBonus || 5} SWARS</span>
          </div>
        </div>
      `;
    }

    // Update bonus button and countdown
    if (authState.canClaimDailyBonus) {
      dailyBonusMainBtn.disabled = false;
      dailyBonusMainBtn.classList.add('glow-animation');
      if (countdownDisplay) countdownDisplay.style.display = 'none';

      // Clear countdown timer
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }

      let buttonText = '<i class="fas fa-gift"></i> Claim Daily Bonus';
      if (authState.loginStreak && authState.loginStreak.currentStreak >= 0) {
        const nextDay = authState.loginStreak.currentStreak + 1;
        const nextBonus = authState.loginStreak.nextDayBonus || (nextDay * 5);
        buttonText = `<i class="fas fa-fire"></i> Claim Day ${nextDay} (${nextBonus} SWARS)`;
      }
      dailyBonusMainBtn.innerHTML = buttonText;
    } else {
      dailyBonusMainBtn.disabled = true;
      dailyBonusMainBtn.classList.remove('glow-animation');

      if (authState.loginStreak && authState.loginStreak.currentStreak > 0) {
        dailyBonusMainBtn.innerHTML = `<i class="fas fa-check-circle"></i> Day ${authState.loginStreak.currentStreak} Complete`;
      } else {
        dailyBonusMainBtn.innerHTML = '<i class="fas fa-clock"></i> Come back tomorrow';
      }

      // Show countdown timer
      if (countdownDisplay) {
        countdownDisplay.style.display = 'block';
        startCountdownTimer();
      }
    }
  }
};

// Start countdown timer for next daily bonus
const startCountdownTimer = () => {
  // Clear existing timer
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  const updateCountdown = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Set to midnight

    const timeLeft = tomorrow.getTime() - now.getTime();

    if (timeLeft <= 0) {
      // Time's up! Refresh the bonus status
      if (authState.isAuthenticated) {
        loadSwarsBalance();
      }
      return;
    }

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Update countdown display
    const hoursElement = document.getElementById('hoursLeft');
    const minutesElement = document.getElementById('minutesLeft');
    const secondsElement = document.getElementById('secondsLeft');

    if (hoursElement) hoursElement.textContent = hours.toString().padStart(2, '0');
    if (minutesElement) minutesElement.textContent = minutes.toString().padStart(2, '0');
    if (secondsElement) secondsElement.textContent = seconds.toString().padStart(2, '0');
  };

  // Update immediately
  updateCountdown();

  // Update every second
  countdownInterval = setInterval(updateCountdown, 1000);
};

// Update UI based on authentication state
const updateAuthUI = () => {
  const authButton = document.getElementById('authButton');
  const userInfo = document.getElementById('userInfo');

  if (!authButton || !userInfo) {
    console.warn('Auth UI elements not found');
    return;
  }

  if (authState.isAuthenticated) {
    authButton.textContent = 'Disconnect Wallet';
    authButton.onclick = disconnectWallet;

    const displayName = authState.user?.username || shortenAddress(authState.walletAddress);
    userInfo.innerHTML = `
      <div class="user-info-container">
        <span class="user-name">${displayName}</span>
        <span class="wallet-address">${shortenAddress(authState.walletAddress)}</span>
      </div>
    `;
    userInfo.style.display = 'block';
  } else {
    authButton.textContent = 'Connect Wallet';
    authButton.onclick = connectWallet;
    userInfo.style.display = 'none';
  }

  // Update SWARS UI
  updateSwarsUI();

  // Update My Tournaments button visibility
  if (window.tournamentManager) {
    window.tournamentManager.updateMyTournamentsButton();

    // Load user prizes when authenticated
    if (authState.isAuthenticated) {
      window.tournamentManager.loadUserPrizes();
    }
  }
};

// Show leaderboard modal
const showLeaderboard = async () => {
  const leaderboardData = await getLeaderboard();

  const modal = document.getElementById('leaderboardModal');
  const leaderboardList = document.getElementById('leaderboardList');

  if (!modal || !leaderboardList) {
    console.warn('Leaderboard elements not found');
    return;
  }

  // Clear existing entries
  leaderboardList.innerHTML = '';

  // Add leaderboard entries
  if (leaderboardData.length === 0) {
    leaderboardList.innerHTML = '<div class="empty-state">No leaderboard entries yet. Be the first!</div>';
  } else {
    leaderboardData.forEach((entry, index) => {
      const listItem = document.createElement('div');
      listItem.className = 'leaderboard-item';

      // Highlight current user
      if (authState.walletAddress && entry.walletAddress === authState.walletAddress) {
        listItem.classList.add('current-user');
      }

      listItem.innerHTML = `
        <div class="leaderboard-rank">${index + 1}</div>
        <div class="leaderboard-user">
          <div class="leaderboard-username">${entry.username}</div>
          <div class="leaderboard-wallet">${shortenAddress(entry.walletAddress)}</div>
        </div>
        <div class="leaderboard-score">${entry.highScore.toLocaleString('en-US', {maximumFractionDigits: 2})} CR</div>
      `;

      leaderboardList.appendChild(listItem);
    });
  }

  // Show the modal
  modal.classList.add('active');
};

// Helper function to shorten wallet address
const shortenAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

// Initialize auth UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Setup daily bonus buttons
  const dailyBonusBtn = document.getElementById('dailyBonusBtn');
  if (dailyBonusBtn) {
    dailyBonusBtn.addEventListener('click', claimDailyBonus);
  }

  const dailyBonusMainBtn = document.getElementById('dailyBonusMainBtn');
  if (dailyBonusMainBtn) {
    dailyBonusMainBtn.addEventListener('click', claimDailyBonus);
  }

  // Debug button for testing
  const debugBonusBtn = document.getElementById('debugBonusBtn');
  if (debugBonusBtn) {
    debugBonusBtn.addEventListener('click', () => {
      console.log('🔧 Debug: Forcing daily bonus to be claimable');
      authState.canClaimDailyBonus = true;
      if (authState.loginStreak) {
        authState.loginStreak.canClaimToday = true;
      }
      updateSwarsUI();
      showNotification('Debug: Daily bonus enabled!', 'success');
    });
  }

  // Check if wallet was previously connected
  if (isPhantomInstalled()) {
    // Check for stored wallet address
    const storedWalletAddress = localStorage.getItem('solWarsWalletAddress');
    if (storedWalletAddress) {
      console.log('Found stored wallet address:', storedWalletAddress);
      // Try to reconnect with the stored address
      checkWalletConnection().then(connected => {
        if (connected) {
          console.log('Successfully reconnected to wallet');
        } else {
          console.log('Could not automatically reconnect to wallet');
          // Clear stored address if we couldn't reconnect
          localStorage.removeItem('solWarsWalletAddress');
        }
      });
    } else {
      updateAuthUI();
    }
  }
});
