# 🚀 Quick Fix Guide for Vercel API Issues

## Current Status
✅ **Working:** Local server, API files, environment variables  
❌ **Issue:** Need to test/deploy to Vercel

## Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

## Step 2: Deploy to Vercel
```bash
# Login to Vercel
vercel login

# Deploy your project
vercel --prod
```

This will give you a deployment URL like: `https://solwars-xxx.vercel.app`

## Step 3: Set Environment Variables in Vercel

Go to your Vercel dashboard and add these environment variables:

```
DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlfa2V5IjoiMDFKVlhRTlkwMkMyMzBHWU1IOEVHV0VXWkUiLCJ0ZW5hbnRfaWQiOiIyNTIzNmRjM2IwMWJjNTZhNTg0NTFiNTVlODA5ZDFhMjVjM2MyZDg0MzQ1MTIwZThmMDE5ZmQyNWExOWM2ZjFkIiwiaW50ZXJuYWxfc2VjcmV0IjoiYzA0MTMwZGYtZWI5OC00NmJlLTkyNGQtMjQxZTI4NjVmYzUxIn0.sDM2-dbmhFkxOtuygz1P7kzzncfTZF-_RwqROuLFvNU

HELIUS_RPC=https://mainnet.helius-rpc.com/?api-key=4a99008b-ca4c-4d94-8589-f0b4a9eb6466

TREASURY_WALLET=AQtBZ1CdhWxFGfBgHirLyse9f8dRyZAuMWMQ6TALuHXR

TREASURY_PRIVATE_KEY=5EM1zrcyAB4g9HcNzZAuVet9W1Skw6DDSBinnepVpECcD5d18nPXkCvvqzRyStiTHdJyegvzcrWqBjAr6zppt9Nj

SWARS_TOKEN_MINT=GMk6j2defJhS7F194toqmJNFNhAkbDXhYJo5oR3Rpump

NODE_ENV=production
```

## Step 4: Test Your Deployment

1. Update `test-vercel-deployment.js` with your actual Vercel URL
2. Run: `node test-vercel-deployment.js`

## Step 5: Quick Test Commands

Once you have your Vercel URL, test these endpoints:

```bash
# Replace YOUR_URL with your actual Vercel URL

# Health check
curl https://YOUR_URL.vercel.app/api/health

# Authentication
curl https://YOUR_URL.vercel.app/api/auth/challenge

# Tournaments
curl https://YOUR_URL.vercel.app/api/tournaments

# Trending tokens
curl https://YOUR_URL.vercel.app/api/tokens/trending?limit=3
```

## Why Your Local Server Shows 404

Your local server (running on port 3000) uses routes like:
- `/auth/challenge` ✅ (works)
- `/tournaments` ✅ (works)

But Vercel uses the `/api/` prefix:
- `/api/auth/challenge` ✅ (Vercel structure)
- `/api/tournaments` ✅ (Vercel structure)

This is normal! Your local server and Vercel have different routing structures.

## Expected Results

After deployment, these should work:
- ✅ `https://your-url.vercel.app/api/health`
- ✅ `https://your-url.vercel.app/api/auth/challenge`
- ✅ `https://your-url.vercel.app/api/tournaments`
- ✅ `https://your-url.vercel.app/api/tokens/trending`
- ✅ `https://your-url.vercel.app/api/user/profile`
- ✅ `https://your-url.vercel.app/api/swars/balance`

## If You Already Have a Vercel Deployment

1. Find your Vercel URL in the dashboard
2. Test it with the commands above
3. If it's not working, redeploy with: `vercel --prod`

## Common Issues and Solutions

### Issue: "Function not found"
**Solution:** Redeploy with `vercel --prod`

### Issue: "Environment variable missing"
**Solution:** Add all environment variables in Vercel dashboard

### Issue: "Database connection failed"
**Solution:** Check DATABASE_URL is correct in Vercel

### Issue: "CORS errors"
**Solution:** All API files now include CORS headers

## Your API Files Are Ready! 🎉

All your API endpoints have been fixed and are ready for Vercel:
- ✅ CommonJS format (`module.exports`)
- ✅ CORS headers added
- ✅ Proper error handling
- ✅ Database integration
- ✅ Environment variable support

The only step left is deploying to Vercel and testing the live URL!
