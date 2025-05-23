# SolWars Database Setup Guide

## Option 1: Local PostgreSQL (Recommended for Development)

### Step 1: Install PostgreSQL
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Install with default settings
3. Remember the password you set for the `postgres` user

### Step 2: Create Database
Open PostgreSQL command line (psql) or pgAdmin and run:
```sql
CREATE DATABASE solwars;
```

### Step 3: Update .env file
Update the DATABASE_URL in your `.env` file:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/solwars"
```
Replace `YOUR_PASSWORD` with your PostgreSQL password.

### Step 4: Run Migrations
```bash
npx prisma migrate dev --name init
npx prisma generate
```

## Option 2: SQLite (Quick Setup)

If you want to get started quickly without PostgreSQL:

### Step 1: Update schema.prisma
Change the datasource in `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

### Step 2: Update .env
```
DATABASE_URL="file:./dev.db"
```

### Step 3: Run Migrations
```bash
npx prisma migrate dev --name init
npx prisma generate
```

## Option 3: Docker PostgreSQL (Easy Setup)

### Step 1: Create docker-compose.yml
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: solwars
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Step 2: Start Database
```bash
docker-compose up -d
```

### Step 3: Run Migrations
```bash
npx prisma migrate dev --name init
npx prisma generate
```

## Verification

After setup, verify everything works:
```bash
npx prisma studio
```

This will open Prisma Studio where you can see your database tables.

## Troubleshooting

### Permission Issues
If you get permission errors with Prisma:
1. Close all terminals/editors
2. Run as administrator
3. Try the migration again

### Connection Issues
- Make sure PostgreSQL is running
- Check your DATABASE_URL is correct
- Verify the database exists
- Check firewall settings

### Migration Issues
If migrations fail:
```bash
npx prisma migrate reset
npx prisma migrate dev --name init
```

## Next Steps

Once the database is set up:
1. Start the server: `npm run dev`
2. The tournament system will automatically create sample tournaments
3. Connect your wallet to start trading!
