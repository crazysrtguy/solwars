// Initialize global variables
window.currentModalAction = null;

// Game data and state
const gameData = {
  // Token definitions
  tokens: {
    KYBER: {
      name: "KYBER",
      shortCode: "KB",
      unit: "crystals",
      basePrice: 10,
      volatility: 0.15, // How much the price can fluctuate
      locationModifiers: {
        "Coruscant": 1.0,
        "Tatooine": 1.25, // Increased from 1.15
        "Endor": 0.90,
        "Hoth": 0.85,
        "Bespin": 1.10, // Increased from 1.05
        "Kamino": 0.95
      }
    },
    BANTHA: {
      name: "BANTHA",
      shortCode: "BT",
      unit: "herds",
      basePrice: 50,
      volatility: 0.12,
      locationModifiers: {
        "Coruscant": 1.0,
        "Tatooine": 0.85, // Decreased from 0.90
        "Endor": 1.30, // Increased from 1.12
        "Hoth": 0.80,
        "Bespin": 0.95,
        "Kamino": 1.05
      }
    },
    WAMPA: {
      name: "WAMPA",
      shortCode: "WP",
      unit: "pelts",
      basePrice: 25,
      volatility: 0.18,
      locationModifiers: {
        "Coruscant": 1.0,
        "Tatooine": 0.90,
        "Endor": 0.85,
        "Hoth": 1.35, // Increased from 1.08
        "Bespin": 0.95,
        "Kamino": 1.05
      }
    },
    TROOPER: {
      name: "TROOPER",
      shortCode: "TR",
      unit: "units",
      basePrice: 5,
      volatility: 0.10,
      locationModifiers: {
        "Coruscant": 1.0,
        "Tatooine": 0.90,
        "Endor": 0.95,
        "Hoth": 0.85,
        "Bespin": 1.05,
        "Kamino": 1.40 // Increased from 1.25
      }
    },
    JAWA: {
      name: "JAWA",
      shortCode: "JW",
      unit: "traders",
      basePrice: 15,
      volatility: 0.14,
      locationModifiers: {
        "Coruscant": 1.0,
        "Tatooine": 1.35, // Increased from 1.20
        "Endor": 0.90,
        "Hoth": 0.80,
        "Bespin": 1.00, // Increased from 0.95
        "Kamino": 0.90
      }
    }
  },

  // Locations
  locations: [
    {
      name: "Coruscant",
      icon: "fas fa-city",
      description: "The central hub with standard pricing.",
      travelCost: 0,
      riskLevel: "Low"
    },
    {
      name: "Tatooine",
      icon: "fas fa-mountain",
      description: "Desert planet with high KYBER and JAWA prices.",
      travelCost: 10, // Increased from 50
      riskLevel: "Medium",
      advantage: "+25% KYBER, +35% JAWA" // Updated to match new modifiers
    },
    {
      name: "Endor",
      icon: "fas fa-tree",
      description: "Forest moon with high BANTHA prices.",
      travelCost: 30, // Increased from 75
      riskLevel: "Medium",
      advantage: "+30% BANTHA" // Updated to match new modifiers
    },
    {
      name: "Hoth",
      icon: "fas fa-snowflake",
      description: "Ice planet with high WAMPA prices.",
      travelCost: 60, // Increased from 100
      riskLevel: "High",
      advantage: "+35% WAMPA" // Updated to match new modifiers
    },
    {
      name: "Bespin",
      icon: "fas fa-cloud",
      description: "Gas giant with higher risk but good prices.",
      travelCost: 100, // Increased from 125
      riskLevel: "Very High",
      advantage: "+10% KYBER, +5% TROOPER" // Updated to match new modifiers
    },
    {
      name: "Kamino",
      icon: "fas fa-water",
      description: "Ocean planet with high TROOPER prices.",
      travelCost: 200, // Increased from 150
      riskLevel: "Medium",
      advantage: "+40% TROOPER" // Updated to match new modifiers
    }
  ],

  // Events that can occur
  events: [
    {
      title: "Imperial Raid",
      description: "Imperial forces seized {TOKEN} shipments! Price dropped temporarily.",
      effect: { type: "price", change: -0.4, duration: 2 } // Increased from -0.3
    },
    {
      title: "Rebel Alliance Contract",
      description: "Rebel Alliance placed a large order for {TOKEN}! Price increased significantly.",
      effect: { type: "price", change: 0.5, duration: 2 } // Increased from 0.25
    },
    {
      title: "Trade Federation Blockade",
      description: "Trade Federation blockaded {LOCATION}! Travel costs increased.",
      effect: { type: "travel", change: 2.0, duration: 3 } // Increased from 1.5
    },
    {
      title: "Smuggler's Run",
      description: "Smugglers flooded the market with {TOKEN}! Price dropped.",
      effect: { type: "price", change: -0.3, duration: 1 } // Increased from -0.2
    },
    {
      title: "Hutt Cartel Interest",
      description: "Hutt Cartel raised interest rates! Debt increased by 15%.",
      effect: { type: "debt", change: 0.15, duration: 0 } // Increased from 0.1
    },
    {
      title: "Black Market Opportunity",
      description: "A black market opportunity for {TOKEN} has emerged! Price doubled temporarily.",
      effect: { type: "price", change: 1.0, duration: 1 } // New event
    },
    {
      title: "Imperial Bounty",
      description: "The Empire is offering a bounty for {TOKEN}! Price increased dramatically.",
      effect: { type: "price", change: 0.75, duration: 2 } // New event
    }
  ]
};

// Player state
let gameState = {
  currentLocation: "Coruscant",
  day: 1,
  maxDays: 30,
  credits: 2000, // Increased from 1000 to 2000
  debt: 2000, // Decreased from 3500 to 2000
  cargoCapacity: 500, // Increased from 200 to 500
  currentCargo: 0,
  inventory: {
    KYBER: 0,
    WAMPA: 0,
    TROOPER: 0,
    BANTHA: 0,
    JAWA: 0
  }, // Start with empty inventory to make it more challenging
  prices: {}, // Current prices for each token at each location
  events: [], // Active events
  eventLog: ["Cycle 1: Welcome to SolWars: Galactic Trading!"]
};

// Initialize prices
function initializePrices() {
  gameState.prices = {};

  // For each location
  gameData.locations.forEach(location => {
    gameState.prices[location.name] = {};

    // For each token
    Object.keys(gameData.tokens).forEach(tokenKey => {
      const token = gameData.tokens[tokenKey];
      const basePrice = token.basePrice;
      const locationModifier = token.locationModifiers[location.name];

      // Apply random fluctuation within volatility range
      const volatilityFactor = 1 + (Math.random() * token.volatility * 2 - token.volatility);

      // Calculate final price
      const price = basePrice * locationModifier * volatilityFactor;

      gameState.prices[location.name][tokenKey] = price;
    });
  });
}

// Calculate net worth
function calculateNetWorth() {
  let tokenValue = 0;

  // Calculate value of all tokens in inventory
  Object.keys(gameState.inventory).forEach(tokenKey => {
    const amount = gameState.inventory[tokenKey];
    const price = gameState.prices[gameState.currentLocation][tokenKey];
    tokenValue += amount * price;
  });

  return gameState.credits + tokenValue - gameState.debt;
}

// Update prices for a new day
function updatePrices() {
  // For each location
  gameData.locations.forEach(location => {
    // For each token
    Object.keys(gameData.tokens).forEach(tokenKey => {
      const token = gameData.tokens[tokenKey];
      const currentPrice = gameState.prices[location.name][tokenKey];

      // Apply random fluctuation within volatility range
      const volatilityFactor = 1 + (Math.random() * token.volatility * 2 - token.volatility);

      // Calculate new price
      const newPrice = currentPrice * volatilityFactor;

      // Apply any active event effects
      const activeEvents = gameState.events.filter(event =>
        event.effect.type === "price" && event.token === tokenKey
      );

      let eventModifier = 1;
      activeEvents.forEach(event => {
        eventModifier += event.effect.change;
      });

      gameState.prices[location.name][tokenKey] = newPrice * eventModifier;
    });
  });
}

