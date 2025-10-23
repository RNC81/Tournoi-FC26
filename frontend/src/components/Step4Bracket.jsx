import { useState, useEffect } from 'react';
import { Trophy, Edit, Crown, Loader2 } from 'lucide-react'; // Ajout Loader2
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'; // Ajout DialogFooter
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { updateScore } from '../api'; // Import API call

const Step4Bracket = ({ tournamentId, knockoutMatches, onScoreUpdate, winner, onFinish, groups }) => {
  const [matches, setMatches] = useState(knockoutMatches || []);
  const [selectedMatch, setSelectedMatch] = useState(null); // Juste l'objet match
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [champion, setChampion] = useState(winner);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const { toast } = useToast();

   // Mettre à jour si les props changent (ex: après mise à jour score)
    // Lignes 17-21 (CORRIGÉES)
    // Mettre à jour l'état local si les props changent
  useEffect(() => {
      setMatches(knockoutMatches || []);
  }, [knockoutMatches]); // Dépendance: knockoutMatches

  useEffect(() => {
      setChampion(winner);
  }, [winner]); // Dépendance: winner


  const handleMatchClick = (match) => {
    if (!match.player1 || !match.player2) {
      toast({ title: 'Match non prêt', description: 'Les joueurs ne sont pas encore déterminés.', variant: 'destructive'});
      return;
    }
     // Permet de modifier même si déjà joué
    setSelectedMatch(match);
    setScore1(match.score1 !== null && match.score1 !== undefined ? match.score1.toString() : '');
    setScore2(match.score2 !== null && match.score2 !== undefined ? match.score2.toString() : '');
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
    if (s1 === s2) {
      toast({ title: 'Erreur', description: 'Match nul interdit en phase finale.', variant: 'destructive' });
      return;
    }
     if (!selectedMatch) return;

     setIsSavingScore(true);
     try {
        const updatedTournament = await updateScore(tournamentId, selectedMatch.id, s1, s2);
        // Si c'était la finale, le backend aura mis à jour le gagnant
        if (updatedTournament.winner) {
            onFinish(updatedTournament); // Notifie le parent que le tournoi est fini
        } else {
            onScoreUpdate(updatedTournament); // Met juste à jour l'état knockout
        }

        setIsDialogOpen(false);
        setScore1('');
        setScore2('');
        setSelectedMatch(null);
         toast({ title: 'Score enregistré', description: `${selectedMatch.player1} ${s1} - ${s2} ${selectedMatch.player2}`});

     } catch (error) {
         toast({ title: 'Erreur API', description: "Impossible d'enregistrer le score.", variant: 'destructive' });
         console.error("Failed to update knockout score:", error);
     } finally {
        setIsSavingScore(false);
     }
  };

  const getRoundName = (round, totalRounds) => {
    const roundsFromEnd = totalRounds - round;
    if (roundsFromEnd === 1) return 'Finale';
    if (roundsFromEnd === 2) return 'Demi-finales';
    if (roundsFromEnd === 3) return 'Quarts de finale';
    if (roundsFromEnd === 4) return '8èmes de finale';
    if (roundsFromEnd === 5) return '16èmes de finale';
    return `Tour ${round + 1}`;
  };

  const totalRounds = matches.length > 0 ? Math.max(...matches.map((m) => m.round)) + 1 : 0;
  const roundsData = Array.from({ length: totalRounds }).map((_, roundIndex) => ({
      name: getRoundName(roundIndex, totalRounds),
      matches: matches.filter(m => m.round === roundIndex)
  }));


  return (
    <div className="max-w-full mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Tableau Final - Élimination Directe</h2>
      </div>

      {champion && (
         <div className="bg-gradient-to-br from-yellow-900/40 to-gray-800 rounded-2xl p-8 shadow-2xl border-4 border-yellow-500/50 text-center">
           <Crown className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-pulse" />
           <h2 className="text-4xl font-bold text-yellow-400 mb-2">Champion du Tournoi !</h2>
           <p className="text-5xl font-black text-white">{champion}</p>
         </div>
       )}
      
      {champion && groups && groups.length > 0 && (
        <div className="mt-12 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700">
          <h3 className="text-2xl font-bold text-center text-gray-300 mb-6">Classement Final (Phase de Poules)</h3>
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
            {/* Calcul et tri du classement */}
            {groups.flatMap(g => g.players) // Met tous les joueurs dans une seule liste
              .sort((a, b) => { // Trie selon les critères standards
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
                if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
                return a.name.localeCompare(b.name); // Ordre alphabétique en cas d'égalité parfaite
              })
              .map((player, index) => (
                <div key={player.name} className={`flex items-center justify-between p-3 rounded-lg border ${
                    index === 0 ? 'bg-yellow-900/30 border-yellow-600/50' : // Met en surbrillance le 1er (basé sur les poules)
                    index < 8 ? 'bg-gray-800 border-gray-700' : // Style normal pour les suivants
                    'bg-gray-800/50 border-gray-700/50 opacity-80' // Style un peu estompé pour les non-qualifiés
                }`}>
                  <div className="flex items-center space-x-3">
                    <span className={`font-bold text-lg ${index === 0 ? 'text-yellow-400' : index < 8 ? 'text-gray-200' : 'text-gray-400'}`}>
                      #{index + 1}
                    </span>
                    <span className={`font-medium ${index === 0 ? 'text-white' : 'text-gray-100'}`}>{player.name}</span>
                  </div>
                  <div className="text-right text-sm">
                    <span className={`font-semibold ${index === 0 ? 'text-yellow-300' : 'text-cyan-400'}`}>{player.points} pts</span>
                    <span className="ml-3 text-gray-400">Diff: {player.goalDiff > 0 ? '+' : ''}{player.goalDiff} ({player.goalsFor} BP)</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {matches.length > 0 && !champion && (
        <div className="overflow-x-auto pb-4">
            <div className="flex gap-8 min-w-max px-4">
              {roundsData.map((round, roundIndex) => (
                <div key={roundIndex} className="flex flex-col w-72 flex-shrink-0">
                  <h3 className="text-xl font-bold text-cyan-400 text-center mb-4 pb-2 border-b-2 border-cyan-700">
                    {round.name}
                  </h3>
                  <div className="space-y-4 flex-grow flex flex-col justify-around">
                    {round.matches.map((match) => (
                      <div
                        key={match.id}
                        className={`bg-gradient-to-r from-gray-800/80 to-gray-900/60 rounded-xl p-3 shadow-lg border border-gray-700/60 transition-all duration-300 ${(match.player1 && match.player2 && !match.winner) ? 'hover:border-cyan-400/80 hover:shadow-cyan-500/20 cursor-pointer' : ''}`}
                         onClick={() => (match.player1 && match.player2 && !match.winner) ? handleMatchClick(match) : null}
                      >
                        <div className="space-y-2">
                          <div
                          className={`flex justify-between items-center px-3 py-1.5 rounded-md transition-colors duration-200 ${ // py augmenté
                            match.winner === match.player1
                              ? 'bg-green-700/40 border border-green-500/70 text-white font-semibold' // Style gagnant renforcé
                              : match.played ? 'bg-gray-800/40 text-gray-400 opacity-70' // Style perdant/joué
                              : 'bg-gray-700/50 text-gray-100' // Style par défaut (non joué)
                            }`}
                          >
                            <span className="text-white font-medium truncate">{match.player1 || '...'}</span>
                            {match.played && (
                              <span className="text-cyan-400 font-bold">{match.score1}</span>
                            )}
                          </div>
                          <div
                          className={`flex justify-between items-center px-3 py-1.5 rounded-md transition-colors duration-200 ${ // py augmenté
                            match.winner === match.player2
                              ? 'bg-green-700/40 border border-green-500/70 text-white font-semibold' // Style gagnant renforcé
                              : match.played ? 'bg-gray-800/40 text-gray-400 opacity-70' // Style perdant/joué
                              : 'bg-gray-700/50 text-gray-100' // Style par défaut (non joué)
                            }`}
                          >
                            <span className="text-white font-medium truncate">{match.player2 || '...'}</span>
                            {match.played && (
                              <span className="text-cyan-400 font-bold">{match.score2}</span>
                            )}
                          </div>
                          {match.player1 && match.player2 && !match.winner && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-2 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-cyan-500 text-xs py-1"
                                     onClick={(e) => { e.stopPropagation(); handleMatchClick(match); }} // Empêche la propagation si dans un conteneur cliquable
                                >
                                    <Edit className="w-3 h-3 mr-1" />
                                    Entrer Score
                                </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
        </div>
      )}

       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
         <DialogContent className="bg-gray-900 border-gray-700">
           <DialogHeader>
             <DialogTitle className="text-2xl text-white">
               {selectedMatch && (
                 <>
                   {selectedMatch.player1}
                   <span className="text-cyan-400 mx-2">vs</span>
                   {selectedMatch.player2}
                 </>
               )}
             </DialogTitle>
           </DialogHeader>
           <div className="space-y-6 mt-4">
             <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-3">
               <p className="text-yellow-400 text-sm text-center">
                 En phase finale, il ne peut pas y avoir de match nul.
               </p>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label className="text-gray-300 mb-2 block">{selectedMatch?.player1}</Label>
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
                 <Label className="text-gray-300 mb-2 block">{selectedMatch?.player2}</Label>
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
                    disabled={isSavingScore || score1 === '' || score2 === '' || score1 === score2}
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

export default Step4Bracket;
