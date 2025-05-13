const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { PublicKey, Keypair } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from the current directory

// Generate a random challenge for the user to sign
const generateChallenge = () => {
  return `Sign this message to authenticate with SolWars: ${Math.floor(Math.random() * 1000000)}`;
};

// Verify a signature from a Solana wallet
const verifySignature = (message, signature, publicKey) => {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const publicKeyBytes = new PublicKey(publicKey).toBytes();
    const signatureBytes = bs58.decode(signature);

    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
};

// Routes

// Get a challenge to sign
app.get('/api/auth/challenge', (req, res) => {
  const challenge = generateChallenge();
  console.log('Generated challenge:', challenge);
  res.json({ challenge });
});

// Authenticate with a signed challenge
app.post('/api/auth/verify', async (req, res) => {
  const { walletAddress, signature, challenge } = req.body;

  console.log('Verifying signature for wallet:', walletAddress);
  console.log('Challenge:', challenge);
  console.log('Signature:', signature ? signature.substring(0, 20) + '...' : 'none');

  if (!walletAddress || !signature || !challenge) {
    console.log('Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Verify the signature
  const isValid = verifySignature(challenge, signature, walletAddress);
  console.log('Signature verification result:', isValid);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { leaderboard: true }
    });

    if (!user) {
      console.log('Creating new user for wallet:', walletAddress);
      // Create new user
      user = await prisma.user.create({
        data: {
          walletAddress,
          leaderboard: {
            create: {} // Create empty leaderboard entry
          }
        },
        include: { leaderboard: true }
      });
      console.log('New user created with ID:', user.id);
    } else {
      console.log('Found existing user:', user.id);
    }

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        leaderboard: user.leaderboard
      }
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Server error during authentication' });
  }
});

// Update username
app.put('/api/users/username', async (req, res) => {
  const { walletAddress, username } = req.body;

  if (!walletAddress || !username) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { walletAddress },
      data: { username },
    });

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({ error: 'Server error updating username' });
  }
});

// Save game results
app.post('/api/game/save', async (req, res) => {
  const { walletAddress, score, netWorth, days, completed } = req.body;

  if (!walletAddress || score === undefined || netWorth === undefined || !days) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Create game session
    const gameSession = await prisma.gameSession.create({
      data: {
        walletAddress,
        score,
        netWorth,
        days,
        completed,
        endDate: completed ? new Date() : null
      }
    });

    // Update leaderboard if completed game
    if (completed) {
      const user = await prisma.user.findUnique({
        where: { walletAddress },
        include: { leaderboard: true }
      });

      if (user && user.leaderboard) {
        await prisma.leaderboard.update({
          where: { id: user.leaderboard.id },
          data: {
            score: user.leaderboard.score + score,
            highScore: netWorth > user.leaderboard.highScore ? netWorth : user.leaderboard.highScore,
            gamesPlayed: user.leaderboard.gamesPlayed + 1,
            lastGameDate: new Date()
          }
        });
      }
    }

    res.json({ success: true, gameSession });
  } catch (error) {
    console.error('Error saving game:', error);
    res.status(500).json({ error: 'Server error saving game' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await prisma.leaderboard.findMany({
      orderBy: { highScore: 'desc' },
      take: 10,
      include: { user: true }
    });

    const formattedLeaderboard = leaderboard.map(entry => ({
      id: entry.id,
      username: entry.user.username || 'Anonymous Trader',
      walletAddress: entry.user.walletAddress,
      highScore: entry.highScore,
      gamesPlayed: entry.gamesPlayed,
      lastGameDate: entry.lastGameDate
    }));

    res.json(formattedLeaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Server error fetching leaderboard' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
