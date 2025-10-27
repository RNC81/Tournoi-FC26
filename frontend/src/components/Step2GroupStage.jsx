/* Modification de frontend/src/components/Step2GroupStage.jsx */
import { useState, useEffect } from 'react';
import { Shuffle, ArrowRight, Edit, Loader2, Lock } from 'lucide-react'; // Ajout Lock
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'; 
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { drawGroups, updateScore, completeGroupStage } from '../api'; 

// Ajout de isAdmin en prop
const Step2GroupStage = ({ tournamentId, players, groups, onGroupsDrawn, onScoreUpdate, onCompleteGroups, isAdmin }) => {
  const [generatedGroups, setGeneratedGroups] = useState(groups || []);
  const [selectedMatch, setSelectedMatch] = useState(null); 
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false); 
  const [isSavingScore, setIsSavingScore] = useState(false); 
  const [isCompleting, setIsCompleting] = useState(false); 
  const [startGroupAnimation, setStartGroupAnimation] = useState(false); 
  const { toast } = useToast();

  useEffect(() => {
    setGeneratedGroups(groups || []);
    // Déclenche l'animation si les groupes existent déjà au montage
    if (groups && groups.length > 0) {
        setTimeout(() => setStartGroupAnimation(true), 50);
    }
  }, [groups]);

  const handleDrawGroups = async () => {
    // ... (logique inchangée, déjà protégée par l'affichage du bouton)
    if (!tournamentId) {
        toast({ title: "Erreur", description: "ID du tournoi manquant.", variant: "destructive"});
        return;
    }
    setIsDrawing(true);
    try {
      const updatedTournament = await drawGroups(tournamentId);
      setTimeout(() => {
        setStartGroupAnimation(true);
      }, 50); 
      onGroupsDrawn(updatedTournament); 
       toast({ title: 'Tirage effectué', description: `${updatedTournament.groups.length} poule(s) créée(s) !`});
    } catch (error) {
      toast({ title: 'Erreur API', description: "Impossible de tirer les groupes.", variant: 'destructive' });
      console.error("Failed to draw groups:", error);
      setStartGroupAnimation(false); 
    } finally {
      setIsDrawing(false);
    }
  };

  const handleMatchClick = (groupIndex, match) => {
    // VERROUILLAGE si !isAdmin
    if (!isAdmin) {
        toast({ title: 'Mode Spectateur', description: 'Vous ne pouvez pas modifier les scores.', variant: 'default' });
        return;
    }
    
    // Reste de la logique
    setSelectedMatch({ groupIndex, matchId: match.id });
    setScore1(match.score1 !== null ? match.score1.toString() : '');
    setScore2(match.score2 !== null ? match.score2.toString() : '');
    setIsDialogOpen(true);
  };

  const handleScoreSubmit = async () => {
     // ... (logique inchangée)
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
    // ... (logique inchangée, déjà protégée par l'affichage du bouton)
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

  const allMatchesPlayed = generatedGroups.every((group) =>
    group.matches.every((match) => match.played)
  );

  return (
     <div className="max-w-7xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Phase de Poules</h2>
        
        {/* VERROUILLAGE : Bouton Tirage */}
        {isAdmin && generatedGroups.length === 0 && (
          <Button
            onClick={handleDrawGroups}
            disabled={isDrawing}
            className="py-6 px-8 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
          >
            {isDrawing ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Shuffle className="mr-2 w-6 h-6" />}
            {isDrawing ? "Tirage en cours..." : "Lancer le tirage au sort des poules"}
          </Button>
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
                     {/* ... (thead inchangé) ... */}
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
                         // ... (tr/td inchangés) ...
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
                       // VERROUILLAGE : change le style si !isAdmin
                       className={`w-full bg-gradient-to-r from-gray-800/70 to-gray-900/50 rounded-lg p-3 transition-all duration-300 border border-gray-700/50 group text-left ${
                         isAdmin ? 'hover:from-gray-700/80 hover:to-gray-800/60 hover:border-cyan-400/80 hover:shadow-md hover:shadow-cyan-500/20 cursor-pointer' : 'cursor-default'
                       }`}
                       disabled={!isAdmin} // Désactive sémantiquement
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
                           
                           {/* VERROUILLAGE : Affiche Edit ou Lock */}
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

            {/* VERROUILLAGE : Bouton Terminer */}
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

        {/* Le Dialog (popup score) ne s'ouvrira que si isAdmin grâce au handleMatchClick */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {/* ... (Contenu du Dialog inchangé) ... */}
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