// Buy token
function buyToken(tokenKey, amount) {
  console.log(`Buying ${amount} ${tokenKey}...`);

  // Validate inputs - these should already be validated in the confirmation handler
  if (!tokenKey || !amount || amount <= 0) {
    console.error("Invalid inputs:", tokenKey, amount);
    return false;
  }

  // Check if token exists
  if (!gameData.tokens[tokenKey]) {
    console.error("Token does not exist:", tokenKey);
    return false;
  }

  const token = gameData.tokens[tokenKey];
  const price = gameState.prices[gameState.currentLocation][tokenKey];
  const cost = price * amount;

  console.log(`Token: ${token.name}, Price: ${price}, Cost: ${cost}`);
  console.log(`Current credits: ${gameState.credits}, Current cargo: ${gameState.currentCargo}/${gameState.cargoCapacity}`);

  // These checks should already be done in the confirmation handler
  // but we'll keep them as a safety measure
  if (cost > gameState.credits) {
    console.log("Not enough credits!");
    return false;
  }

  if (gameState.currentCargo + amount > gameState.cargoCapacity) {
    console.log("Not enough cargo space!");
    return false;
  }

  // Update player state
  const oldCredits = gameState.credits;
  const oldInventory = gameState.inventory[tokenKey] || 0;
  const oldCargo = gameState.currentCargo;

  gameState.credits -= cost;
  if (!gameState.inventory[tokenKey]) {
    gameState.inventory[tokenKey] = 0;
  }
  gameState.inventory[tokenKey] += amount;
  gameState.currentCargo += amount;

  console.log(`Credits: ${oldCredits} -> ${gameState.credits}`);
  console.log(`Inventory ${tokenKey}: ${oldInventory} -> ${gameState.inventory[tokenKey]}`);
  console.log(`Cargo: ${oldCargo} -> ${gameState.currentCargo}`);

  // Log the transaction
  gameState.eventLog.unshift(`Cycle ${gameState.day}: Purchased ${amount.toLocaleString()} ${token.name} ${token.unit} for ${cost.toFixed(2)} CR.`);

  // Update UI
  console.log("Updating UI...");
  updateUI();
  return true;
}

// Sell token
function sellToken(tokenKey, amount) {
  console.log(`Selling ${amount} ${tokenKey}...`);

  // Validate inputs - these should already be validated in the confirmation handler
  if (!tokenKey || !amount || amount <= 0) {
    console.error("Invalid inputs:", tokenKey, amount);
    return false;
  }

  // Check if token exists
  if (!gameData.tokens[tokenKey]) {
    console.error("Token does not exist:", tokenKey);
    return false;
  }

  const token = gameData.tokens[tokenKey];
  const price = gameState.prices[gameState.currentLocation][tokenKey];

  console.log(`Token: ${token.name}, Price: ${price}`);
  console.log(`Current inventory: ${gameState.inventory[tokenKey] || 0}`);

  // This check should already be done in the confirmation handler
  // but we'll keep it as a safety measure
  if (amount > gameState.inventory[tokenKey]) {
    console.log(`Not enough ${token.name} to sell!`);
    return false;
  }

  const revenue = price * amount;
  console.log(`Revenue: ${revenue}`);

  // Update player state
  const oldCredits = gameState.credits;
  const oldInventory = gameState.inventory[tokenKey];
  const oldCargo = gameState.currentCargo;

  gameState.credits += revenue;
  gameState.inventory[tokenKey] -= amount;
  gameState.currentCargo -= amount;

  console.log(`Credits: ${oldCredits} -> ${gameState.credits}`);
  console.log(`Inventory ${tokenKey}: ${oldInventory} -> ${gameState.inventory[tokenKey]}`);
  console.log(`Cargo: ${oldCargo} -> ${gameState.currentCargo}`);

  // Log the transaction
  gameState.eventLog.unshift(`Cycle ${gameState.day}: Sold ${amount.toLocaleString()} ${token.name} ${token.unit} for ${revenue.toFixed(2)} CR.`);

  // Update UI
  console.log("Updating UI...");
  updateUI();
  return true;
}

// Travel to a new location
function travelToLocation(locationName) {
  console.log(`Traveling to ${locationName}...`);
  const location = gameData.locations.find(loc => loc.name === locationName);

  if (!location) {
    console.error(`Location ${locationName} not found`);
    showNotification(`Invalid location: ${locationName}`, "error");
    return false;
  }

  // Check if player has enough credits for travel cost
  if (location.travelCost > gameState.credits) {
    console.log(`Not enough credits: ${gameState.credits} < ${location.travelCost}`);
    showNotification(`Not enough credits to travel to ${locationName}! You need ${location.travelCost.toFixed(2)} CR but only have ${gameState.credits.toFixed(2)} CR.`, "error");

    // Keep the travel modal open so the user can see the cost
    const travelModal = document.getElementById('travelModal');
    if (travelModal) {
      // Highlight the travel cost in the modal
      const modalContent = travelModal.querySelector('p');
      if (modalContent) {
        const costText = `${location.travelCost} CR`;
        modalContent.innerHTML = modalContent.innerHTML.replace(
          costText,
          `<span style="color: red; font-weight: bold;">${location.travelCost} CR</span>`
        );
      }
    }

    return false;
  }

  // Close the travel modal
  const travelModal = document.getElementById('travelModal');
  if (travelModal) {
    travelModal.classList.remove('active');
  }

  // Show space travel animation
  showSpaceTravelAnimation(locationName, () => {
    // This callback runs after the animation completes

    // Update player state
    gameState.credits -= location.travelCost;
    gameState.currentLocation = locationName;
    gameState.day += 1;

    // Apply interest to debt when time passes
    applyDebtInterest();

    console.log(`Updated game state: location=${gameState.currentLocation}, day=${gameState.day}, credits=${gameState.credits}, debt=${gameState.debt}`);

    // Update active location in UI
    const locationItems = document.querySelectorAll('.location-item');
    locationItems.forEach(item => {
      item.classList.remove('active');
      const itemLocationName = item.querySelector('.location-info').textContent.trim().replace(/^\S+\s+/, '');
      if (itemLocationName === locationName) {
        item.classList.add('active');
        // Add location label
        const existingLabel = item.querySelector('.location-label');
        if (!existingLabel) {
          const label = document.createElement('span');
          label.className = 'location-label';
          label.textContent = 'Current';
          item.appendChild(label);
        }
      } else {
        // Remove location label if exists
        const existingLabel = item.querySelector('.location-label');
        if (existingLabel) {
          item.removeChild(existingLabel);
        }
      }
    });

    // Check for game over
    if (gameState.day >= gameState.maxDays) {
      console.log(`Game over: Day ${gameState.day} reached max days ${gameState.maxDays}`);
      endGame();
      return true;
    }

    // Update prices
    updatePrices();

    // Process events
    processEvents();

    // Log the travel
    gameState.eventLog.unshift(`Cycle ${gameState.day}: Traveled to ${locationName} for ${location.travelCost.toFixed(2)} CR.`);

    // Update UI
    updateUI();
    showNotification(`Arrived at ${locationName}!`, "success");
  });

  return true;
}

