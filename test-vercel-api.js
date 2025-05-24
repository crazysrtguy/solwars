// Test script for Vercel API endpoints
const axios = require('axios');

// Configuration
const BASE_URL = process.env.VERCEL_URL || 'http://localhost:3000';
const TEST_WALLET = 'AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR';

async function testEndpoint(endpoint, method = 'GET', data = null) {
  try {
    console.log(`\n🧪 Testing ${method} ${endpoint}...`);
    
    const config = {
      method,
      url: `${BASE_URL}/api${endpoint}`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    console.log(`✅ ${endpoint}: ${response.status} - ${JSON.stringify(response.data).substring(0, 200)}...`);
    return response.data;
  } catch (error) {
    console.log(`❌ ${endpoint}: ${error.response?.status || 'ERROR'} - ${error.message}`);
    if (error.response?.data) {
      console.log(`   Response: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function runTests() {
  console.log('🚀 Testing SolWars Vercel API Endpoints...');
  console.log(`📍 Base URL: ${BASE_URL}`);

  // Test health check
  await testEndpoint('/health');

  // Test authentication endpoints
  await testEndpoint('/auth/challenge');
  
  // Test tournaments
  await testEndpoint('/tournaments');

  // Test user profile
  await testEndpoint(`/user/profile?wallet=${TEST_WALLET}`);

  // Test SWARS balance
  await testEndpoint(`/swars/balance?wallet=${TEST_WALLET}`);

  // Test trending tokens
  await testEndpoint('/tokens/trending?limit=5');

  // Test token prices
  await testEndpoint('/tokens/prices', 'POST', {
    tokenAddresses: [
      'So11111111111111111111111111111111111111112',
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'
    ]
  });

  console.log('\n✅ API endpoint testing completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEndpoint, runTests };
