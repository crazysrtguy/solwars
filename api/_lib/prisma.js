// Prisma client for Vercel serverless functions
const { PrismaClient } = require('@prisma/client');

// Global variable to store the Prisma client instance
let prisma;

// Initialize Prisma client with proper configuration for serverless
function getPrismaClient() {
  if (!prisma) {
    console.log('🔄 Initializing Prisma client for serverless...');

    // Ensure DATABASE_URL is available
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      // Optimize for serverless
      __internal: {
        engine: {
          closePromise: undefined
        }
      }
    });

    console.log('✅ Prisma client initialized successfully');
  }
  return prisma;
}

// Helper function to safely disconnect Prisma client
async function disconnectPrisma() {
  if (prisma) {
    try {
      await prisma.$disconnect();
      console.log('🔌 Prisma client disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting Prisma:', error);
    } finally {
      prisma = null;
    }
  }
}

// Test database connection
async function testConnection() {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}

module.exports = {
  getPrismaClient,
  disconnectPrisma,
  testConnection
};