// Show space travel animation using video
function showSpaceTravelAnimation(destinationName, callback) {
  console.log(`Starting space travel animation to ${destinationName}...`);

  // Get the overlay, video, and destination text elements
  const overlay = document.getElementById('spaceTravelOverlay');
  const video = document.getElementById('travelVideo');
  const destinationText = document.getElementById('destinationName');
  const starWarsTheme = document.getElementById('starWarsTheme');

  if (!overlay || !video || !destinationText) {
    console.error('Space travel animation elements not found');
    if (callback) callback();
    return;
  }

  // Set the destination name
  destinationText.textContent = destinationName;

  // Store the current state of the main music
  const wasMusicPlaying = starWarsTheme && !starWarsTheme.paused;
  const musicVolume = starWarsTheme ? starWarsTheme.volume : 0;

  // Pause the main music if it's playing
  if (wasMusicPlaying && starWarsTheme) {
    console.log('Pausing main music for travel video');
    starWarsTheme.pause();
  }

  // Set up video volume controls
  const videoVolumeBtn = document.getElementById('videoVolumeBtn');
  const videoVolumeSlider = document.getElementById('videoVolumeSlider');

  // Set initial video volume (70%)
  video.volume = 0.7;

  // Update volume when slider changes
  if (videoVolumeSlider) {
    videoVolumeSlider.value = video.volume * 100;

    videoVolumeSlider.addEventListener('input', () => {
      const volumeValue = videoVolumeSlider.value / 100;
      video.volume = volumeValue;

      // Update volume button icon
      if (videoVolumeBtn) {
        const volumeIcon = videoVolumeBtn.querySelector('i');
        if (volumeIcon) {
          if (volumeValue === 0) {
            volumeIcon.className = 'fas fa-volume-mute';
          } else if (volumeValue < 0.5) {
            volumeIcon.className = 'fas fa-volume-down';
          } else {
            volumeIcon.className = 'fas fa-volume-up';
          }
        }
      }
    });
  }

  // Toggle mute when volume button is clicked
  if (videoVolumeBtn) {
    videoVolumeBtn.addEventListener('click', () => {
      const volumeIcon = videoVolumeBtn.querySelector('i');
      if (video.volume > 0) {
        // Store current volume before muting
        video.dataset.previousVolume = video.volume;
        video.volume = 0;
        if (volumeIcon) volumeIcon.className = 'fas fa-volume-mute';
        if (videoVolumeSlider) videoVolumeSlider.value = 0;
      } else {
        // Restore previous volume
        const previousVolume = parseFloat(video.dataset.previousVolume || 0.7);
        video.volume = previousVolume;
        if (volumeIcon) {
          if (previousVolume < 0.5) {
            volumeIcon.className = 'fas fa-volume-down';
          } else {
            volumeIcon.className = 'fas fa-volume-up';
          }
        }
        if (videoVolumeSlider) videoVolumeSlider.value = previousVolume * 100;
      }
    });
  }

  // Get video duration when metadata is loaded
  const handleMetadata = () => {
    // Get video duration
    const videoDuration = video.duration;
    console.log(`Video duration: ${videoDuration} seconds`);

    if (videoDuration > 8) {
      // Calculate a random start time (leave at least 8 seconds of video)
      const maxStartTime = videoDuration - 8;
      const randomStartTime = Math.random() * maxStartTime;
      console.log(`Playing video from ${randomStartTime} to ${randomStartTime + 8} seconds`);

      // Set the start time
      video.currentTime = randomStartTime;

      // Show the overlay
      overlay.classList.add('active');

      // Play the video
      video.play().catch(error => {
        console.error('Error playing video:', error);
        // If video fails to play, resume music and call the callback
        if (wasMusicPlaying && starWarsTheme) {
          starWarsTheme.volume = musicVolume;
          starWarsTheme.play().catch(e => console.log('Error resuming music:', e));
        }
        if (callback) callback();
      });

      // Set timeout to hide overlay and call callback after 8 seconds
      setTimeout(() => {
        // Pause the video
        video.pause();

        // Hide the overlay
        overlay.classList.remove('active');

        // Resume the main music if it was playing before
        if (wasMusicPlaying && starWarsTheme) {
          console.log('Resuming main music after travel video');
          starWarsTheme.volume = musicVolume;
          starWarsTheme.play().catch(e => console.log('Error resuming music:', e));

          // Update the sound icon if it exists
          const soundIcon = document.getElementById('soundIcon');
          if (soundIcon) {
            soundIcon.className = 'fas fa-volume-up';
          }
        }

        // Call the callback
        if (callback) callback();
      }, 10000);
    } else {
      console.warn('Video is shorter than 8 seconds, playing entire video');

      // Show the overlay
      overlay.classList.add('active');

      // Play the video
      video.play().catch(error => {
        console.error('Error playing video:', error);
        // If video fails to play, resume music and call the callback
        if (wasMusicPlaying && starWarsTheme) {
          starWarsTheme.volume = musicVolume;
          starWarsTheme.play().catch(e => console.log('Error resuming music:', e));
        }
        if (callback) callback();
      });

      // Set timeout to hide overlay and call callback after video ends
      video.onended = () => {
        // Hide the overlay
        overlay.classList.remove('active');

        // Resume the main music if it was playing before
        if (wasMusicPlaying && starWarsTheme) {
          console.log('Resuming main music after travel video');
          starWarsTheme.volume = musicVolume;
          starWarsTheme.play().catch(e => console.log('Error resuming music:', e));

          // Update the sound icon if it exists
          const soundIcon = document.getElementById('soundIcon');
          if (soundIcon) {
            soundIcon.className = 'fas fa-volume-up';
          }
        }

        // Call the callback
        if (callback) callback();
      };
    }

    // Remove the event listener after it's been used
    video.removeEventListener('loadedmetadata', handleMetadata);
  };

  // Add event listener for when video metadata is loaded
  video.addEventListener('loadedmetadata', handleMetadata);

  // If the video is already loaded, trigger the handler manually
  if (video.readyState >= 2) {
    handleMetadata();
  }
}

// Process random events
function processEvents() {
  // Decrease duration of active events
  gameState.events.forEach(event => {
    event.duration -= 1;
  });

  // Remove expired events
  gameState.events = gameState.events.filter(event => event.duration > 0);

  // 30% chance of a new event
  if (Math.random() < 0.3) {
    // Select a random event
    const eventIndex = Math.floor(Math.random() * gameData.events.length);
    const eventTemplate = gameData.events[eventIndex];

    // Create a new event instance
    const event = {
      title: eventTemplate.title,
      description: eventTemplate.description,
      effect: { ...eventTemplate.effect },
      duration: eventTemplate.effect.duration
    };

    // If the event affects a token, select a random token
    if (event.effect.type === "price") {
      const tokenKeys = Object.keys(gameData.tokens);
      const randomTokenKey = tokenKeys[Math.floor(Math.random() * tokenKeys.length)];
      event.token = randomTokenKey;
      event.description = event.description.replace("{TOKEN}", gameData.tokens[randomTokenKey].name);
    }

    // If the event affects a location, select a random location
    if (event.effect.type === "travel") {
      const locationIndex = Math.floor(Math.random() * gameData.locations.length);
      event.location = gameData.locations[locationIndex].name;
      event.description = event.description.replace("{LOCATION}", event.location);
    }

    // If the event affects debt (Hutt Cartel Interest)
    if (event.effect.type === "debt") {
      // Apply the interest rate increase immediately
      const interestAmount = gameState.debt * event.effect.change;

      if (gameState.debt > 0 && interestAmount > 0) {
        // Update debt
        gameState.debt += interestAmount;

        // Update the event description with the actual amount
        event.description = `Hutt Cartel raised interest rates! Your debt increased by ${interestAmount.toLocaleString('en-US', {maximumFractionDigits: 2})} CR.`;
      } else {
        // If player has no debt, modify the description
        event.description = "Hutt Cartel raised interest rates! Fortunately, you have no outstanding debt.";
      }
    }

    // Add the event to active events
    gameState.events.push(event);

    // Log the event
    gameState.eventLog.unshift(`Cycle ${gameState.day}: ${event.title} - ${event.description}`);

    // Show event modal
    showEventModal(event);
  }
}

// Show event modal
function showEventModal(event) {
  const modal = document.getElementById('eventModal');
  const messageElement = document.getElementById('eventMessage');

  if (modal && messageElement) {
    messageElement.textContent = event.description;
    modal.classList.add('active');
  }
}

// End game
function endGame() {
  const netWorth = calculateNetWorth();
  const score = netWorth - 2000; // Score is net worth minus starting amount

  console.log(`Game over! Final net worth: ${netWorth.toFixed(2)} CR, Score: ${score.toFixed(2)}`);

  // Create and show a game over modal
  const gameOverModal = document.createElement('div');
  gameOverModal.className = 'modal-overlay active';
  gameOverModal.id = 'gameOverModal';

  gameOverModal.innerHTML = `
    <div class="modal">
      <h2>Game Over!</h2>
      <p>You've completed ${gameState.day} cycles in the Sol Wars trading game.</p>

      <div class="coin-projection" style="margin: 20px 0;">
        <div class="projection-header">Final Results</div>
        <div class="projection-item">
          <span>Starting Credits:</span>
          <span>2,000.00 CR</span>
        </div>
        <div class="projection-item">
          <span>Final Net Worth:</span>
          <span class="profit-${score >= 0 ? 'positive' : 'negative'}">
            ${netWorth.toLocaleString('en-US', {maximumFractionDigits: 2})} CR
          </span>
        </div>
        <div class="projection-item">
          <span>Total Profit:</span>
          <span class="profit-${score >= 0 ? 'positive' : 'negative'}">
            ${score.toLocaleString('en-US', {maximumFractionDigits: 2})} CR
          </span>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-outline" id="newGameBtn">New Game</button>
        <button class="btn btn-primary" id="showLeaderboardBtn">View Leaderboard</button>
      </div>
    </div>
  `;

  document.body.appendChild(gameOverModal);

  // Add event listeners to the buttons
  const newGameBtn = document.getElementById('newGameBtn');
  const showLeaderboardBtn = document.getElementById('showLeaderboardBtn');

  if (newGameBtn) {
    newGameBtn.addEventListener('click', () => {
      // Remove the game over modal
      document.body.removeChild(gameOverModal);

      // Start a new game
      initializeGame();
      showNotification("New game started!", "success");
    });
  }

  if (showLeaderboardBtn) {
    showLeaderboardBtn.addEventListener('click', () => {
      // Remove the game over modal
      document.body.removeChild(gameOverModal);

      // Show the leaderboard
      showLeaderboard();
    });
  }

  // Show notification
  showNotification(`Game Over! Final net worth: ${netWorth.toFixed(2)} CR`, "info");

  // Save game results to leaderboard if authenticated
  if (typeof authState !== 'undefined' && authState.isAuthenticated) {
    saveGameResults(score, netWorth, gameState.day, true)
      .then(success => {
        if (success) {
          showNotification("Your score has been saved to the leaderboard!", "success");
        }
      });
  } else {
    // Prompt to connect wallet to save score
    showNotification("Connect your wallet to save your score to the leaderboard!", "info");
  }
}

