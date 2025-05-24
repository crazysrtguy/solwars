// Verify wallet signature for authentication
const { PublicKey } = require('@solana/web3.js');
const nacl = require('tweetnacl');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('🔐 Verifying signature for wallet:', walletAddress);

    // Convert the message to bytes
    const messageBytes = new TextEncoder().encode(message);
    
    // Convert signature from base58 to bytes
    const signatureBytes = Buffer.from(signature, 'base64');
    
    // Convert wallet address to public key
    const publicKey = new PublicKey(walletAddress);
    const publicKeyBytes = publicKey.toBytes();

    // Verify the signature
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (isValid) {
      console.log('✅ Signature verified successfully');
      res.status(200).json({ 
        success: true, 
        walletAddress,
        message: 'Authentication successful' 
      });
    } else {
      console.log('❌ Invalid signature');
      res.status(401).json({ 
        success: false, 
        error: 'Invalid signature' 
      });
    }
  } catch (error) {
    console.error('❌ Error verifying signature:', error);
    res.status(500).json({
      error: 'Failed to verify signature',
      message: error.message
    });
  }
}
