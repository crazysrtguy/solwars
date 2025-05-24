// Debug deployment issues
require('dotenv').config();
const axios = require('axios');

async function debugDeployment() {
  console.log('🔍 Debugging Deployment Issues...\n');

  // Test 1: Check if local server is running
  console.log('1️⃣ Testing Local Server...');
  try {
    const response = await axios.get('http://localhost:3000/auth/challenge', { timeout: 5000 });
    console.log('✅ Local server is running and responding');
    console.log(`📊 Response: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.log('❌ Local server issue:', error.message);
  }

  // Test 2: Check local API structure
  console.log('\n2️⃣ Testing Local API Endpoints...');
  const localEndpoints = [
    '/auth/challenge',
    '/tournaments',
    '/tokens/trending?limit=3',
    '/user/profile?wallet=test'
  ];

  for (const endpoint of localEndpoints) {
    try {
      const response = await axios.get(`http://localhost:3000${endpoint}`, { timeout: 5000 });
      console.log(`✅ ${endpoint}: Working`);
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.response?.status || 'ERROR'} - ${error.message}`);
    }
  }

  // Test 3: Check if Vercel CLI is available
  console.log('\n3️⃣ Checking Vercel CLI...');
  try {
    const { exec } = require('child_process');
    exec('vercel --version', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Vercel CLI not installed');
        console.log('💡 Install with: npm install -g vercel');
      } else {
        console.log('✅ Vercel CLI available:', stdout.trim());
      }
    });
  } catch (error) {
    console.log('❌ Error checking Vercel CLI');
  }

  // Test 4: Check project structure
  console.log('\n4️⃣ Checking Project Structure...');
  const fs = require('fs');
  const path = require('path');

  const requiredFiles = [
    'vercel.json',
    'package.json',
    'api/health.js',
    'api/auth/challenge.js',
    'api/tournaments.js'
  ];

  for (const file of requiredFiles) {
    if (fs.existsSync(path.join(__dirname, file))) {
      console.log(`✅ ${file}: Exists`);
    } else {
      console.log(`❌ ${file}: Missing`);
    }
  }

  // Test 5: Check environment variables
  console.log('\n5️⃣ Checking Environment Variables...');
  const requiredEnvVars = [
    'DATABASE_URL',
    'HELIUS_RPC',
    'TREASURY_WALLET'
  ];

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: Set`);
    } else {
      console.log(`❌ ${envVar}: Missing`);
    }
  }

  console.log('\n📋 Deployment Checklist:');
  console.log('1. ✅ Fix API endpoints (completed)');
  console.log('2. ❓ Deploy to Vercel');
  console.log('3. ❓ Set environment variables in Vercel dashboard');
  console.log('4. ❓ Test Vercel deployment URL');

  console.log('\n💡 Next Steps:');
  console.log('1. Get your Vercel deployment URL');
  console.log('2. Test the URL with: node test-vercel-deployment.js');
  console.log('3. Check Vercel dashboard for deployment logs');
  console.log('4. Verify environment variables are set in Vercel');
}

if (require.main === module) {
  debugDeployment().catch(console.error);
}

module.exports = { debugDeployment };
