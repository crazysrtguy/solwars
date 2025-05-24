// Test script for Vercel deployment
const axios = require('axios');

// You need to replace this with your actual Vercel URL
const VERCEL_URL = process.env.VERCEL_URL || 'https://solwars-bigch.vercel.app';

async function testVercelDeployment() {
  console.log('🚀 Testing Vercel Deployment...');
  console.log(`📍 Testing URL: ${VERCEL_URL}`);

  const endpoints = [
    '/api/health',
    '/api/auth/challenge',
    '/api/tournaments',
    '/api/tokens/trending?limit=3',
    '/api/user/profile?wallet=AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n🧪 Testing ${endpoint}...`);

      const response = await axios.get(`${VERCEL_URL}${endpoint}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'SolWars-Test/1.0'
        }
      });

      console.log(`✅ ${endpoint}: ${response.status}`);
      console.log(`📊 Response: ${JSON.stringify(response.data).substring(0, 100)}...`);

    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.response?.status || 'ERROR'}`);
      console.log(`📊 Error: ${error.message}`);

      if (error.response?.data) {
        console.log(`📊 Response: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
      }
    }
  }

  // Test POST endpoint
  try {
    console.log(`\n🧪 Testing POST /api/tokens/prices...`);

    const response = await axios.post(`${VERCEL_URL}/api/tokens/prices`, {
      tokenAddresses: ['So11111111111111111111111111111111111111112']
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SolWars-Test/1.0'
      }
    });

    console.log(`✅ POST /api/tokens/prices: ${response.status}`);
    console.log(`📊 Response: ${JSON.stringify(response.data).substring(0, 100)}...`);

  } catch (error) {
    console.log(`❌ POST /api/tokens/prices: ${error.response?.status || 'ERROR'}`);
    console.log(`📊 Error: ${error.message}`);
  }

  console.log('\n✅ Vercel deployment test completed!');
}

if (require.main === module) {
  testVercelDeployment().catch(console.error);
}

module.exports = { testVercelDeployment };
