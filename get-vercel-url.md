# How to Get Your Vercel Deployment URL

## Method 1: Check Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Sign in to your account
3. Look for your "solwars" project
4. Click on it to see the deployment URL
5. It should look like: `https://solwars-xxx.vercel.app`

## Method 2: Install Vercel CLI and Check
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# List your deployments
vercel ls

# Get project info
vercel --prod
```

## Method 3: Check GitHub Integration
If you connected your GitHub repo to Vercel:
1. Go to your GitHub repository
2. Look for "Environments" or "Deployments" section
3. Find the Vercel deployment URL there

## Method 4: Check Recent Deployments
1. In Vercel dashboard, go to your project
2. Click on "Deployments" tab
3. Find the most recent successful deployment
4. Copy the URL from there

## What to Do Once You Have the URL

1. Replace `https://your-app.vercel.app` in `test-vercel-deployment.js` with your actual URL
2. Run: `node test-vercel-deployment.js`
3. This will test all your API endpoints on Vercel

## Common Vercel URLs Format
- `https://solwars.vercel.app`
- `https://solwars-git-main-yourusername.vercel.app`
- `https://solwars-xxx-yourusername.vercel.app`

## If You Don't Have a Vercel Deployment Yet

1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`
4. Follow the prompts to deploy your project

The CLI will give you the deployment URL after successful deployment.