// Update UI to reflect current game state
function updateUI() {
  console.log("Updating UI with current game state...");
  console.log("Current game state:", JSON.stringify({
    location: gameState.currentLocation,
    day: gameState.day,
    credits: gameState.credits,
    debt: gameState.debt,
    cargo: gameState.currentCargo,
    cargoCapacity: gameState.cargoCapacity,
    inventorySummary: Object.keys(gameState.inventory).map(key => `${key}: ${gameState.inventory[key]}`).join(', ')
  }, null, 2));

  // Update location display
  const locationDisplay = document.getElementById('locationDisplay');
  if (locationDisplay) {
    locationDisplay.textContent = gameState.currentLocation;
    console.log(`Updated location display: ${gameState.currentLocation}`);

    // Also update location name in market tab
    const locationNameTab = document.querySelector('.location-name-tab');
    if (locationNameTab) {
      locationNameTab.textContent = gameState.currentLocation;
    }
  } else {
    console.warn("locationDisplay element not found");
  }

  // Update day display
  const dayDisplay = document.getElementById('dayDisplay');
  if (dayDisplay) {
    dayDisplay.textContent = gameState.day;
    console.log(`Updated day display: ${gameState.day}`);
  } else {
    console.warn("dayDisplay element not found");
  }

  // Update max days display
  const maxDaysDisplay = document.getElementById('maxDaysDisplay');
  if (maxDaysDisplay) {
    maxDaysDisplay.textContent = gameState.maxDays;
  } else {
    console.warn("maxDaysDisplay element not found");
  }

  // Update wallet display
  const walletDisplay = document.getElementById('walletDisplay');
  if (walletDisplay) {
    walletDisplay.textContent = gameState.credits.toLocaleString('en-US', {maximumFractionDigits: 2});
    console.log(`Updated wallet display: ${gameState.credits.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
  } else {
    console.warn("walletDisplay element not found");
  }

  // Update debt displays
  const debtDisplay = document.getElementById('debtDisplay');
  const huttDebtDisplay = document.getElementById('huttDebtDisplay');
  const nextInterestDisplay = document.getElementById('nextInterestDisplay');

  if (debtDisplay) {
    debtDisplay.textContent = gameState.debt.toLocaleString('en-US', {maximumFractionDigits: 2});
  } else {
    console.warn("debtDisplay element not found");
  }

  // Update Hutt Loans section
  if (huttDebtDisplay) {
    huttDebtDisplay.textContent = gameState.debt.toLocaleString('en-US', {maximumFractionDigits: 2}) + " CR";
  }

  if (nextInterestDisplay) {
    // Calculate next interest payment (5% of current debt)
    const nextInterest = gameState.debt * 0.05;
    nextInterestDisplay.textContent = nextInterest.toLocaleString('en-US', {maximumFractionDigits: 2}) + " CR";
  }

  // Update net worth display
  const netWorthDisplay = document.getElementById('netWorthDisplay');
  if (netWorthDisplay) {
    const netWorth = calculateNetWorth();
    netWorthDisplay.textContent = netWorth.toLocaleString('en-US', {maximumFractionDigits: 2});
  } else {
    console.warn("netWorthDisplay element not found");
  }

  // Update inventory display
  console.log("Updating inventory display...");
  updateInventoryDisplay();

  // Update market display
  console.log("Updating market display...");
  updateMarketDisplay();

  // Update event log
  console.log("Updating event log...");
  updateEventLog();

  // Update cargo capacity
  const cargoDisplay = document.querySelector('.wallet-capacity span');
  if (cargoDisplay) {
    cargoDisplay.textContent = `Cargo space: ${gameState.currentCargo}/${gameState.cargoCapacity}`;
    console.log(`Updated cargo display: ${gameState.currentCargo}/${gameState.cargoCapacity}`);
  } else {
    console.warn("cargoDisplay element not found");
  }

  const progressBar = document.querySelector('.progress-bar');
  if (progressBar) {
    const percentage = (gameState.currentCargo / gameState.cargoCapacity) * 100;
    progressBar.style.width = `${percentage}%`;
  } else {
    console.warn("progressBar element not found");
  }

  console.log("UI update complete");
}

// Update inventory display
function updateInventoryDisplay() {
  const inventoryList = document.getElementById('inventoryList');
  if (!inventoryList) return;

  // Clear existing inventory items
  inventoryList.innerHTML = '';

  // Add inventory items for each token with quantity > 0
  Object.keys(gameState.inventory).forEach(tokenKey => {
    const amount = gameState.inventory[tokenKey];
    if (amount > 0) {
      const token = gameData.tokens[tokenKey];
      const price = gameState.prices[gameState.currentLocation][tokenKey];

      // Calculate price change percentage
      const basePrice = token.basePrice;
      const priceChange = ((price / basePrice) - 1) * 100;

      const inventoryItem = document.createElement('div');
      inventoryItem.className = 'inventory-item';
      inventoryItem.setAttribute('data-token', tokenKey);

      inventoryItem.innerHTML = `
        <div class="coin-icon ${tokenKey}">${token.shortCode}</div>
        <div class="inventory-item-info">
          <div class="inventory-item-name">${token.name}</div>
          <div class="inventory-item-details">
            <span>${amount.toLocaleString()} ${token.unit}</span>
            <span class="profit-${priceChange >= 0 ? 'positive' : 'negative'}">
              ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(1)}%
            </span>
          </div>
        </div>
        <div class="inventory-item-actions">
          <button class="btn btn-outline btn-small sell-btn" data-token="${tokenKey}">Sell</button>
        </div>
      `;

      inventoryList.appendChild(inventoryItem);

      // Add event listener to sell button
      const sellBtn = inventoryItem.querySelector('.sell-btn');
      sellBtn.addEventListener('click', () => {
        // Show sell modal
        showSellModal(tokenKey);
      });
    }
  });
}

// Update market display
function updateMarketDisplay(activeTab = 'all', sortBy = 'price', searchQuery = '') {
  const marketList = document.getElementById('marketList');
  if (!marketList) return;

  // Clear existing market items
  marketList.innerHTML = '';

  // Filter tokens based on active tab and search query
  let tokensToShow = Object.keys(gameData.tokens);

  // Apply tab filter
  if (activeTab === 'holdings') {
    tokensToShow = tokensToShow.filter(tokenKey =>
      gameState.inventory[tokenKey] && gameState.inventory[tokenKey] > 0
    );
  } else if (activeTab === 'hot') {
    // Show tokens with highest price change
    tokensToShow = tokensToShow.sort((a, b) => {
      const priceChangeA = ((gameState.prices[gameState.currentLocation][a] / gameData.tokens[a].basePrice) - 1) * 100;
      const priceChangeB = ((gameState.prices[gameState.currentLocation][b] / gameData.tokens[b].basePrice) - 1) * 100;
      return Math.abs(priceChangeB) - Math.abs(priceChangeA);
    }).slice(0, 3); // Show top 3
  } else if (activeTab === 'trending') {
    // Show tokens with positive price change
    tokensToShow = tokensToShow.filter(tokenKey => {
      const priceChange = ((gameState.prices[gameState.currentLocation][tokenKey] / gameData.tokens[tokenKey].basePrice) - 1) * 100;
      return priceChange > 0;
    });
  }

  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    tokensToShow = tokensToShow.filter(tokenKey =>
      gameData.tokens[tokenKey].name.toLowerCase().includes(query) ||
      gameData.tokens[tokenKey].shortCode.toLowerCase().includes(query) ||
      gameData.tokens[tokenKey].unit.toLowerCase().includes(query)
    );
  }

  // Sort tokens
  tokensToShow.sort((a, b) => {
    const tokenA = gameData.tokens[a];
    const tokenB = gameData.tokens[b];
    const priceA = gameState.prices[gameState.currentLocation][a];
    const priceB = gameState.prices[gameState.currentLocation][b];
    const priceChangeA = ((priceA / tokenA.basePrice) - 1) * 100;
    const priceChangeB = ((priceB / tokenB.basePrice) - 1) * 100;

    if (sortBy === 'name') {
      return tokenA.name.localeCompare(tokenB.name);
    } else if (sortBy === 'price') {
      return priceB - priceA;
    } else if (sortBy === 'change') {
      return priceChangeB - priceChangeA;
    }

    return 0;
  });

  // Add market items for filtered tokens
  tokensToShow.forEach(tokenKey => {
    const token = gameData.tokens[tokenKey];
    const price = gameState.prices[gameState.currentLocation][tokenKey];
    const ownedAmount = gameState.inventory[tokenKey] || 0;

    // Calculate price change percentage
    const basePrice = token.basePrice;
    const priceChange = ((price / basePrice) - 1) * 100;

    const marketItem = document.createElement('div');
    marketItem.className = 'market-item';
    marketItem.setAttribute('data-token', tokenKey);

    marketItem.innerHTML = `
      <div class="coin-icon ${tokenKey}">${token.shortCode}</div>
      <div class="market-item-info">
        <div class="market-item-name">
          ${token.name}
          <span class="market-item-trend trend-${priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'neutral'}">
            <i class="fas fa-arrow-${priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'minus'}"></i> ${Math.abs(priceChange).toFixed(1)}%
          </span>
        </div>
        <div class="market-item-price">${price.toFixed(2)} CR per ${token.unit}</div>
        ${ownedAmount > 0 ? `<div class="market-item-owned">You own: ${ownedAmount.toLocaleString()} ${token.unit}</div>` : ''}
      </div>
      <div class="market-item-actions">
        <button class="btn btn-secondary btn-small buy-btn" data-token="${tokenKey}">Buy</button>
        <button class="btn btn-danger btn-small sell-btn" data-token="${tokenKey}" ${ownedAmount <= 0 ? 'disabled' : ''}>Sell</button>
      </div>
    `;

    marketList.appendChild(marketItem);

    // Add event listeners to buttons
    const buyBtn = marketItem.querySelector('.buy-btn');
    buyBtn.addEventListener('click', () => {
      // Show buy modal
      showBuyModal(tokenKey);
    });

    const sellBtn = marketItem.querySelector('.sell-btn');
    sellBtn.addEventListener('click', () => {
      // Show sell modal
      showSellModal(tokenKey);
    });
  });

  // Show message if no tokens match the criteria
  if (tokensToShow.length === 0) {
    marketList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search" style="font-size: 24px; margin-bottom: 10px; color: var(--primary);"></i>
        <p>No tokens found matching your criteria.</p>
        ${searchQuery ? '<p>Try a different search term.</p>' : ''}
      </div>
    `;
  }
}

