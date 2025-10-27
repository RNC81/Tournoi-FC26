/* Modification de frontend/src/components/Step4Bracket.jsx */
import { useState, useEffect } from 'react';
import { Trophy, Edit, Crown, Loader2, Lock } from 'lucide-react'; // Ajout Lock
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { updateScore } from '../api';

// Ajout de isAdmin en prop
const Step4Bracket = ({ tournamentId, knockoutMatches, onScoreUpdate, winner, onFinish, groups, thirdPlace, isAdmin }) => {
  const [matches, setMatches] = useState(knockoutMatches || []);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [champion, setChampion] = useState(winner);
  const [thirdPlaceWinner, setThirdPlaceWinner] = useState(thirdPlace);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMatches(knockoutMatches || []);
  }, [knockoutMatches]);

  useEffect(() => {
    setChampion(winner);
  }, [winner]);

  useEffect(() => {
    setThirdPlaceWinner(thirdPlace);
  }, [thirdPlace]);

  // Calcule totalRounds (inchangé)
  const mainBracketMatches = matches.filter(m => m && !m.id.startsWith("match_third_place_")); 
  const maxRound = mainBracketMatches.length > 0 ? Math.max(0, ...mainBracketMatches.map((m) => m ? m.round : -1)) : -1; 
  const totalRounds = maxRound >= 0 ? maxRound + 1 : 0;
  
  // Définition de isFinalOrThirdPlace (inchangé)
  const isFinalOrThirdPlace = selectedMatch?.id?.startsWith("match_third_place_") || selectedMatch?.round === (totalRounds - 1);

  const handleMatchClick = (match) => {
    // VERROUILLAGE si !isAdmin
    if (!isAdmin) {
        toast({ title: 'Mode Spectateur', description: 'Vous ne pouvez pas modifier les scores.', variant: 'default' });
        return;
    }
      
    if (!match || !match.player1 || !match.player2) { 
      toast({ title: 'Match non prêt', description: 'Les joueurs ne sont pas encore déterminés.', variant: 'destructive' });
      return;
    }
    // Reste de la logique
    setSelectedMatch(match);
    setScore1(match.score1 !== null && match.score1 !== undefined ? match.score1.toString() : '');
    setScore2(match.score2 !== null && match.score2 !== undefined ? match.score2.toString() : '');
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

    if (isFinalOrThirdPlace && s1 === s2) {
      toast({ title: 'Erreur', description: 'Match nul interdit pour la Finale et la 3ème place.', variant: 'destructive' });
      return;
    }
    if (!selectedMatch) return;

    setIsSavingScore(true);
    try {
      const updatedTournament = await updateScore(tournamentId, selectedMatch.id, s1, s2);
      onScoreUpdate(updatedTournament); 

      if (updatedTournament.winner && updatedTournament.thirdPlace) {
        onFinish(updatedTournament); 
      }

      setIsDialogOpen(false);
      setScore1('');
      setScore2('');
      setSelectedMatch(null);
      toast({ title: 'Score enregistré', description: `${selectedMatch.player1} ${s1} - ${s2} ${selectedMatch.player2}` });

    } catch (error) {
      toast({ title: 'Erreur API', description: "Impossible d'enregistrer le score.", variant: 'destructive' });
      console.error("Failed to update knockout score:", error);
    } finally {
      setIsSavingScore(false);
    }
  };

  const getRoundName = (round, currentTotalRounds) => {
    // ... (logique inchangée)
    if (currentTotalRounds === 0) return "Phase Finale";
    const roundsFromEnd = currentTotalRounds - round;
    if (roundsFromEnd === 1) return 'Finale';
    if (roundsFromEnd === 2) return 'Demi-finales';
    if (roundsFromEnd === 3) return 'Quarts de finale';
    if (roundsFromEnd === 4) return '8èmes de finale';
    if (roundsFromEnd === 5) return '16èmes de finale';
    return `Tour ${round + 1}`;
  };


  // Crée les données pour les rounds (inchangé)
  const roundsData = Array.from({ length: totalRounds }).map((_, roundIndex) => ({
    name: getRoundName(roundIndex, totalRounds),
    matches: mainBracketMatches.filter(m => m && m.round === roundIndex) 
  }));

  const thirdPlaceMatch = matches.find(m => m && m.id.startsWith("match_third_place_")); 


  // Fonction pour rendre une carte de match (factorisation)
  const renderMatchCard = (match) => {
    if (!match) return null; 

    // VERROUILLAGE : définit le style de clic
    const isClickable = isAdmin && match.player1 && match.player2 && !match.winner;
    const clickHandler = isClickable ? () => handleMatchClick(match) : undefined;
    const cursorStyle = isClickable ? 'cursor-pointer' : 'cursor-default';
    const hoverStyle = isClickable ? 'hover:border-cyan-400/80 hover:shadow-cyan-500/20' : '';

    return (
      <div
        key={match.id}
        className={`bg-gradient-to-r from-gray-800/80 to-gray-900/60 rounded-xl p-3 shadow-lg border border-gray-700/60 transition-all duration-300 ${cursorStyle} ${hoverStyle}`}
        onClick={clickHandler}
      >
        <div className="space-y-2">
          {/* Joueur 1 (inchangé) */}
          <div
            className={`flex justify-between items-center px-3 py-1.5 rounded-md transition-colors duration-200 ${
              match.winner === match.player1
                ? 'bg-green-700/40 border border-green-500/70 text-white font-semibold'
                : match.played ? 'bg-gray-800/40 text-gray-400 opacity-70'
                : 'bg-gray-700/50 text-gray-100'
            }`}
          >
            <span className="font-medium truncate">{match.player1 || '...'}</span>
            {match.played && match.score1 !== null && ( 
              <span className="text-cyan-400 font-bold">{match.score1}</span>
            )}
          </div>
          {/* Joueur 2 (inchangé) */}
          <div
            className={`flex justify-between items-center px-3 py-1.5 rounded-md transition-colors duration-200 ${
              match.winner === match.player2
                ? 'bg-green-700/40 border border-green-500/70 text-white font-semibold'
                : match.played ? 'bg-gray-800/40 text-gray-400 opacity-70'
                : 'bg-gray-700/50 text-gray-100'
            }`}
          >
            <span className="font-medium truncate">{match.player2 || '...'}</span>
            {match.played && match.score2 !== null && ( 
              <span className="text-cyan-400 font-bold">{match.score2}</span>
            )}
          </div>
          
          {/* VERROUILLAGE : Bouton Score */}
          {isAdmin && match.player1 && match.player2 && !match.winner && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-1.5 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-cyan-500 text-xs py-0.5 h-6"
              onClick={(e) => { e.stopPropagation(); handleMatchClick(match); }}
            >
              <Edit className="w-3 h-3 mr-1" />
              Score
            </Button>
          )}
        </div>
      </div>
    );
  };


  return (
    <div className="max-w-full mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Tableau Final - Élimination Directe</h2>
      </div>

      {/* Affichage Champion (inchangé) */}
      {champion && (
        <div className="bg-gradient-to-br from-yellow-900/40 to-gray-800 rounded-2xl p-8 shadow-2xl border-4 border-yellow-500/50 text-center">
          <Crown className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-4xl font-bold text-yellow-400 mb-2">Champion du Tournoi !</h2>
          <p className="text-5xl font-black text-white">{champion}</p>
        </div>
      )}

      {/* Affichage du Podium (inchangé) */}
      {champion && thirdPlaceWinner && matches && matches.length > 0 && (
        <div className="mt-12 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700">
          <h3 className="text-3xl font-bold text-center text-gray-200 mb-8">Podium Final</h3>
          <div className="flex flex-col md:flex-row justify-around items-center gap-8">
            {(() => { 
              const finalMatch = matches.find(m => m && m.round === totalRounds - 1 && !m.id.startsWith("match_third_place_")); 
              const secondPlace = finalMatch && finalMatch.player1 && finalMatch.player2 
                ? (finalMatch.player1 === champion ? finalMatch.player2 : finalMatch.player1)
                : 'Non déterminé';

              return ( 
                <>
                  <div className="text-center order-2 md:order-1">
                    <p className="text-6xl mb-2">🥈</p>
                    <p className="text-2xl font-semibold text-gray-300">2ème Place</p>
                    <p className="text-3xl font-bold text-gray-100 mt-1">{secondPlace || '...'}</p> 
                  </div>
                  <div className="text-center order-1 md:order-2 scale-110">
                    <p className="text-7xl mb-2">🥇</p>
                    <p className="text-3xl font-bold text-yellow-400">CHAMPION</p>
                    <p className="text-4xl font-extrabold text-white mt-1">{champion}</p>
                  </div>
                  <div className="text-center order-3 md:order-3">
                    <p className="text-6xl mb-2">🥉</p>
                    <p className="text-2xl font-semibold text-orange-400">3ème Place</p>
                    <p className="text-3xl font-bold text-gray-100 mt-1">{thirdPlaceWinner}</p>
                  </div>
                </>
              ); 
            })()}
          </div> 
        </div> 
      )} 


      {/* Affichage du Tableau (inchangé, le verrouillage se fait dans renderMatchCard) */}
      {!champion && matches.length > 0 && (
        <div className="overflow-x-auto pb-4">
            <div className="flex gap-8 min-w-max px-4">
              {roundsData
                .filter(round => round.name !== 'Finale') 
                .map((round, roundIndex) => (
                  round.matches && round.matches.length > 0 && (
                      <div key={roundIndex} className="flex flex-col w-64 sm:w-72 flex-shrink-0"> 
                      <h3 className={`text-xl font-bold text-center mb-4 pb-2 border-b-2 ${
                          round.name === 'Finale' ? 'text-yellow-400 border-yellow-700' : 'text-cyan-400 border-cyan-700'
                      }`}>
                          {round.name}
                      </h3>
                      <div className="space-y-4 flex-grow flex flex-col justify-around">
                          {round.matches.map(renderMatchCard)}
                      </div>
                      </div>
                  )
              ))}

              {thirdPlaceMatch && (
                 <div className="flex flex-col w-64 sm:w-72 flex-shrink-0"> 
                   <h3 className="text-xl font-bold text-orange-400 text-center mb-4 pb-2 border-b-2 border-orange-700">
                     Match 3ème Place
                   </h3>
                   <div className="space-y-4 flex-grow flex flex-col justify-around">
                     {renderMatchCard(thirdPlaceMatch)}
                   </div>
                 </div>
              )}

              {roundsData
                .filter(round => round.name === 'Finale') 
                .map((round, roundIndex) => (
                  round.matches && round.matches.length > 0 && (
                      <div key="finale" className="flex flex-col w-64 sm:w-72 flex-shrink-0"> 
                      <h3 className={`text-xl font-bold text-center mb-4 pb-2 border-b-2 ${
                          round.name === 'Finale' ? 'text-yellow-400 border-yellow-700' : 'text-cyan-400 border-cyan-700'
                      }`}>
                          {round.name}
                      </h3>
                      <div className="space-y-4 flex-grow flex flex-col justify-around">
                          {round.matches.map(renderMatchCard)}
                      </div>
                      </div>
                  )
              ))}
            </div> 
        </div> 
      )} 


       {/* Dialog (inchangé, le verrouillage se fait à l'ouverture) */}
       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
         <DialogContent className="bg-gray-900 border-gray-700">
           <DialogHeader>
            {/* ... */}
             <DialogTitle className="text-2xl text-white">
               {selectedMatch && (
                 <>
                   {selectedMatch.player1 || 'Joueur 1'} 
                   <span className="text-cyan-400 mx-2">vs</span>
                   {selectedMatch.player2 || 'Joueur 2'} 
                 </>
               )}
             </DialogTitle>
           </DialogHeader>
           <div className="space-y-6 mt-4">
             <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-3">
               <p className="text-yellow-400 text-sm text-center">
                 Match nul interdit pour la Finale et la 3ème place.
               </p>
             </div>
             <div className="grid grid-cols-2 gap-4">
              {/* ... */}
               <div>
                 <Label className="text-gray-300 mb-2 block">{selectedMatch?.player1 || '...'}</Label>
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
                 <Label className="text-gray-300 mb-2 block">{selectedMatch?.player2 || '...'}</Label>
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
                    disabled={isSavingScore || score1 === '' || score2 === '' || (isFinalOrThirdPlace && score1 === score2)}
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