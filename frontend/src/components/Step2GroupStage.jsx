import { useState, useEffect } from 'react';
import { Shuffle, ArrowRight, Edit, Loader2 } from 'lucide-react'; // Ajout Loader2
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'; // Ajout DialogFooter
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { drawGroups, updateScore, completeGroupStage } from '../api'; // Import API calls

const Step2GroupStage = ({ tournamentId, players, groups, onGroupsDrawn, onScoreUpdate, onCompleteGroups }) => {
  const [generatedGroups, setGeneratedGroups] = useState(groups || []);
  const [selectedMatch, setSelectedMatch] = useState(null); // { groupIndex: number, matchId: string }
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false); // Pour le bouton Tirage
  const [isSavingScore, setIsSavingScore] = useState(false); // Pour le bouton Valider score
  const [isCompleting, setIsCompleting] = useState(false); // Pour le bouton Terminer
  const [startGroupAnimation, setStartGroupAnimation] = useState(false); // Nouvel état
  const { toast } = useToast();

  useEffect(() => {
    setGeneratedGroups(groups || []);
  }, [groups]);

  const handleDrawGroups = async () => {
    if (!tournamentId) {
        toast({ title: "Erreur", description: "ID du tournoi manquant.", variant: "destructive"});
        return;
    }
    setIsDrawing(true);
    try {
      const updatedTournament = await drawGroups(tournamentId);
      setTimeout(() => {
        setStartGroupAnimation(true);
      }, 50; // Délai pour déclencher l'animation
      onGroupsDrawn(updatedTournament); // Met à jour l'état parent
       toast({ title: 'Tirage effectué', description: `${updatedTournament.groups.length} poule(s) créée(s) !`});
    } catch (error) {
      toast({ title: 'Erreur API', description: "Impossible de tirer les groupes.", variant: 'destructive' });
      console.error("Failed to draw groups:", error);
      setStartGroupAnimation(false); // Assure-toi de le remettre à false en cas d'erreur
    } finally {
      setIsDrawing(false);
    }
  };

  const handleMatchClick = (groupIndex, match) => {
    // Permet de modifier même si déjà joué
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
       onScoreUpdate(updatedTournament); // Met à jour l'état parent
       setIsDialogOpen(false);
       setScore1('');
       setScore2('');
       setSelectedMatch(null);
       // Trouver les noms pour le toast
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
      // 1. Appelle l'API
      const updatedTournament = await completeGroupStage(tournamentId);
      
      // 2. Prévient le parent AVEC les nouvelles données
      onCompleteGroups(updatedTournament); 
      
      toast({ title: 'Phase de poules terminée !', description: 'Affichage des qualifiés.' });
    } catch (error) {
      // Affiche l'erreur du backend (ex: "matchs non joués")
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
        {generatedGroups.length === 0 && (
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
                     <thead>
                       <tr className="border-b border-gray-700">
                         <th className="text-left py-2 px-2 text-gray-400">Joueur</th>
                         <th className="text-center py-2 px-1 text-gray-400">J</th>
                         <th className="text-center py-2 px-1 text-gray-400">G</th>
                         <th className="text-center py-2 px-1 text-gray-400">N</th>
                         <th className="text-center py-2 px-1 text-gray-400">P</th>
                         <th className="text-center py-2 px-1 text-gray-400">BP</th>
                         <th className="text-center py-2 px-1 text-gray-400">BC</th>
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
                           <td className="text-center py-2 px-1 text-gray-300">{player.played}</td>
                           <td className="text-center py-2 px-1 text-green-400">{player.won}</td>
                           <td className="text-center py-2 px-1 text-yellow-400">{player.drawn}</td>
                           <td className="text-center py-2 px-1 text-red-400">{player.lost}</td>
                           <td className="text-center py-2 px-1 text-gray-300">{player.goalsFor}</td>
                           <td className="text-center py-2 px-1 text-gray-300">{player.goalsAgainst}</td>
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
                       key={match.id || matchIndex} // Utilise l'ID du match s'il existe
                       onClick={() => handleMatchClick(groupIndex, match)}
                       className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 transition-all duration-200 border border-gray-700 hover:border-cyan-500 group"
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
                           <Edit className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                         </div>
                         <span className="text-white font-medium">{match.player2}</span>
                       </div>
                     </button>
                   ))}
                 </div>
               </div>
             ))}
           </div>

           {allMatchesPlayed && (
             <div className="flex justify-center mt-8">
              <Button
  onClick={handleCompleteStageClick} // <-- MODIFIÉ
  disabled={isCompleting} // <-- AJOUTÉ
  className="py-6 px-8 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
>
  {/* --- Lignes modifiées ci-dessous --- */}
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
             <DialogFooter> {/* Ajout du Footer pour aligner les boutons */}
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
