# SolWars Prisma Cloud Setup

## Step 1: Get Your Database Connection String

1. Go to your Prisma Console: https://console.prisma.io/cm8hrdxr70017n0hw3cbekv04/cmalcqghc001ym5geno442mo5/cmalcqghc001zm5geehzmay3e/database/overview

2. In the Database section, find your connection string. It should look like:
   ```
   postgresql://username:password@host:port/database?sslmode=require
   ```

3. Copy this connection string.

## Step 2: Update .env File

1. Open the `.env` file in your project
2. Replace `YOUR_PRISMA_CLOUD_DATABASE_URL_HERE` with your actual connection string:
   ```
   DATABASE_URL="postgresql://your-actual-connection-string-here"
   ```

## Step 3: Run Database Migration

Once you've updated the .env file, run these commands:

```bash
# Generate Prisma client
npx prisma generate

# Run the migration to create all tournament tables
npx prisma migrate dev --name init_tournament_system

# (Optional) Open Prisma Studio to view your database
npx prisma studio
```

## Step 4: Verify Setup

After the migration completes, you should see these new tables in your database:
- Tournament
- TournamentParticipant  
- TokenPriceSnapshot
- TokenTransaction
- SwarsTransaction
- JackpotPool

Plus the existing tables:
- User
- Leaderboard
- GameSession

## Step 5: Start the Server

```bash
npm run dev
```

The server will automatically:
- Create sample tournaments
- Start real-time price feeds
- Initialize the SWARS token system
- Set up WebSocket connections for live updates

## Troubleshooting

### Connection Issues
- Make sure your DATABASE_URL is correct
- Check that your Prisma Cloud database is running
- Verify you have the right permissions

### Migration Issues
If you get migration errors:
```bash
npx prisma migrate reset
npx prisma migrate dev --name init_tournament_system
```

### Permission Issues
Make sure you're running the commands in the correct directory (`solwars/`) and have the necessary permissions.

## What's Next?

Once the database is set up:
1. 🏆 Epic tournaments will be automatically created
2. 💎 SWARS token system will be active
3. 📊 Real-time price feeds will start
4. 🎮 Users can connect wallets and join tournaments
5. 🚀 Trading battles begin!

The tournament platform is now ready for epic Solana trading competitions!
