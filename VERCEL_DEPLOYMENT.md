# SolWars Vercel Deployment Guide

## 🚀 Quick Deployment Steps

### 1. Database Setup
- Create a PostgreSQL database (recommend Neon, Supabase, or PlanetScale)
- Get your DATABASE_URL connection string

### 2. Vercel Environment Variables
Add these environment variables in your Vercel dashboard:

```
DATABASE_URL=your_postgresql_connection_string
```

### 3. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 4. Initialize Database
After deployment, call the setup endpoint to create sample tournaments:

```bash
curl -X POST https://your-vercel-url.vercel.app/api/setup
```

## 📁 File Structure for Vercel

```
solwars/
├── api/                          # Vercel API routes
│   ├── tournaments.js           # Tournament CRUD operations
│   ├── setup.js                 # Database initialization
│   ├── prices/
│   │   └── current.js           # Real-time price data
│   └── trading/
│       └── portfolio/
│           └── [tournamentId]/
│               └── [walletAddress].js
├── vercel.json                  # Vercel configuration
├── package.json                 # Dependencies
├── prisma/                      # Database schema
├── index.html                   # Frontend
├── tournament.js                # Tournament management (updated for polling)
├── script.js                    # Main game logic
├── auth.js                      # Wallet authentication
└── styles.css                   # Styling
```

## 🔧 Key Changes for Vercel

### 1. WebSocket → Polling
- Replaced WebSocket with HTTP polling every 5 seconds
- Uses `/api/prices/current` endpoint for real-time price updates

### 2. API Routes
- All server endpoints moved to `/api/` folder
- Each endpoint is a separate file with `export default function handler(req, res)`

### 3. Database Connection
- Uses Prisma with connection pooling
- Properly disconnects after each API call

## 🎯 Features Working on Vercel

✅ **Tournament Loading**: Fetches tournaments from `/api/tournaments`
✅ **Real-time Prices**: Polling-based price updates every 5 seconds
✅ **Portfolio Tracking**: User portfolio and holdings
✅ **Tournament Creation**: Setup endpoint creates sample tournaments
✅ **Responsive Design**: Full mobile and desktop support

## 🚨 Known Limitations

❌ **WebSocket**: Not supported on Vercel (replaced with polling)
❌ **Server-side Cron**: Tournament cleanup needs external service
❌ **File Storage**: No persistent file system (use external storage if needed)

## 🔄 Real-time Updates

Instead of WebSocket, the app now uses:
- **Price Polling**: Every 5 seconds from `/api/prices/current`
- **Portfolio Updates**: After each trade execution
- **Tournament Refresh**: Manual refresh button

## 🎮 Testing the Deployment

1. **Visit your Vercel URL**
2. **Check tournaments load**: Should see sample tournaments
3. **Connect wallet**: Test Phantom wallet connection
4. **View price updates**: Prices should update every 5 seconds
5. **Join tournament**: Test tournament entry flow

## 📊 Monitoring

- Check Vercel Function logs for API errors
- Monitor database connections
- Watch for rate limiting on external APIs

## 🔧 Troubleshooting

### Tournaments not loading (404)
- Ensure `/api/tournaments.js` is deployed
- Check Vercel function logs
- Verify DATABASE_URL environment variable

### Database connection errors
- Verify DATABASE_URL format
- Check database is accessible from Vercel
- Ensure Prisma schema is up to date

### Price updates not working
- Check `/api/prices/current` endpoint
- Verify polling is initialized in browser console
- Look for CORS errors

## 🚀 Production Optimizations

1. **Database**: Use connection pooling
2. **Caching**: Add Redis for price caching
3. **CDN**: Use Vercel's edge network
4. **Monitoring**: Add error tracking (Sentry)
5. **Analytics**: Track user engagement

## 📱 Mobile Support

The app is fully responsive and works on:
- ✅ Desktop browsers
- ✅ Mobile browsers
- ✅ Phantom mobile wallet
- ✅ Touch interactions

Ready for epic trading battles! 🏆⚔️
