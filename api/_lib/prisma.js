// Prisma client for Vercel serverless functions
const { PrismaClient } = require('@prisma/client');

// Global variable to store the Prisma client instance
let prisma;

// Initialize Prisma client with proper configuration for serverless
function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
  }
  return prisma;
}

// Helper function to safely disconnect Prisma client
async function disconnectPrisma() {
  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error('Error disconnecting Prisma:', error);
    }
  }
}

module.exports = {
  getPrismaClient,
  disconnectPrisma
};