// Update event log
function updateEventLog() {
  const eventsList = document.getElementById('eventsList');
  if (!eventsList) return;

  // Clear existing events
  eventsList.innerHTML = '';

  // Add events from log
  gameState.eventLog.slice(0, 5).forEach((event, index) => {
    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    if (index === 0) {
      eventItem.classList.add('highlight');
    }
    eventItem.textContent = event;
    eventsList.appendChild(eventItem);
  });
}

// Show buy modal
function showBuyModal(tokenKey) {
  console.log(`Opening buy modal for ${tokenKey}...`);

  // Validate token exists
  if (!gameData.tokens[tokenKey]) {
    console.error(`Token ${tokenKey} not found in gameData`);
    showNotification("Invalid token", "error");
    return;
  }

  const token = gameData.tokens[tokenKey];
  const price = gameState.prices[gameState.currentLocation][tokenKey];
  const availableCredits = gameState.credits;
  const availableSpace = gameState.cargoCapacity - gameState.currentCargo;

  console.log(`Token: ${token.name}, Price: ${price}, Credits: ${availableCredits}, Space: ${availableSpace}`);

  // Calculate maximum amount that can be bought
  const maxAmount = Math.min(
    Math.floor(availableCredits / price), // Max based on credits
    availableSpace // Max based on cargo space
  );

  console.log(`Maximum amount that can be bought: ${maxAmount}`);

  // Show transaction confirmation modal
  const modal = document.getElementById('transactionModal');
  if (!modal) {
    console.error("Transaction modal not found");
    return;
  }

  const modalTitle = modal.querySelector('h2');
  modalTitle.textContent = `Buy ${token.name}`;

  const modalContent = modal.querySelector('p');
  modalContent.innerHTML = `
    Enter the amount of ${token.name} ${token.unit} you want to buy:<br>
    <div class="transaction-input" style="margin-top: 10px; display: flex; gap: 8px;">
      <input type="number" id="buyAmount" placeholder="Amount" min="1" max="${maxAmount}" style="flex: 1;">
      <button id="maxBuyBtn" class="btn btn-small btn-outline">Max</button>
    </div>
    <div style="margin-top: 5px;">
      <small>Price: ${price.toFixed(2)} CR per ${token.unit}</small><br>
      <small>Available Credits: ${availableCredits.toLocaleString('en-US', {maximumFractionDigits: 2})} CR</small><br>
      <small>Available Cargo Space: ${availableSpace}</small>
    </div>
  `;

  // Find best location to sell this token
  let bestLocation = null;
  let bestPrice = price;
  let bestPriceDiff = 0;

  gameData.locations.forEach(location => {
    if (location.name !== gameState.currentLocation) {
      const locationPrice = gameState.prices[location.name][tokenKey];
      const priceDiff = locationPrice - price;
      if (priceDiff > bestPriceDiff) {
        bestLocation = location.name;
        bestPrice = locationPrice;
        bestPriceDiff = priceDiff;
      }
    }
  });

  // Update projection
  const projectionDiv = document.getElementById('txProjection');
  if (projectionDiv) {
    if (bestLocation && bestPriceDiff > 0) {
      const profitPercent = (bestPriceDiff / price) * 100;
      projectionDiv.innerHTML = `
        <div class="projection-header">Strategy Projection</div>
        <div class="projection-item">
          <span>Current Price:</span>
          <span>${price.toFixed(2)} CR per ${token.unit}</span>
        </div>
        <div class="projection-item">
          <span>Price on ${bestLocation}:</span>
          <span class="profit-positive">
            ${bestPrice.toFixed(2)} CR (+${profitPercent.toFixed(1)}%)
          </span>
        </div>
        <div class="projection-item">
          <span>Potential profit:</span>
          <span class="profit-positive">+${bestPriceDiff.toFixed(2)} CR per ${token.unit}</span>
        </div>
      `;
    } else {
      projectionDiv.innerHTML = `
        <div class="projection-header">Market Information</div>
        <div class="projection-item">
          <span>Current Price:</span>
          <span>${price.toFixed(2)} CR per ${token.unit}</span>
        </div>
        <div class="projection-item">
          <span>Market Status:</span>
          <span>No favorable selling locations found</span>
        </div>
      `;
    }
  }

  // Get the confirm button
  const confirmBtn = document.getElementById('confirmTxBtn');
  if (!confirmBtn) {
    console.error("Confirm button not found");
    return;
  }

  confirmBtn.textContent = 'Buy';
  confirmBtn.className = 'btn btn-secondary';

  // Set up max button
  setTimeout(() => {
    const maxBuyBtn = document.getElementById('maxBuyBtn');
    if (maxBuyBtn) {
      maxBuyBtn.addEventListener('click', () => {
        const amountInput = document.getElementById('buyAmount');
        if (amountInput) {
          amountInput.value = maxAmount;
        }
      });
    }
  }, 100);

  // Define the current token and action for the modal
  window.currentModalAction = {
    type: 'buy',
    tokenKey: tokenKey,
    token: token,
    maxAmount: maxAmount,
    price: price
  };

  console.log('Set current modal action:', window.currentModalAction);

  // Set the button text and class
  confirmBtn.textContent = 'Buy';
  confirmBtn.className = 'btn btn-secondary';

  // Show the modal
  modal.classList.add('active');
  console.log('Buy modal opened');
}

