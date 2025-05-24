# Vercel Deployment Fix Guide

## 🚨 Issues Fixed

### 1. **Missing Dependencies in API Package**
- ✅ Updated `api/package.json` with all required dependencies
- ✅ Added Prisma postinstall script for automatic client generation
- ✅ Synchronized versions with main package.json

### 2. **Prisma Configuration for Serverless**
- ✅ Enhanced `api/_lib/prisma.js` with better error handling
- ✅ Added environment variable validation
- ✅ Optimized for serverless cold starts
- ✅ Added database connection testing

### 3. **Vercel Configuration Improvements**
- ✅ Updated `vercel.json` with proper build commands
- ✅ Increased memory allocation to 1024MB
- ✅ Added proper environment variable handling
- ✅ Enhanced CORS headers

### 4. **Schema Availability**
- ✅ Copied Prisma schema to `api/prisma/schema.prisma`
- ✅ Ensures schema is available during Vercel build

### 5. **Enhanced Health Check**
- ✅ Added comprehensive environment variable checking
- ✅ Database connection testing
- ✅ Runtime information reporting

## 🔧 Deployment Steps

### Step 1: Environment Variables in Vercel
Go to your Vercel dashboard and add these environment variables:

```bash
# Database (REQUIRED)
DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY

# Solana Configuration (REQUIRED)
HELIUS_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
TREASURY_WALLET=AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR
TREASURY_PRIVATE_KEY=YOUR_PRIVATE_KEY
SWARS_TOKEN_MINT=GMk6j2defJhS7F194toqmJNFNhAkbDXhYJo5oR3Rpump

# API Keys (REQUIRED)
HELIUS_API_URL=https://api.helius.xyz/v0
JWT_SECRET=solwars_super_secret_jwt_key_2024

# Optional Configuration
NODE_ENV=production
DEFAULT_TOURNAMENT_ENTRY_FEE_SOL=0.01
DEFAULT_TOURNAMENT_ENTRY_FEE_SWARS=100
TOURNAMENT_PRIZE_POOL_PERCENTAGE=0.9
PLATFORM_FEE_PERCENTAGE=0.1
DAILY_BONUS_MIN=10
DAILY_BONUS_MAX=50
TOURNAMENT_REWARD_MULTIPLIER=1.5
PRICE_UPDATE_INTERVAL=30000
TOURNAMENT_UPDATE_INTERVAL=60000
```

### Step 2: Deploy to Vercel
```bash
# Option 1: Using Vercel CLI
npm install -g vercel
vercel --prod

# Option 2: Git Push (if connected to GitHub)
git add .
git commit -m "Fix Vercel serverless deployment"
git push origin main
```

### Step 3: Test Deployment
```bash
# Run the test script
node test-vercel-deployment.js

# Or test manually
curl https://your-app.vercel.app/api/health
```

## 🧪 Testing Your Deployment

### Quick Health Check
```bash
curl https://solwars-bigch.vercel.app/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "SolWars Tournament Platform is running!",
  "features": {
    "database": true,
    "tournaments": true,
    "realTimePrices": true,
    "walletAuth": true,
    "trading": true
  },
  "envVars": {
    "DATABASE_URL": true,
    "HELIUS_RPC": true,
    "TREASURY_WALLET": true,
    "SWARS_TOKEN_MINT": true
  }
}
```

### Full Test Suite
```bash
node test-vercel-deployment.js
```

## 🔍 Troubleshooting

### Common Issues & Solutions

#### 1. **500 Internal Server Error**
- Check Vercel function logs
- Verify all environment variables are set
- Ensure DATABASE_URL is correct

#### 2. **Database Connection Failed**
- Verify DATABASE_URL format
- Check Prisma Cloud dashboard
- Ensure database is accessible

#### 3. **Module Not Found Errors**
- Redeploy to trigger fresh build
- Check `api/package.json` dependencies
- Verify Prisma client generation

#### 4. **CORS Issues**
- Check `vercel.json` headers configuration
- Verify API endpoints handle OPTIONS requests

### Debug Commands
```bash
# Check Vercel logs
vercel logs

# Test specific endpoint
curl -v https://your-app.vercel.app/api/health

# Check environment variables
vercel env ls
```

## 📊 Expected API Endpoints

After successful deployment, these endpoints should work:

- ✅ `GET /api/health` - Health check with environment status
- ✅ `GET /api/tournaments` - List active tournaments
- ✅ `GET /api/auth/challenge` - Authentication challenge
- ✅ `GET /api/user/profile?wallet=ADDRESS` - User profile
- ✅ `GET /api/swars/balance?wallet=ADDRESS` - SWARS balance
- ✅ `GET /api/tokens/trending?limit=5` - Trending tokens
- ✅ `POST /api/tokens/prices` - Token price data

## 🎯 Next Steps

1. **Test all endpoints** using the test script
2. **Monitor Vercel logs** for any runtime errors
3. **Update frontend** to use production API URLs
4. **Set up monitoring** for API performance

## 🚀 Performance Optimizations

The fixes include:
- **Cold start optimization** for Prisma client
- **Memory allocation** increased to 1024MB
- **Connection pooling** for database
- **Efficient error handling** to prevent crashes
- **Caching headers** for better performance

Your APIs should now work correctly on Vercel! 🎉
