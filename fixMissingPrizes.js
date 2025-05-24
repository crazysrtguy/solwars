const { PrismaClient } = require('@prisma/client');
const TournamentService = require('./services/tournamentService');

const prisma = new PrismaClient();
const tournamentService = new TournamentService();

async function fixMissingPrizes() {
  try {
    console.log('🔧 Fixing missing prize claims for ended tournaments...');
    
    // Find ended tournaments with participants but no prize claims
    const endedTournaments = await prisma.tournament.findMany({
      where: { 
        status: 'ENDED',
        participants: {
          some: {} // Has at least one participant
        }
      },
      include: { 
        participants: true,
        prizeClaims: true
      }
    });
    
    console.log(`Found ${endedTournaments.length} ended tournaments`);
    
    for (const tournament of endedTournaments) {
      if (tournament.participants.length > 0 && tournament.prizeClaims.length === 0) {
        console.log(`\n🏆 Processing tournament: ${tournament.name}`);
        console.log(`  Participants: ${tournament.participants.length}`);
        
        try {
          // Get the leaderboard to determine winners
          const leaderboard = await tournamentService.getTournamentLeaderboard(tournament.id);
          console.log(`  Leaderboard entries: ${leaderboard.length}`);
          
          if (leaderboard.length > 0) {
            // Get prize structure
            const prizeStructure = await tournamentService.calculatePrizeStructure(tournament.id);
            console.log(`  Prize pool: ${prizeStructure.totalSolPrize.toFixed(4)} SOL`);
            
            // Create prize claims for top 3
            const winners = [];
            for (let i = 0; i < Math.min(3, leaderboard.length); i++) {
              const participant = leaderboard[i];
              const payout = prizeStructure.payouts[i];
              
              // Calculate bonus for SWARS entries
              let bonusAmount = 0;
              if (participant.entryType === 'SWARS') {
                bonusAmount = payout.bonusJackpot;
              }
              
              // Create prize claim record
              await prisma.prizeClaim.create({
                data: {
                  tournamentId: tournament.id,
                  walletAddress: participant.walletAddress,
                  rank: i + 1,
                  solPrize: payout.solPrize,
                  swarsPrize: bonusAmount,
                  claimed: false
                }
              });
              
              // Update participant record
              await prisma.tournamentParticipant.updateMany({
                where: {
                  tournamentId: tournament.id,
                  walletAddress: participant.walletAddress
                },
                data: {
                  finalRank: i + 1,
                  prizeWon: payout.solPrize,
                  bonusWon: bonusAmount
                }
              });
              
              winners.push({
                rank: i + 1,
                username: participant.username,
                walletAddress: participant.walletAddress,
                solPrize: payout.solPrize,
                bonusWon: bonusAmount
              });
              
              console.log(`    🥇 Rank ${i + 1}: ${participant.username} - ${payout.solPrize.toFixed(4)} SOL + ${bonusAmount.toFixed(0)} SWARS`);
            }
            
            console.log(`  ✅ Created ${winners.length} prize claims`);
          } else {
            console.log(`  ⚠️ No leaderboard data found`);
          }
        } catch (error) {
          console.error(`  ❌ Error processing tournament ${tournament.name}:`, error.message);
        }
      } else if (tournament.prizeClaims.length > 0) {
        console.log(`\n✅ Tournament already has prize claims: ${tournament.name}`);
      } else {
        console.log(`\n⚠️ Tournament has no participants: ${tournament.name}`);
      }
    }
    
    console.log('\n🎉 Finished fixing missing prize claims!');
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error fixing missing prizes:', error);
    await prisma.$disconnect();
  }
}

fixMissingPrizes();