// Show sell modal
function showSellModal(tokenKey) {
  console.log(`Opening sell modal for ${tokenKey}...`);

  // Validate token exists
  if (!gameData.tokens[tokenKey]) {
    console.error(`Token ${tokenKey} not found in gameData`);
    showNotification("Invalid token", "error");
    return;
  }

  const token = gameData.tokens[tokenKey];
  const price = gameState.prices[gameState.currentLocation][tokenKey];
  const ownedAmount = gameState.inventory[tokenKey] || 0;

  console.log(`Token: ${token.name}, Price: ${price}, Owned: ${ownedAmount}`);

  if (ownedAmount <= 0) {
    console.log(`No ${token.name} in inventory to sell`);
    showNotification(`You don't have any ${token.name} to sell`, "error");
    return;
  }

  // Show transaction confirmation modal
  const modal = document.getElementById('transactionModal');
  if (!modal) {
    console.error("Transaction modal not found");
    return;
  }

  const modalTitle = modal.querySelector('h2');
  modalTitle.textContent = `Sell ${token.name}`;

  const modalContent = modal.querySelector('p');
  modalContent.innerHTML = `
    Enter the amount of ${token.name} ${token.unit} you want to sell:<br>
    <div class="transaction-input" style="margin-top: 10px; display: flex; gap: 8px;">
      <input type="number" id="sellAmount" placeholder="Amount" min="1" max="${ownedAmount}" style="flex: 1;">
      <button id="maxSellBtn" class="btn btn-small btn-outline">Max</button>
    </div>
    <div style="margin-top: 5px;">
      <small>Price: ${price.toFixed(2)} CR per ${token.unit}</small><br>
      <small>Owned: ${ownedAmount.toLocaleString()} ${token.unit}</small><br>
      <small>Revenue: <span id="sellRevenue">0.00</span> CR</small>
    </div>
  `;

  // Find best location to buy this token
  let bestLocation = null;
  let bestPrice = price;
  let bestPriceDiff = 0;

  gameData.locations.forEach(location => {
    if (location.name !== gameState.currentLocation) {
      const locationPrice = gameState.prices[location.name][tokenKey];
      const priceDiff = price - locationPrice;
      if (priceDiff > bestPriceDiff) {
        bestLocation = location.name;
        bestPrice = locationPrice;
        bestPriceDiff = priceDiff;
      }
    }
  });

  // Update projection
  const projectionDiv = document.getElementById('txProjection');
  if (projectionDiv) {
    // Calculate purchase price if known
    const basePrice = token.basePrice;
    const priceChange = ((price / basePrice) - 1) * 100;

    if (bestLocation && bestPriceDiff > 0) {
      const profitPercent = (bestPriceDiff / bestPrice) * 100;
      projectionDiv.innerHTML = `
        <div class="projection-header">Market Analysis</div>
        <div class="projection-item">
          <span>Current Price:</span>
          <span>${price.toFixed(2)} CR per ${token.unit}</span>
        </div>
        <div class="projection-item">
          <span>Market Trend:</span>
          <span class="profit-${priceChange >= 0 ? 'positive' : 'negative'}">
            ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(1)}% from base
          </span>
        </div>
        <div class="projection-item">
          <span>Cheapest on ${bestLocation}:</span>
          <span class="profit-positive">
            ${bestPrice.toFixed(2)} CR (${profitPercent.toFixed(1)}% cheaper)
          </span>
        </div>
      `;
    } else {
      projectionDiv.innerHTML = `
        <div class="projection-header">Market Analysis</div>
        <div class="projection-item">
          <span>Current Price:</span>
          <span>${price.toFixed(8)} CR per ${token.unit}</span>
        </div>
        <div class="projection-item">
          <span>Market Trend:</span>
          <span class="profit-${priceChange >= 0 ? 'positive' : 'negative'}">
            ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(1)}% from base
          </span>
        </div>
        <div class="projection-item">
          <span>Market Status:</span>
          <span>This is currently the best selling location</span>
        </div>
      `;
    }
  }

  // Get the confirm button
  const confirmBtn = document.getElementById('confirmTxBtn');
  if (!confirmBtn) {
    console.error("Confirm button not found");
    return;
  }

  confirmBtn.textContent = 'Sell';
  confirmBtn.className = 'btn btn-danger';

  // Set up max button and revenue calculator
  setTimeout(() => {
    const maxSellBtn = document.getElementById('maxSellBtn');
    if (maxSellBtn) {
      maxSellBtn.addEventListener('click', () => {
        const amountInput = document.getElementById('sellAmount');
        if (amountInput) {
          amountInput.value = ownedAmount;
          // Update revenue display
          const revenueDisplay = document.getElementById('sellRevenue');
          if (revenueDisplay) {
            const revenue = ownedAmount * price;
            revenueDisplay.textContent = revenue.toLocaleString('en-US', {maximumFractionDigits: 2});
          }
        }
      });
    }

    // Set up revenue calculator
    const amountInput = document.getElementById('sellAmount');
    if (amountInput) {
      amountInput.addEventListener('input', () => {
        const amount = parseInt(amountInput.value) || 0;
        const revenueDisplay = document.getElementById('sellRevenue');
        if (revenueDisplay) {
          const revenue = amount * price;
          revenueDisplay.textContent = revenue.toLocaleString('en-US', {maximumFractionDigits: 2});
        }
      });
    }
  }, 100);

  // Define the current token and action for the modal
  window.currentModalAction = {
    type: 'sell',
    tokenKey: tokenKey,
    token: token,
    ownedAmount: ownedAmount,
    price: price
  };

  console.log('Set current modal action:', window.currentModalAction);

  // Set the button text and class
  confirmBtn.textContent = 'Sell';
  confirmBtn.className = 'btn btn-danger';

  // Show the modal
  modal.classList.add('active');
  console.log('Sell modal opened');
}

