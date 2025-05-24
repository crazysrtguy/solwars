// Dashboard functionality for SolWars
class DashboardManager {
  constructor() {
    this.currentUser = null;
    this.profileImage = null;

    this.init();
  }

  async init() {
    console.log('🎯 Initializing Dashboard...');

    // Wait for auth to be ready
    if (typeof authState === 'undefined') {
      setTimeout(() => this.init(), 100);
      return;
    }

    // Wait for showNotification to be available
    if (typeof showNotification === 'undefined') {
      setTimeout(() => this.init(), 100);
      return;
    }

    this.setupEventListeners();

    // Check if wallet was previously connected
    await this.checkWalletConnection();

    this.loadUserProfile();
    this.loadUserStats();
    this.loadRecentActivity();

    // Update UI based on auth state
    if (authState.isAuthenticated) {
      this.showAuthenticatedState();
    } else {
      this.showUnauthenticatedState();
    }
  }

  async checkWalletConnection() {
    // Try to reconnect if wallet was previously connected
    if (typeof checkWalletConnection === 'function') {
      await checkWalletConnection();
    }
  }

  setupEventListeners() {
    // Profile image upload
    const imageUploadBtn = document.getElementById('imageUploadBtn');
    const imageUpload = document.getElementById('imageUpload');
    const removeImageBtn = document.getElementById('removeImageBtn');

    if (imageUploadBtn && imageUpload) {
      imageUploadBtn.addEventListener('click', () => imageUpload.click());
      imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));
    }

    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', () => this.removeProfileImage());
    }

    // Form inputs
    const username = document.getElementById('username');
    const xUsername = document.getElementById('xUsername');
    const bio = document.getElementById('bio');

    if (bio) {
      bio.addEventListener('input', () => this.updateBioCount());
    }

    // Form actions
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const resetProfileBtn = document.getElementById('resetProfileBtn');

    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', () => this.saveProfile());
    }

    if (resetProfileBtn) {
      resetProfileBtn.addEventListener('click', () => this.resetProfile());
    }

    // Quick actions
    const claimDailyBonusBtn = document.getElementById('claimDailyBonusBtn');
    const viewPrizesBtn = document.getElementById('viewPrizesBtn');

    if (claimDailyBonusBtn) {
      claimDailyBonusBtn.addEventListener('click', () => this.claimDailyBonus());
    }

    if (viewPrizesBtn) {
      viewPrizesBtn.addEventListener('click', () => this.viewPrizes());
    }

    // Modal handlers
    const closeLeaderboardModal = document.getElementById('closeLeaderboardModal');
    const refreshLeaderboardBtn = document.getElementById('refreshLeaderboardBtn');

    if (closeLeaderboardModal) {
      closeLeaderboardModal.addEventListener('click', () => {
        document.getElementById('leaderboardModal').classList.remove('active');
      });
    }

    if (refreshLeaderboardBtn) {
      refreshLeaderboardBtn.addEventListener('click', () => {
        if (typeof showLeaderboard === 'function') {
          showLeaderboard();
        }
      });
    }
  }

  async loadUserProfile() {
    if (!authState.isAuthenticated) return;

    try {
      console.log('👤 Loading user profile...');

      const response = await fetch(`/api/user/profile?wallet=${authState.walletAddress}`);
      const profile = await response.json();

      if (profile) {
        this.currentUser = profile;
        this.populateProfileForm(profile);
      }
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
    }
  }

  populateProfileForm(profile) {
    const username = document.getElementById('username');
    const xUsername = document.getElementById('xUsername');
    const bio = document.getElementById('bio');
    const profileImage = document.getElementById('profileImage');

    if (username && profile.username) {
      username.value = profile.username;
    }

    if (xUsername && profile.xUsername) {
      xUsername.value = profile.xUsername;
    }

    if (bio && profile.bio) {
      bio.value = profile.bio;
      this.updateBioCount();
    }

    if (profileImage && profile.profileImage) {
      this.displayProfileImage(profile.profileImage);
    }
  }

  async loadUserStats() {
    if (!authState.isAuthenticated) return;

    try {
      console.log('📊 Loading user stats...');

      const response = await fetch(`/api/user/stats?wallet=${authState.walletAddress}`);
      const stats = await response.json();

      if (stats) {
        this.displayUserStats(stats);
      }
    } catch (error) {
      console.error('❌ Error loading user stats:', error);
      this.displayDefaultStats();
    }
  }

  displayUserStats(stats) {
    const elements = {
      totalWinnings: document.getElementById('totalWinnings'),
      tournamentsWon: document.getElementById('tournamentsWon'),
      tournamentsPlayed: document.getElementById('tournamentsPlayed'),
      winRate: document.getElementById('winRate'),
      swarsBalance: document.getElementById('swarsBalance'),
      memberSince: document.getElementById('memberSince')
    };

    if (elements.totalWinnings) {
      elements.totalWinnings.textContent = (stats.totalWinnings || 0).toFixed(3);
    }

    if (elements.tournamentsWon) {
      elements.tournamentsWon.textContent = stats.tournamentsWon || 0;
    }

    if (elements.tournamentsPlayed) {
      elements.tournamentsPlayed.textContent = stats.tournamentsPlayed || 0;
    }

    if (elements.winRate) {
      const winRate = stats.tournamentsPlayed > 0 ?
        (stats.tournamentsWon / stats.tournamentsPlayed * 100) : 0;
      elements.winRate.textContent = `${winRate.toFixed(1)}%`;
    }

    if (elements.swarsBalance) {
      elements.swarsBalance.textContent = stats.swarsTokenBalance || 0;
    }

    if (elements.memberSince && stats.createdAt) {
      const date = new Date(stats.createdAt);
      elements.memberSince.textContent = date.toLocaleDateString();
    }
  }

  displayDefaultStats() {
    const defaultStats = {
      totalWinnings: 0,
      tournamentsWon: 0,
      tournamentsPlayed: 0,
      swarsTokenBalance: 0
    };
    this.displayUserStats(defaultStats);
  }

  async loadRecentActivity() {
    if (!authState.isAuthenticated) {
      this.showUnauthenticatedActivity();
      return;
    }

    try {
      console.log('📋 Loading recent activity...');

      const response = await fetch(`/api/user/activity?wallet=${authState.walletAddress}&limit=10`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const activities = await response.json();

      // Ensure activities is an array
      if (Array.isArray(activities)) {
        this.displayRecentActivity(activities);
      } else {
        console.warn('Activities response is not an array:', activities);
        this.displayRecentActivity([]);
      }
    } catch (error) {
      console.error('❌ Error loading recent activity:', error);
      this.showActivityError();
    }
  }

  displayRecentActivity(activities) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    if (!activities || activities.length === 0) {
      activityList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-history"></i>
          <p>No recent activity</p>
          <small>Join a tournament to start building your history!</small>
        </div>
      `;
      return;
    }

    const activitiesHTML = activities.map(activity => {
      const icon = this.getActivityIcon(activity.type);
      const timeAgo = this.getTimeAgo(activity.timestamp);

      return `
        <div class="activity-item">
          <div class="activity-icon">
            <i class="${icon}"></i>
          </div>
          <div class="activity-details">
            <div class="activity-description">${activity.description}</div>
            <div class="activity-time">${timeAgo}</div>
          </div>
          ${activity.amount ? `
            <div class="activity-amount ${activity.amount > 0 ? 'positive' : 'negative'}">
              ${activity.amount > 0 ? '+' : ''}${activity.amount.toFixed(3)} SOL
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    activityList.innerHTML = activitiesHTML;
  }

  getActivityIcon(type) {
    const icons = {
      'tournament_join': 'fas fa-sign-in-alt',
      'tournament_win': 'fas fa-trophy',
      'tournament_complete': 'fas fa-flag-checkered',
      'prize_claim': 'fas fa-gift',
      'daily_bonus': 'fas fa-calendar-check',
      'profile_update': 'fas fa-user-edit'
    };
    return icons[type] || 'fas fa-circle';
  }

  getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString();
  }

  showUnauthenticatedActivity() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    activityList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-wallet"></i>
        <p>Connect your wallet to view activity</p>
        <small>Your tournament history will appear here</small>
      </div>
    `;
  }

  showActivityError() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    activityList.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load activity</p>
        <button class="btn btn-sm" onclick="dashboardManager.loadRecentActivity()">
          <i class="fas fa-sync-alt"></i> Retry
        </button>
      </div>
    `;
  }

  handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      if (typeof showNotification === 'function') {
        showNotification('Please select a valid image file', 'error');
      } else {
        alert('Please select a valid image file');
      }
      return;
    }

    // Validate file size (max 2MB for better performance)
    if (file.size > 2 * 1024 * 1024) {
      if (typeof showNotification === 'function') {
        showNotification('Image size must be less than 2MB', 'error');
      } else {
        alert('Image size must be less than 2MB');
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      // Compress the image before storing
      this.compressImage(e.target.result, (compressedImage) => {
        this.profileImage = compressedImage;
        this.displayProfileImage(compressedImage);

        const removeBtn = document.getElementById('removeImageBtn');
        if (removeBtn) {
          removeBtn.style.display = 'block';
        }
      });
    };
    reader.readAsDataURL(file);
  }

  compressImage(imageSrc, callback) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Set smaller max dimensions for better compression
      const maxWidth = 200;
      const maxHeight = 200;

      let { width, height } = img;

      // Calculate new dimensions
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed JPEG with lower quality for smaller file size
      let compressedImage = canvas.toDataURL('image/jpeg', 0.6);

      // If still too large, compress further
      if (compressedImage.length > 100000) { // ~100KB
        compressedImage = canvas.toDataURL('image/jpeg', 0.4);
      }

      // If still too large, make it even smaller
      if (compressedImage.length > 100000) {
        canvas.width = Math.floor(width * 0.7);
        canvas.height = Math.floor(height * 0.7);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        compressedImage = canvas.toDataURL('image/jpeg', 0.3);
      }

      callback(compressedImage);
    };

    img.src = imageSrc;
  }

  displayProfileImage(imageSrc) {
    const profileImage = document.getElementById('profileImage');
    if (!profileImage) return;

    profileImage.innerHTML = `<img src="${imageSrc}" alt="Profile" />`;

    const removeBtn = document.getElementById('removeImageBtn');
    if (removeBtn) {
      removeBtn.style.display = 'block';
    }
  }

  removeProfileImage() {
    this.profileImage = null;

    const profileImage = document.getElementById('profileImage');
    if (profileImage) {
      profileImage.innerHTML = '<i class="fas fa-user"></i>';
    }

    const removeBtn = document.getElementById('removeImageBtn');
    if (removeBtn) {
      removeBtn.style.display = 'none';
    }

    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) {
      imageUpload.value = '';
    }
  }

  updateBioCount() {
    const bio = document.getElementById('bio');
    const bioCount = document.getElementById('bioCount');

    if (bio && bioCount) {
      bioCount.textContent = bio.value.length;
    }
  }

  async saveProfile() {
    if (!authState.isAuthenticated) {
      if (typeof showNotification === 'function') {
        showNotification('Please connect your wallet first', 'error');
      } else {
        alert('Please connect your wallet first');
      }
      return;
    }

    const usernameEl = document.getElementById('username');
    const xUsernameEl = document.getElementById('xUsername');
    const bioEl = document.getElementById('bio');

    if (!usernameEl || !xUsernameEl || !bioEl) {
      console.error('Form elements not found');
      return;
    }

    const username = usernameEl.value.trim();
    const xUsername = xUsernameEl.value.trim();
    const bio = bioEl.value.trim();

    // Validate username
    if (username && (username.length < 3 || username.length > 20)) {
      if (typeof showNotification === 'function') {
        showNotification('Username must be between 3 and 20 characters', 'error');
      } else {
        alert('Username must be between 3 and 20 characters');
      }
      return;
    }

    // Validate X username
    if (xUsername && (xUsername.length > 15 || !/^[a-zA-Z0-9_]+$/.test(xUsername))) {
      if (typeof showNotification === 'function') {
        showNotification('X username can only contain letters, numbers, and underscores', 'error');
      } else {
        alert('X username can only contain letters, numbers, and underscores');
      }
      return;
    }

    // Disable save button during save
    const saveBtn = document.getElementById('saveProfileBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
      console.log('💾 Saving profile...');

      const profileData = {
        walletAddress: authState.walletAddress,
        username: username || null,
        xUsername: xUsername || null,
        bio: bio || null,
        profileImage: this.profileImage || null
      };

      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        const result = await response.json();
        if (typeof showNotification === 'function') {
          showNotification('Profile saved successfully!', 'success');
        } else {
          alert('Profile saved successfully!');
        }
        this.currentUser = result;

        // Update auth state if username changed
        if (username && authState.user) {
          authState.user.username = username;
        }
        if (typeof updateAuthUI === 'function') {
          updateAuthUI();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('❌ Error saving profile:', error);
      if (typeof showNotification === 'function') {
        showNotification(`Failed to save profile: ${error.message}`, 'error');
      } else {
        alert(`Failed to save profile: ${error.message}`);
      }
    } finally {
      // Re-enable save button
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Profile';
      }
    }
  }

  resetProfile() {
    if (this.currentUser) {
      this.populateProfileForm(this.currentUser);
    } else {
      // Clear form
      const username = document.getElementById('username');
      const xUsername = document.getElementById('xUsername');
      const bio = document.getElementById('bio');

      if (username) username.value = '';
      if (xUsername) xUsername.value = '';
      if (bio) {
        bio.value = '';
        this.updateBioCount();
      }

      this.removeProfileImage();
    }
  }

  showAuthenticatedState() {
    // Enable all form elements
    const formElements = document.querySelectorAll('#username, #xUsername, #bio, #saveProfileBtn, #resetProfileBtn');
    formElements.forEach(el => {
      if (el) el.disabled = false;
    });
  }

  showUnauthenticatedState() {
    // Disable form elements and show connect wallet message
    const formElements = document.querySelectorAll('#username, #xUsername, #bio, #saveProfileBtn, #resetProfileBtn');
    formElements.forEach(el => {
      if (el) el.disabled = true;
    });

    this.displayDefaultStats();
    this.showUnauthenticatedActivity();
  }

  async claimDailyBonus() {
    if (!authState.isAuthenticated) {
      showNotification('Please connect your wallet first', 'error');
      return;
    }

    // Redirect to main page where daily bonus functionality exists
    window.location.href = 'index.html#daily-bonus';
  }

  async viewPrizes() {
    if (!authState.isAuthenticated) {
      showNotification('Please connect your wallet first', 'error');
      return;
    }

    // Redirect to main page where prizes functionality exists
    window.location.href = 'index.html#prizes';
  }
}

// Global functions for modal controls
function showHowToPlayModal() {
  const modal = document.getElementById('howToPlayModal');
  if (modal) {
    modal.classList.add('active');
  }
}

function closeHowToPlayModal() {
  const modal = document.getElementById('howToPlayModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dashboardManager = new DashboardManager();
});

// Make sure showNotification is available
if (typeof showNotification === 'undefined') {
  window.showNotification = function(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);

    const notification = document.getElementById('notification');
    if (notification) {
      notification.textContent = message;
      notification.className = `notification ${type}`;
      notification.style.display = 'block';

      setTimeout(() => {
        notification.style.display = 'none';
      }, 3000);
    }
  };
}
