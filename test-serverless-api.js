// Test script for Vercel serverless API functions
const axios = require('axios');

// Test configuration
const VERCEL_URL = process.env.VERCEL_URL || 'https://your-vercel-url.vercel.app';
const TEST_WALLET = 'AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR';

async function testServerlessAPI() {
  console.log('🚀 Testing Vercel Serverless API Functions...');
  console.log(`📍 Base URL: ${VERCEL_URL}`);
  console.log('=' * 60);

  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Test endpoints
  const tests = [
    {
      name: 'Health Check',
      method: 'GET',
      endpoint: '/api/health',
      expectedStatus: 200
    },
    {
      name: 'Authentication Challenge',
      method: 'GET', 
      endpoint: '/api/auth/challenge',
      expectedStatus: 200
    },
    {
      name: 'Tournament List',
      method: 'GET',
      endpoint: '/api/tournaments',
      expectedStatus: 200
    },
    {
      name: 'User Profile',
      method: 'GET',
      endpoint: `/api/user/profile?wallet=${TEST_WALLET}`,
      expectedStatus: 200
    },
    {
      name: 'SWARS Balance',
      method: 'GET',
      endpoint: `/api/swars/balance?wallet=${TEST_WALLET}`,
      expectedStatus: 200
    },
    {
      name: 'Trending Tokens',
      method: 'GET',
      endpoint: '/api/tokens/trending?limit=3',
      expectedStatus: 200
    },
    {
      name: 'Token Prices',
      method: 'POST',
      endpoint: '/api/tokens/prices',
      data: {
        tokenAddresses: ['So11111111111111111111111111111111111111112']
      },
      expectedStatus: 200
    }
  ];

  for (const test of tests) {
    results.total++;
    
    try {
      console.log(`\n🧪 Testing: ${test.name}`);
      console.log(`   ${test.method} ${test.endpoint}`);
      
      const config = {
        method: test.method,
        url: `${VERCEL_URL}${test.endpoint}`,
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SolWars-Serverless-Test/1.0'
        }
      };

      if (test.data) {
        config.data = test.data;
      }

      const response = await axios(config);
      
      if (response.status === test.expectedStatus) {
        console.log(`   ✅ PASSED: ${response.status}`);
        console.log(`   📊 Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
        results.passed++;
      } else {
        console.log(`   ❌ FAILED: Expected ${test.expectedStatus}, got ${response.status}`);
        results.failed++;
      }
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.response?.status || 'ERROR'} - ${error.message}`);
      
      if (error.response?.data) {
        console.log(`   📊 Error Response: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
      }
      
      results.failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}/${results.total}`);
  console.log(`❌ Failed: ${results.failed}/${results.total}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / results.total) * 100)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Your Vercel API is working correctly!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above and:');
    console.log('   1. Verify environment variables are set in Vercel dashboard');
    console.log('   2. Check Vercel function logs for detailed errors');
    console.log('   3. Ensure database connection is working');
    console.log('   4. Redeploy if necessary: vercel --prod');
  }

  return results;
}

// Helper function to check if URL is accessible
async function checkDeployment() {
  console.log('🔍 Checking if deployment is accessible...');
  
  try {
    const response = await axios.get(VERCEL_URL, { timeout: 10000 });
    console.log('✅ Deployment is accessible');
    return true;
  } catch (error) {
    console.log('❌ Deployment not accessible:', error.message);
    console.log('💡 Make sure you have deployed to Vercel and the URL is correct');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Vercel Serverless API Test Suite');
  console.log('====================================\n');

  // Check if deployment is accessible
  const isAccessible = await checkDeployment();
  
  if (!isAccessible) {
    console.log('\n❌ Cannot proceed with tests - deployment not accessible');
    console.log('\n📝 To fix this:');
    console.log('1. Deploy to Vercel: vercel --prod');
    console.log('2. Update VERCEL_URL in this script with your actual URL');
    console.log('3. Run this test again');
    return;
  }

  // Run API tests
  await testServerlessAPI();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testServerlessAPI, checkDeployment };