// Initialize the game
function initializeGame() {
  // Reset game state
  gameState = {
    currentLocation: "Coruscant",
    day: 1,
    maxDays: 30,
    credits: 2000, // Increased from 1000 to 2000
    debt: 2000, // Decreased from 3500 to 2000
    cargoCapacity: 500, // Increased from 200 to 500
    currentCargo: 0,
    inventory: {
      KYBER: 0,
      WAMPA: 0,
      TROOPER: 0,
      BANTHA: 0,
      JAWA: 0
    },
    prices: {},
    events: [],
    eventLog: ["Cycle 1: Welcome to SolWars: Galactic Trading!"]
  };

  // Initialize prices
  initializePrices();

  // Calculate initial cargo
  gameState.currentCargo = Object.values(gameState.inventory).reduce((sum, amount) => sum + amount, 0);

  // Update UI
  updateUI();
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize the game
  initializeGame();
  // Handle intro sequence
  const introContainer = document.getElementById('introContainer');
  const gameContainer = document.getElementById('gameContainer');
  const skipIntroBtn = document.getElementById('skipIntro');
  const toggleAudioBtn = document.getElementById('toggleAudio');
  const starWarsTheme = document.getElementById('starWarsTheme');
  let audioPlaying = true;

  // Set up authentication and leaderboard buttons
  const authButton = document.getElementById('authButton');
  const leaderboardBtn = document.getElementById('leaderboardBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const closeLeaderboardModal = document.getElementById('closeLeaderboardModal');
  const refreshLeaderboardBtn = document.getElementById('refreshLeaderboardBtn');

  if (authButton) {
    authButton.addEventListener('click', () => {
      if (typeof connectWallet === 'function') {
        if (!authState.isAuthenticated) {
          connectWallet();
        } else {
          disconnectWallet();
        }
      } else {
        console.error('Wallet connection function not found');
        showNotification('Wallet connection not available', 'error');
      }
    });
  }

  if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
      if (typeof showLeaderboard === 'function') {
        showLeaderboard();
      } else {
        console.error('Leaderboard function not found');
        showNotification('Leaderboard not available', 'error');
      }
    });
  }

  if (closeLeaderboardModal) {
    closeLeaderboardModal.addEventListener('click', () => {
      const modal = document.getElementById('leaderboardModal');
      if (modal) {
        modal.classList.remove('active');
      }
    });
  }

  if (refreshLeaderboardBtn) {
    refreshLeaderboardBtn.addEventListener('click', () => {
      if (typeof showLeaderboard === 'function') {
        showLeaderboard();
      }
    });
  }

  if (newGameBtn) {
    newGameBtn.addEventListener('click', () => {
      // Confirm before starting a new game
      if (confirm('Are you sure you want to start a new game? Your current progress will be lost.')) {
        // Save score if authenticated
        if (typeof authState !== 'undefined' && authState.isAuthenticated) {
          const netWorth = calculateNetWorth();
          const score = netWorth - 2000;

          if (gameState.day > 1) { // Only save if they've played at least one day
            saveGameResults(score, netWorth, gameState.day, true)
              .then(success => {
                if (success) {
                  showNotification("Your score has been saved to the leaderboard!", "success");
                }
                // Initialize new game
                initializeGame();
                showNotification("New game started!", "success");
              });
          } else {
            // Initialize new game without saving
            initializeGame();
            showNotification("New game started!", "success");
          }
        } else {
          // Initialize new game without saving
          initializeGame();
          showNotification("New game started!", "success");
        }
      }
    });
  }

  // Set up logo to play music when clicked
  const solWarsLogo = document.getElementById('solWarsLogo');

  // Make the logo clickable to play music
  if (solWarsLogo && starWarsTheme) {
    solWarsLogo.addEventListener('click', () => {
      starWarsTheme.volume = 0.7; // Set volume to 70%
      starWarsTheme.play().catch(e => {
        console.log('Audio playback failed:', e);
        audioPlaying = false;
        if (toggleAudioBtn) {
          toggleAudioBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        }
      });

      // Hide the play prompt after clicking
      const playPrompt = solWarsLogo.querySelector('.play-prompt');
      if (playPrompt) {
        playPrompt.style.display = 'none';
      }

      audioPlaying = true;
      if (toggleAudioBtn) {
        toggleAudioBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
      }
    });
  }

  // Toggle audio on/off
  if (toggleAudioBtn) {
    // Initially set to muted since we're not auto-playing
    toggleAudioBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
    audioPlaying = false;

    toggleAudioBtn.addEventListener('click', () => {
      if (starWarsTheme) {
        if (audioPlaying) {
          starWarsTheme.pause();
          toggleAudioBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else {
          starWarsTheme.play().catch(e => console.log('Audio playback failed:', e));
          toggleAudioBtn.innerHTML = '<i class="fas fa-volume-up"></i>';

          // Hide the play prompt after toggling audio on
          const playPrompt = solWarsLogo.querySelector('.play-prompt');
          if (playPrompt) {
            playPrompt.style.display = 'none';
          }
        }
        audioPlaying = !audioPlaying;
      }
    });
  }

  // Auto-fade after 48 seconds
  setTimeout(() => {
    // Start fading out the intro
    introContainer.classList.add('fade-out');

    // After the fade-out transition completes, show the game
    setTimeout(() => {
      // Keep music playing (removed the pause)
      introContainer.style.display = 'none';
      gameContainer.style.display = 'block';

      // Add a small delay before starting the fade-in
      setTimeout(() => {
        gameContainer.classList.add('fade-in');
      }, 100);
    }, 2000); // This matches the transition duration in CSS
  }, 48000); // 48 seconds total for the intro

  skipIntroBtn.addEventListener('click', () => {
    // Keep music playing (removed the pause)

    // Apply the fade-out effect
    introContainer.classList.add('fade-out');

    // After the fade-out transition completes, show the game
    setTimeout(() => {
      introContainer.style.display = 'none';
      gameContainer.style.display = 'block';

      // Add a small delay before starting the fade-in
      setTimeout(() => {
        gameContainer.classList.add('fade-in');
      }, 100);
    }, 2000); // This matches the transition duration in CSS
  });

  // Set up market tabs
  const marketTabs = document.querySelectorAll('.market-tab');
  let currentTab = 'all';
  let currentSort = 'price';
  let currentSearch = '';

  if (marketTabs.length > 0) {
    marketTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs
        marketTabs.forEach(t => t.classList.remove('active'));

        // Add active class to clicked tab
        tab.classList.add('active');

        // Determine which tab was clicked
        if (tab.textContent.includes('All')) {
          currentTab = 'all';
        } else if (tab.textContent.includes('Holdings')) {
          currentTab = 'holdings';
        } else if (tab.textContent.includes('Hot')) {
          currentTab = 'hot';
        } else if (tab.textContent.includes('Trending')) {
          currentTab = 'trending';
        }

        // Update market display with new tab
        updateMarketDisplay(currentTab, currentSort, currentSearch);
      });
    });
  }

  // Set up search functionality
  const searchInput = document.querySelector('.market-search input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentSearch = searchInput.value.trim();
      updateMarketDisplay(currentTab, currentSort, currentSearch);
    });
  }

  // Set up dropdown
  const sortDropdown = document.getElementById('sortDropdown');
  if (sortDropdown) {
    const dropdownToggle = sortDropdown.querySelector('.dropdown-toggle');
    const dropdownMenu = sortDropdown.querySelector('.dropdown-menu');
    const dropdownItems = sortDropdown.querySelectorAll('.dropdown-item');

    dropdownToggle.addEventListener('click', () => {
      dropdownMenu.classList.toggle('active');
    });

    dropdownItems.forEach(item => {
      item.addEventListener('click', () => {
        dropdownToggle.querySelector('span').textContent = item.textContent;
        dropdownMenu.classList.remove('active');

        // Determine sort type
        if (item.textContent.includes('Name')) {
          currentSort = 'name';
        } else if (item.textContent.includes('Price')) {
          currentSort = 'price';
        } else if (item.textContent.includes('Change')) {
          currentSort = 'change';
        }

        // Update market display with new sort
        updateMarketDisplay(currentTab, currentSort, currentSearch);
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      if (!sortDropdown.contains(event.target)) {
        dropdownMenu.classList.remove('active');
      }
    });
  }

  // Set up location item click events
  const locationItems = document.querySelectorAll('.location-item');
  locationItems.forEach(item => {
    if (!item.classList.contains('active')) {
      item.addEventListener('click', () => {
        // Extract location name from the item
        const locationInfoText = item.querySelector('.location-info').textContent.trim();
        // Extract just the location name (remove the icon text)
        const locationName = locationInfoText.replace(/^\S+\s+/, '');

        // Find the location data
        const location = gameData.locations.find(loc => loc.name === locationName);
        if (!location) return;

        // Show travel confirmation modal
        const modal = document.getElementById('travelModal');
        modal.classList.add('active');

        // Update modal content
        document.querySelector('#travelModal h2').textContent = `Travel to ${locationName}?`;
        const modalContent = modal.querySelector('p');

        // Check if player has enough credits
        const canAfford = gameState.credits >= location.travelCost;

        modalContent.innerHTML = `
          Traveling to ${locationName} will advance the game by 1 cycle and cost
          <span class="${canAfford ? 'profit-positive' : 'profit-negative'}" style="font-weight: bold;">
            ${location.travelCost.toFixed(2)} CR
          </span>
          <br>
          <small>Your credits: ${gameState.credits.toFixed(2)} CR (${canAfford ? 'Sufficient' : 'Insufficient'})</small>
          <br><br>
          <strong>${location.description}</strong>
          <br><br>
          Risk Level: ${location.riskLevel}
        `;

        // Update advantage info if available
        if (location.advantage) {
          const projectionDiv = modal.querySelector('.coin-projection');
          if (projectionDiv) {
            // Find the token with the advantage
            let advantageToken = null;
            let advantageTokenKey = null;
            Object.keys(gameData.tokens).forEach(tokenKey => {
              const token = gameData.tokens[tokenKey];
              if (location.advantage && location.advantage.includes(token.name)) {
                advantageToken = token;
                advantageTokenKey = tokenKey;
              }
            });

            if (advantageToken && advantageTokenKey) {
              const currentLocation = gameState.currentLocation;
              const currentPrice = gameState.prices[currentLocation][advantageTokenKey];
              const newPrice = gameState.prices[locationName][advantageTokenKey];
              const priceDiff = ((newPrice / currentPrice) - 1) * 100;

              projectionDiv.innerHTML = `
                <div class="projection-header">Price Advantage</div>
                <div class="projection-item">
                  <span>${advantageToken.name} on ${currentLocation}:</span>
                  <span>${currentPrice.toFixed(2)} CR</span>
                </div>
                <div class="projection-item">
                  <span>${advantageToken.name} on ${locationName}:</span>
                  <span class="profit-${priceDiff >= 0 ? 'positive' : 'negative'}">
                    ${newPrice.toFixed(2)} CR (${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(1)}%)
                  </span>
                </div>
              `;
            }
          }
        }

        // Update confirm button
        const confirmBtn = document.getElementById('confirmTravelBtn');
        if (confirmBtn) {
          confirmBtn.textContent = `Travel to ${locationName}`;

          // Disable button if player doesn't have enough credits
          if (!canAfford) {
            confirmBtn.disabled = true;
            confirmBtn.classList.add('btn-disabled');
            confirmBtn.innerHTML = `<i class="fas fa-rocket"></i> Not Enough Credits`;
          } else {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('btn-disabled');
            confirmBtn.innerHTML = `<i class="fas fa-rocket"></i> Launch`;
          }

          confirmBtn.onclick = () => {
            if (canAfford) {
              travelToLocation(locationName);
              modal.classList.remove('active');
            } else {
              showNotification(`Not enough credits to travel to ${locationName}!`, "error");
            }
          };
        }
      });
    }
  });

  // Set up buy button click events
  const buyButtons = document.querySelectorAll('.buy-btn');
  buyButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tokenKey = button.getAttribute('data-token');
      if (!tokenKey) return;

      // Show buy modal
      showBuyModal(tokenKey);
    });
  });

  // Set up modal close buttons
  const closeButtons = document.querySelectorAll('.close-modal');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal-overlay');
      modal.classList.remove('active');
    });
  });

  // Set up transaction cancellation
  const cancelTxBtn = document.getElementById('cancelTxBtn');
  if (cancelTxBtn) {
    cancelTxBtn.addEventListener('click', () => {
      const modal = document.getElementById('transactionModal');
      modal.classList.remove('active');
    });
  }

  // Set up transaction confirmation - global handler for both buy and sell
  const confirmTxBtn = document.getElementById('confirmTxBtn');
  if (confirmTxBtn) {
    confirmTxBtn.addEventListener('click', () => {
      console.log('Confirm transaction button clicked');

      if (!window.currentModalAction) {
        console.error('No current modal action defined');
        showNotification('Transaction error: No action defined', 'error');
        return;
      }

      const action = window.currentModalAction;
      console.log('Processing action:', action);
      const modal = document.getElementById('transactionModal');

      if (action.type === 'buy') {
        // Handle buy action
        const amountInput = document.getElementById('buyAmount');
        if (!amountInput) {
          console.error("Buy amount input not found");
          showNotification('Transaction error: Input field not found', 'error');
          return;
        }

        const amount = parseInt(amountInput.value);
        console.log(`Attempting to buy ${amount} ${action.token.name}...`);

        if (!amount || amount <= 0) {
          console.log("Invalid amount");
          showNotification('Please enter a valid amount', 'error');
          return;
        }

        // Check if player has enough credits
        const cost = action.price * amount;
        if (cost > gameState.credits) {
          console.log(`Not enough credits: ${gameState.credits} < ${cost}`);
          showNotification(`Not enough credits! You need ${cost.toFixed(2)} CR but only have ${gameState.credits.toFixed(2)} CR`, "error");
          return;
        }

        // Check if player has enough cargo space
        if (gameState.currentCargo + amount > gameState.cargoCapacity) {
          console.log(`Not enough cargo space: ${gameState.currentCargo} + ${amount} > ${gameState.cargoCapacity}`);
          showNotification(`Not enough cargo space! You need ${amount} units but only have ${gameState.cargoCapacity - gameState.currentCargo} available`, "error");
          return;
        }

        if (amount > action.maxAmount) {
          console.log(`Amount exceeds maximum (${amount} > ${action.maxAmount})`);
          showNotification(`You can only buy up to ${action.maxAmount} ${action.token.unit}`, 'error');
          return;
        }

        console.log(`Calling buyToken(${action.tokenKey}, ${amount})...`);
        const success = buyToken(action.tokenKey, amount);
        console.log(`buyToken result: ${success}`);

        if (success) {
          // Close the modal
          if (modal) {
            modal.classList.remove('active');
          }
          showNotification(`Successfully purchased ${amount.toLocaleString()} ${action.token.name} ${action.token.unit}!`, "success");
        }
      }
      else if (action.type === 'sell') {
        // Handle sell action
        const amountInput = document.getElementById('sellAmount');
        if (!amountInput) {
          console.error("Sell amount input not found");
          showNotification('Transaction error: Input field not found', 'error');
          return;
        }

        const amount = parseInt(amountInput.value);
        console.log(`Attempting to sell ${amount} ${action.token.name}...`);

        if (!amount || amount <= 0) {
          console.log("Invalid amount");
          showNotification('Please enter a valid amount', 'error');
          return;
        }

        if (amount > action.ownedAmount) {
          console.log(`Amount exceeds owned amount (${amount} > ${action.ownedAmount})`);
          showNotification(`You only have ${action.ownedAmount} ${action.token.unit}`, 'error');
          return;
        }

        console.log(`Calling sellToken(${action.tokenKey}, ${amount})...`);
        const success = sellToken(action.tokenKey, amount);
        console.log(`sellToken result: ${success}`);

        if (success) {
          // Close the modal
          if (modal) {
            modal.classList.remove('active');
          }
          const revenue = amount * action.price;
          showNotification(`Successfully sold ${amount.toLocaleString()} ${action.token.name} ${action.token.unit} for ${revenue.toFixed(2)} CR!`, "success");
        }
      }
    });
  }

  // Set up travel confirmation - this is now handled in the location click event

  // Set up travel cancellation
  const cancelTravelBtn = document.getElementById('cancelTravelBtn');
  if (cancelTravelBtn) {
    cancelTravelBtn.addEventListener('click', () => {
      const modal = document.getElementById('travelModal');
      modal.classList.remove('active');
    });
  }

  // Set up event acknowledgment
  const eventOkBtn = document.getElementById('eventOkBtn');
  if (eventOkBtn) {
    eventOkBtn.addEventListener('click', () => {
      const modal = document.getElementById('eventModal');
      modal.classList.remove('active');
    });
  }

  // Function to repay debt
  function repayDebt(amount) {
    console.log(`Repaying ${amount} credits of debt...`);

    // Validate amount
    if (!amount || amount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return false;
    }

    // Check if player has enough credits
    if (amount > gameState.credits) {
      showNotification('Not enough credits in your wallet!', 'error');
      return false;
    }

    // Calculate new values
    const newDebt = Math.max(0, gameState.debt - amount);
    const newCredits = gameState.credits - amount;

    // Update game state
    gameState.debt = newDebt;
    gameState.credits = newCredits;

    // Log the transaction
    gameState.eventLog.unshift(`Cycle ${gameState.day}: Repaid ${amount.toLocaleString('en-US', {maximumFractionDigits: 2})} CR to the Hutt Cartel.`);

    // Update UI
    updateUI();

    // Show notification
    showNotification(`Repaid ${amount.toLocaleString('en-US', {maximumFractionDigits: 2})} credits of debt!`, 'success');

    return true;
  }

  // Function to borrow money
  function borrowMoney(amount) {
    console.log(`Borrowing ${amount} credits from the Hutts...`);

    // Validate amount
    if (!amount || amount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return false;
    }

    // Set a maximum loan amount (can be adjusted)
    const maxLoanAmount = 10000; // Increased from 5000 to 10000 to match the new cargo capacity and starting values
    const currentDebtRatio = gameState.debt / calculateNetWorth();

    // Check if player is already too deep in debt (debt > 80% of net worth)
    if (currentDebtRatio > 0.8) {
      showNotification('The Hutts refuse to lend you more credits. Your debt is too high!', 'error');
      return false;
    }

    // Check if the requested amount would exceed the maximum loan
    if (gameState.debt + amount > maxLoanAmount) {
      showNotification(`The Hutts won't lend you that much. Maximum total debt: ${maxLoanAmount.toLocaleString('en-US')} CR`, 'error');
      return false;
    }

    // Calculate new values
    const newDebt = gameState.debt + amount;
    const newCredits = gameState.credits + amount;

    // Update game state
    gameState.debt = newDebt;
    gameState.credits = newCredits;

    // Log the transaction
    gameState.eventLog.unshift(`Cycle ${gameState.day}: Borrowed ${amount.toLocaleString('en-US', {maximumFractionDigits: 2})} CR from the Hutt Cartel.`);

    // Update UI
    updateUI();

    // Show notification
    showNotification(`Borrowed ${amount.toLocaleString('en-US', {maximumFractionDigits: 2})} credits from the Hutts!`, 'success');

    return true;
  }



  // Set up debt management
  const repayBtn = document.getElementById('repayBtn');
  if (repayBtn) {
    repayBtn.addEventListener('click', () => {
      const amountInput = document.getElementById('debtAmount');
      const amount = parseFloat(amountInput.value);

      if (repayDebt(amount)) {
        amountInput.value = '';
      }
    });
  }

  // Set up borrowing
  const borrowBtn = document.getElementById('borrowBtn');
  if (borrowBtn) {
    borrowBtn.addEventListener('click', () => {
      const amountInput = document.getElementById('debtAmount');
      const amount = parseFloat(amountInput.value);

      if (borrowMoney(amount)) {
        amountInput.value = '';
      }
    });
  }

