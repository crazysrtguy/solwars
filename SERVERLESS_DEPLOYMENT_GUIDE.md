# 🚀 Vercel Serverless Functions Deployment Guide

## ✅ Issues Fixed for Serverless

### 1. **Prisma Client Management**
- ✅ Created centralized Prisma client in `api/_lib/prisma.js`
- ✅ Proper connection pooling for serverless environment
- ✅ Automatic disconnection after each function execution

### 2. **Module System Standardization**
- ✅ All API files now use CommonJS (`module.exports`)
- ✅ Removed all ES module syntax (`export default`, `import`)
- ✅ Consistent require statements throughout

### 3. **CORS Headers**
- ✅ Added CORS headers to all endpoints
- ✅ OPTIONS method support for preflight requests
- ✅ Proper error handling with CORS

### 4. **Serverless Function Structure**
- ✅ Each API file follows Vercel serverless function pattern
- ✅ Proper request/response handling
- ✅ Environment variable access
- ✅ Error handling and logging

## 📁 Updated File Structure

```
solwars/
├── api/
│   ├── _lib/
│   │   └── prisma.js              # Centralized Prisma client
│   ├── auth/
│   │   ├── challenge.js           # ✅ Fixed for serverless
│   │   └── verify.js              # ✅ Fixed for serverless
│   ├── user/
│   │   └── profile.js             # ✅ Fixed for serverless
│   ├── swars/
│   │   ├── balance.js             # ✅ Fixed for serverless
│   │   └── claim-daily.js         # ✅ Fixed for serverless
│   ├── tournaments/
│   │   └── [id].js                # ✅ Fixed for serverless
│   ├── tokens/
│   │   ├── trending.js            # ✅ Fixed for serverless
│   │   ├── prices.js              # ✅ Fixed for serverless
│   │   └── [address].js           # ✅ Fixed for serverless
│   ├── tournaments.js             # ✅ Fixed for serverless
│   ├── health.js                  # ✅ Already working
│   └── package.json               # API dependencies
├── vercel.json                    # ✅ Updated for serverless
└── test-serverless-api.js         # Test script
```

## 🔧 Deployment Steps

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy to Vercel
```bash
vercel --prod
```

### 4. Set Environment Variables
In your Vercel dashboard, add these environment variables:

```bash
# Required
DATABASE_URL=your_postgresql_connection_string
HELIUS_RPC=your_helius_rpc_endpoint

# Optional but recommended
TREASURY_WALLET=your_treasury_wallet_address
TREASURY_PRIVATE_KEY=your_treasury_private_key
SWARS_TOKEN_MINT=GMk6j2defJhS7F194toqmJNFNhAkbDXhYJo5oR3Rpump
NODE_ENV=production
```

### 5. Test Your Deployment
```bash
# Update the VERCEL_URL in the test script
node test-serverless-api.js
```

## 🧪 Testing Your API

### Manual Testing
Replace `YOUR_VERCEL_URL` with your actual deployment URL:

```bash
# Health check
curl https://YOUR_VERCEL_URL.vercel.app/api/health

# Authentication
curl https://YOUR_VERCEL_URL.vercel.app/api/auth/challenge

# Tournaments
curl https://YOUR_VERCEL_URL.vercel.app/api/tournaments

# User profile
curl "https://YOUR_VERCEL_URL.vercel.app/api/user/profile?wallet=AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR"

# SWARS balance
curl "https://YOUR_VERCEL_URL.vercel.app/api/swars/balance?wallet=AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR"

# Trending tokens
curl "https://YOUR_VERCEL_URL.vercel.app/api/tokens/trending?limit=5"

# Token prices (POST)
curl -X POST https://YOUR_VERCEL_URL.vercel.app/api/tokens/prices \
  -H "Content-Type: application/json" \
  -d '{"tokenAddresses":["So11111111111111111111111111111111111111112"]}'
```

### Automated Testing
```bash
# Update VERCEL_URL in test-serverless-api.js
VERCEL_URL=https://your-app.vercel.app node test-serverless-api.js
```

## 🔍 Troubleshooting

### Common Issues and Solutions

#### 1. **Function Timeout**
**Error:** Function execution timed out
**Solution:** 
- Check database connection speed
- Optimize queries
- Increase maxDuration in vercel.json (already set to 30s)

#### 2. **Module Not Found**
**Error:** Cannot find module '@prisma/client'
**Solution:**
- Ensure `api/package.json` includes all dependencies
- Redeploy: `vercel --prod`

#### 3. **Database Connection Failed**
**Error:** Can't reach database server
**Solution:**
- Verify DATABASE_URL in Vercel dashboard
- Check if database allows connections from Vercel IPs
- Test connection string locally

#### 4. **CORS Errors**
**Error:** Access blocked by CORS policy
**Solution:**
- All endpoints now include CORS headers
- Check browser console for specific errors
- Verify OPTIONS requests are handled

#### 5. **Environment Variables Missing**
**Error:** process.env.DATABASE_URL is undefined
**Solution:**
- Add all environment variables in Vercel dashboard
- Redeploy after adding variables

## 📊 Expected Results

After successful deployment, all these endpoints should return 200 OK:

✅ `GET /api/health` - Health check  
✅ `GET /api/auth/challenge` - Authentication challenge  
✅ `GET /api/tournaments` - Tournament listing  
✅ `GET /api/user/profile?wallet={address}` - User profile  
✅ `GET /api/swars/balance?wallet={address}` - SWARS balance  
✅ `GET /api/tokens/trending?limit=5` - Trending tokens  
✅ `POST /api/tokens/prices` - Token prices  
✅ `POST /api/swars/claim-daily` - Daily bonus claim  

## 🎯 Key Improvements Made

### Performance
- Centralized Prisma client with connection pooling
- Proper connection cleanup after each function
- Optimized database queries
- 30-second timeout for complex operations

### Reliability
- Comprehensive error handling
- Proper CORS support
- Environment variable validation
- Graceful fallbacks

### Maintainability
- Consistent code structure across all endpoints
- Centralized database connection logic
- Clear error messages and logging
- Modular function design

## 🚀 Your API is Now Ready!

All serverless functions have been properly configured for Vercel deployment. The API should work correctly with:

- ✅ Proper database connections
- ✅ CORS support for frontend integration
- ✅ Error handling and logging
- ✅ Environment variable support
- ✅ Scalable serverless architecture

Deploy with `vercel --prod` and test with the provided scripts!
