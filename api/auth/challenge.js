// Generate authentication challenge for wallet signing
module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Generate a random challenge for the user to sign
    const challenge = `Sign this message to authenticate with SolWars: ${Math.floor(Math.random() * 1000000)}`;
    console.log('Generated challenge:', challenge);
    
    res.status(200).json({ challenge });
  } catch (error) {
    console.error('❌ Error generating challenge:', error);
    res.status(500).json({
      error: 'Failed to generate challenge',
      message: error.message
    });
  }
}
