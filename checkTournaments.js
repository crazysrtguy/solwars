const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEndedTournaments() {
  try {
    const endedTournaments = await prisma.tournament.findMany({
      where: { status: 'ENDED' },
      include: { 
        participants: true,
        prizeClaims: true
      }
    });
    
    console.log('Ended tournaments:', endedTournaments.length);
    
    for (const tournament of endedTournaments) {
      console.log(`Tournament: ${tournament.name}`);
      console.log(`  Participants: ${tournament.participants.length}`);
      console.log(`  Prize claims: ${tournament.prizeClaims.length}`);
      console.log(`  End time: ${tournament.endTime}`);
      console.log('---');
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkEndedTournaments();
