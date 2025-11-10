/* Fichier: frontend/src/components/Step2GroupStage.jsx */
import { useState, useEffect, useMemo } from 'react';
// On enlève Shuffle
import { ArrowRight, Edit, Loader2, Lock } from 'lucide-react'; 
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'; 
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
// On enlève drawGroups
import { updateScore, completeGroupStage } from '../api'; 

// AJOUT DE CETTE FONCTION HELPER (copiée du backend)
const getTargetQualifiedCount = (totalPlayers) => {
  if (totalPlayers <= 8) return 4;
  if (totalPlayers <= 16) return 8;
  return totalPlayers >= 24 ? 16 : 8;
};

const Step2GroupStage = ({ tournamentId, players, groups, onGroupsDrawn, onScoreUpdate, onCompleteGroups, isAdmin }) => {
  const [generatedGroups, setGeneratedGroups] = useState(groups || []);
  const [selectedMatch, setSelectedMatch] = useState(null); 
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // On enlève isDrawing
  const [isSavingScore, setIsSavingScore] = useState(false); 
  const [isCompleting, setIsCompleting] = useState(false); 
  const [startGroupAnimation, setStartGroupAnimation] = useState(false); 
  const { toast } = useToast();

  useEffect(() => {
    setGeneratedGroups(groups || []);
    if (groups && groups.length > 0) {
        setTimeout(() => setStartGroupAnimation(true), 50);
    }
  }, [groups]);

  // LA FONCTION handleDrawGroups EST SUPPRIMÉE

  const handleMatchClick = (groupIndex, match) => {
    if (!isAdmin) {
        toast({ title: 'Mode Spectateur', description: 'Vous ne pouvez pas modifier les scores.', variant: 'default' });
        return;
    }
    setSelectedMatch({ groupIndex, matchId: match.id });
    setScore1(match.score1 !== null ? match.score1.toString() : '');
    setScore2(match.score2 !== null ? match.score2.toString() : '');
    setIsDialogOpen(true);
  };

  const handleScoreSubmit = async () => {
     if (score1 === '' || score2 === '') {
       toast({ title: 'Erreur', description: 'Veuillez entrer les deux scores.', variant: 'destructive' });
       return;
     }
     const s1 = parseInt(score1);
     const s2 = parseInt(score2);
     if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
       toast({ title: 'Erreur', description: 'Scores invalides.', variant: 'destructive' });
       return;
     }
     if (!selectedMatch) return;
     setIsSavingScore(true);
     try {
       const updatedTournament = await updateScore(tournamentId, selectedMatch.matchId, s1, s2);
       onScoreUpdate(updatedTournament); 
       setIsDialogOpen(false);
       setScore1('');
       setScore2('');
       setSelectedMatch(null);
        const group = updatedTournament.groups[selectedMatch.groupIndex];
        const match = group.matches.find(m => m.id === selectedMatch.matchId);
        toast({ title: 'Score enregistré', description: `${match.player1} ${s1} - ${s2} ${match.player2}`});
     } catch (error) {
         toast({ title: 'Erreur API', description: "Impossible d'enregistrer le score.", variant: 'destructive' });
         console.error("Failed to update score:", error);
     } finally {
        setIsSavingScore(false);
     }
  };

  const handleCompleteStageClick = async () => {
    setIsCompleting(true);
    try {
      const updatedTournament = await completeGroupStage(tournamentId);
      onCompleteGroups(updatedTournament); 
      toast({ title: 'Phase de poules terminée !', description: 'Affichage des qualifiés.' });
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Impossible de passer à la suite.";
      toast({ title: 'Erreur', description: errorMsg, variant: 'destructive' });
      console.error("Failed to complete group stage:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  const allMatchesPlayed = useMemo(() => 
    generatedGroups.every((group) =>
      group.matches.every((match) => match.played)
    ), [generatedGroups]);

  const allPlayersRanked = useMemo(() => {
    if (generatedGroups.length === 0) {
      return [];
    }
    const allPlayers = generatedGroups.flatMap(group => 
      group.players.map(player => ({
        ...player,
        groupName: group.name 
      }))
    );
    allPlayers.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.goalDiff !== b.goalDiff) return b.goalDiff - a.goalDiff;
      if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
      return 0;
    });
    return allPlayers;
  }, [generatedGroups]); 

  const targetQualifiedCount = getTargetQualifiedCount(players.length);


  return (
     <div className="max-w-7xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Phase de Poules</h2>
        
        {/* LE BOUTON "Lancer le tirage" A ÉTÉ SUPPRIMÉ */}
        
        {generatedGroups.length === 0 && (
            <p className="text-gray-400">Aucun groupe n'a été généré.</p>
        )}
      </div>

       {generatedGroups.length > 0 && (
         <>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             {generatedGroups.map((group, groupIndex) => (
               <div
                 key={groupIndex}
                 className={`bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700 group-card-reveal ${startGroupAnimation ? 'visible' : ''}`}
                 style={{ transitionDelay: `${groupIndex * 150}ms` }}
               >
                 <h3 className="text-2xl font-bold text-cyan-400 mb-4">Poule {group.name}</h3>

                 <div className="overflow-x-auto mb-6">
                   <table className="w-full text-sm">
                     <thead>
                       <tr className="border-b border-gray-700">
                         <th className="text-left py-2 px-2 text-gray-400">Joueur</th>
                         <th className="hidden sm:table-cell text-center py-2 px-1 text-gray-400">J</th>
                         <th className="hidden sm:table-cell text-center py-2 px-1 text-gray-400">G</th>
                         <th className="hidden sm:table-cell text-center py-2 px-1 text-gray-400">N</th>
                         <th className="hidden sm:table-cell text-center py-2 px-1 text-gray-400">P</th>
                         <th className="hidden md:table-cell text-center py-2 px-1 text-gray-400">BP</th>
                         <th className="hidden md:table-cell text-center py-2 px-1 text-gray-400">BC</th>
                         <th className="text-center py-2 px-1 text-gray-400">Diff</th>
                         <th className="text-center py-2 px-1 text-gray-400 font-bold">Pts</th>
                       </tr>
                     </thead>
                     <tbody>
                       {group.players.map((player, playerIndex) => (
                         <tr
                           key={playerIndex}
                           className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${player.groupPosition <= 2 ? 'bg-green-900/10' : ''}`}
                         >
                           <td className="py-2 px-2 text-white font-medium">{player.name}</td>
                           <td className="hidden sm:table-cell text-center py-2 px-1 text-gray-300">{player.played}</td>
                           <td className="hidden sm:table-cell text-center py-2 px-1 text-green-400">{player.won}</td>
                           <td className="hidden sm:table-cell text-center py-2 px-1 text-yellow-400">{player.drawn}</td>
                           <td className="hidden sm:table-cell text-center py-2 px-1 text-red-400">{player.lost}</td>
                           <td className="hidden md:table-cell text-center py-2 px-1 text-gray-300">{player.goalsFor}</td>
                           <td className="hidden md:table-cell text-center py-2 px-1 text-gray-300">{player.goalsAgainst}</td>
                           <td className="text-center py-2 px-1 text-gray-300">{player.goalDiff > 0 ? '+' : ''}{player.goalDiff}</td>
                           <td className="text-center py-2 px-1 text-cyan-400 font-bold">{player.points}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>

                 <div className="space-y-2">
                   <h4 className="text-sm font-semibold text-gray-400 mb-2">Matchs</h4>
                   {group.matches.map((match, matchIndex) => (
                     <button
                       key={match.id || matchIndex} 
                       onClick={() => handleMatchClick(groupIndex, match)}
                       className={`w-full bg-gradient-to-r from-gray-800/70 to-gray-900/50 rounded-lg p-3 transition-all duration-300 border border-gray-700/50 group text-left ${
                         isAdmin ? 'hover:from-gray-700/80 hover:to-gray-800/60 hover:border-cyan-400/80 hover:shadow-md hover:shadow-cyan-500/20 cursor-pointer' : 'cursor-default'
                       }`}
                       disabled={!isAdmin} 
                     >
                       <div className="flex justify-between items-center">
                         <span className="text-white font-medium">{match.player1}</span>
                         <div className="flex items-center gap-2">
                           {match.played ? (
                             <span className="text-cyan-400 font-bold">
                               {match.score1} - {match.score2}
                             </span>
                           ) : (
                             <span className="text-gray-500">vs</span>
                           )}
                           
                           {isAdmin ? (
                                <Edit className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                           ) : (
                                <Lock className="w-4 h-4 text-gray-600" />
                           )}
                         </div>
                         <span className="text-white font-medium">{match.player2}</span>
                       </div>
                     </button>
                   ))}
                 </div>
               </div>
             ))}
           </div>

           {/* --- CLASSEMENT GÉNÉRAL --- */}
           {allMatchesPlayed && (
             <div className="mt-12 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700">
               <h3 className="text-2xl font-bold text-cyan-400 mb-4 text-center">Classement Général (Provisoire)</h3>
               <p className="text-center text-gray-400 mb-6">
                 Voici le classement général de tous les joueurs. Les {targetQualifiedCount} premiers (surlignés en vert) seront qualifiés.
                 {isAdmin && " Vous pouvez encore modifier les scores des poules ci-dessus si nécessaire avant de valider."}
               </p>
               
               <div className="overflow-x-auto max-h-[600px] overflow-y-auto pr-2">
                 <table className="w-full text-sm">
                   <thead>
                     <tr className="border-b border-gray-700">
                       <th className="text-left py-2 px-2 text-gray-400">Rank</th>
                       <th className="text-left py-2 px-2 text-gray-400">Joueur</th>
                       <th className="text-center py-2 px-1 text-gray-400">Poule</th>
                       <th className="text-center py-2 px-1 text-gray-400">Pts</th>
                       <th className="text-center py-2 px-1 text-gray-400">Diff</th>
                       <th className="text-center py-2 px-1 text-gray-400">BP</th>
                       <th className="text-center py-2 px-1 text-gray-400">Statut (Provisoire)</th>
                     </tr>
                   </thead>
                   <tbody>
                     {allPlayersRanked.map((player, index) => {
                       const rank = index + 1;
                       const isQualified = rank <= targetQualifiedCount;
                       
                       return (
                         <tr
                           key={player.name}
                           className={`border-b border-gray-800 transition-colors ${
                             isQualified ? 'bg-green-900/20' : ''
                           }`}
                         >
                           <td className={`py-2 px-2 font-medium ${isQualified ? 'text-green-400' : 'text-gray-500'}`}>{rank}</td>
                           <td className={`py-2 px-2 font-medium ${isQualified ? 'text-white' : 'text-gray-400'}`}>{player.name}</td>
                           <td className={`text-center py-2 px-1 ${isQualified ? 'text-gray-300' : 'text-gray-500'}`}>{player.groupName}</td>
                           <td className={`text-center py-2 px-1 font-bold ${isQualified ? 'text-white' : 'text-gray-400'}`}>{player.points}</td>
                           <td className={`text-center py-2 px-1 ${isQualified ? 'text-gray-300' : 'text-gray-500'}`}>{player.goalDiff > 0 ? '+' : ''}{player.goalDiff}</td>
                           <td className={`text-center py-2 px-1 ${isQualified ? 'text-gray-300' : 'text-gray-500'}`}>{player.goalsFor}</td>
                           <td className="text-center py-2 px-1 font-medium">
                             {isQualified ? (
                               <span className="text-green-400">Qualifié</span>
                             ) : (
                               <span className="text-red-400 opacity-70">Éliminé</span>
                             )}
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             </div>
           )}

           {isAdmin && allMatchesPlayed && (
             <div className="flex justify-center mt-8">
              <Button
                onClick={handleCompleteStageClick} 
                disabled={isCompleting} 
                className="py-6 px-8 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
              >
                {isCompleting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <ArrowRight className="ml-2 w-5 h-5" />}
                {isCompleting ? "Validation..." : "Terminer la phase de poules et voir les qualifiés"}
              </Button>
             </div>
           )}
         </>
       )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">
              {selectedMatch && generatedGroups[selectedMatch.groupIndex]?.matches.find(m => m.id === selectedMatch.matchId) && (
                <>
                  {generatedGroups[selectedMatch.groupIndex].matches.find(m => m.id === selectedMatch.matchId).player1}
                  <span className="text-cyan-400 mx-2">vs</span>
                  {generatedGroups[selectedMatch.groupIndex].matches.find(m => m.id === selectedMatch.matchId).player2}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label className="text-gray-300 mb-2 block">
                   {selectedMatch && generatedGroups[selectedMatch.groupIndex]?.matches.find(m => m.id === selectedMatch.matchId)?.player1}
                 </Label>
                 <Input
                   type="number"
                   min="0"
                   value={score1}
                   onChange={(e) => setScore1(e.target.value)}
                   placeholder="Score"
                   className="text-2xl text-center bg-gray-800 border-gray-600 text-white"
                   disabled={isSavingScore}
                 />
               </div>
               <div>
                 <Label className="text-gray-300 mb-2 block">
                    {selectedMatch && generatedGroups[selectedMatch.groupIndex]?.matches.find(m => m.id === selectedMatch.matchId)?.player2}
                 </Label>
                 <Input
                   type="number"
                   min="0"
                   value={score2}
                   onChange={(e) => setScore2(e.target.value)}
                   placeholder="Score"
                   className="text-2xl text-center bg-gray-800 border-gray-600 text-white"
                    disabled={isSavingScore}
                 />
               </div>
             </div>
             <DialogFooter> 
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSavingScore}>Annuler</Button>
                <Button
                    onClick={handleScoreSubmit}
                    disabled={isSavingScore || score1 === '' || score2 === ''}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                >
                    {isSavingScore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSavingScore ? "Enregistrement..." : "Enregistrer le score"}
                </Button>
             </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
     </div>
  );
};

export default Step2GroupStage;