// Apply interest to debt when time passes
function applyDebtInterest() {
  // Base interest rate is 5% per cycle
  const baseInterestRate = 0.05;

  // Calculate interest
  const interest = gameState.debt * baseInterestRate;

  // Only apply interest if there is debt
  if (gameState.debt > 0 && interest > 0) {
    // Update debt
    gameState.debt += interest;

    // Log the transaction
    gameState.eventLog.unshift(`Cycle ${gameState.day}: Hutt Cartel charged ${interest.toLocaleString('en-US', {maximumFractionDigits: 2})} CR in interest.`);

    // Show notification
    showNotification(`The Hutts charged you ${interest.toLocaleString('en-US', {maximumFractionDigits: 2})} CR in interest!`, 'info');
  }
}

// Show notification function - moved outside of DOMContentLoaded to make it globally accessible
function showNotification(message, type = 'success') {
  console.log(`Showing notification: ${message} (${type})`);
  const notification = document.getElementById('notification');
  if (notification) {
    notification.className = 'notification';
    notification.classList.add(type);
    notification.textContent = message;

    // Show notification
    setTimeout(() => {
      notification.classList.add('active');
    }, 100);

    // Hide notification after 3 seconds
    setTimeout(() => {
      notification.classList.remove('active');
    }, 3000);
  } else {
    console.error("Notification element not found");
  }
}

  // Add key demo features
  // 1. Demonstrate location advantage with a flashing label after 5 seconds
  setTimeout(() => {
    const tatooinItem = document.querySelectorAll('.location-item')[1];
    if (tatooinItem) {
      tatooinItem.classList.add('glow-animation');
      showNotification('KYBER crystals are 15% more valuable on Tatooine! Consider traveling there.', 'info');
    }
  }, 5000);

  // Add animation for glowing elements
  const style = document.createElement('style');
  style.textContent = `
    @keyframes glow-animation {
      0% { box-shadow: 0 0 5px rgba(255, 232, 31, 0.5); }
      50% { box-shadow: 0 0 20px rgba(255, 232, 31, 0.8); }
      100% { box-shadow: 0 0 5px rgba(255, 232, 31, 0.5); }
    }

    .glow-animation {
      animation: glow-animation 2s infinite;
    }
  `;
  document.head.appendChild(style);

  // Sound toggle functionality
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');

  if (soundToggleBtn && soundIcon) {
    soundToggleBtn.addEventListener('click', () => {
      if (starWarsTheme) {
        if (starWarsTheme.paused) {
          starWarsTheme.play();
          soundIcon.className = 'fas fa-volume-up';
          showNotification('Music enabled', 'success');
        } else {
          starWarsTheme.pause();
          soundIcon.className = 'fas fa-volume-mute';
          showNotification('Music disabled', 'info');
        }
      }
    });
  }
});
