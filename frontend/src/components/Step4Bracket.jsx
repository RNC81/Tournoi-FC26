import { useState, useEffect } from 'react';
import { Trophy, Edit, Crown, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { updateScore } from '../api';
// Pas besoin d'importer Math

const Step4Bracket = ({ tournamentId, knockoutMatches, onScoreUpdate, winner, onFinish, groups, thirdPlace }) => {
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

  const handleMatchClick = (match) => {
    if (!match || !match.player1 || !match.player2) { // Ajout vérification match
      toast({ title: 'Match non prêt', description: 'Les joueurs ne sont pas encore déterminés.', variant: 'destructive' });
      return;
    }
    setSelectedMatch(match);
    setScore1(match.score1 !== null && match.score1 !== undefined ? match.score1.toString() : '');
    setScore2(match.score2 !== null && match.score2 !== undefined ? match.score2.toString() : '');
    setIsDialogOpen(true);
  };

  // Calcule totalRounds basé sur les matchs principaux (exclut petite finale)
  const mainBracketMatches = matches.filter(m => m && !m.id.startsWith("match_third_place_")); // Ajout vérification m
  const maxRound = mainBracketMatches.length > 0 ? Math.max(0, ...mainBracketMatches.map((m) => m ? m.round : -1)) : -1; // Ajout vérification m et Math.max(0, ...)
  const totalRounds = maxRound >= 0 ? maxRound + 1 : 0;

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

    // Vérifie si le match est la petite finale ou la finale pour l'interdiction du nul
    const isFinalOrThirdPlace = selectedMatch?.id?.startsWith("match_third_place_") || selectedMatch?.round === (totalRounds - 1);
    if (isFinalOrThirdPlace && s1 === s2) {
      toast({ title: 'Erreur', description: 'Match nul interdit pour la Finale et la 3ème place.', variant: 'destructive' });
      return;
    }
    if (!selectedMatch) return;

    setIsSavingScore(true);
    try {
      const updatedTournament = await updateScore(tournamentId, selectedMatch.id, s1, s2);
      onScoreUpdate(updatedTournament); // Notifie toujours le parent pour rafraîchir

      // Vérifie si le tournoi est terminé (champion ET 3e place déterminés)
      // On compare avec les données reçues APRES la mise à jour
      if (updatedTournament.winner && updatedTournament.thirdPlace) {
        onFinish(updatedTournament); // Notifie spécifiquement la fin
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
    // Utilise currentTotalRounds passé en argument
    if (currentTotalRounds === 0) return "Phase Finale"; // Cas où il n'y a pas de rounds
    const roundsFromEnd = currentTotalRounds - round;
    if (roundsFromEnd === 1) return 'Finale';
    if (roundsFromEnd === 2) return 'Demi-finales';
    if (roundsFromEnd === 3) return 'Quarts de finale';
    if (roundsFromEnd === 4) return '8èmes de finale';
    if (roundsFromEnd === 5) return '16èmes de finale';
    return `Tour ${round + 1}`;
  };


  // Crée les données pour les rounds principaux
  const roundsData = Array.from({ length: totalRounds }).map((_, roundIndex) => ({
    name: getRoundName(roundIndex, totalRounds),
    matches: mainBracketMatches.filter(m => m && m.round === roundIndex) // Ajout vérification m
  }));

  // Trouve le match pour la 3e place séparément
  const thirdPlaceMatch = matches.find(m => m && m.id.startsWith("match_third_place_")); // Ajout vérification m


  // Fonction pour rendre une carte de match (factorisation)
  const renderMatchCard = (match) => {
    if (!match) return null; // Sécurité ajoutée

    return (
      <div
        key={match.id}
        className={`bg-gradient-to-r from-gray-800/80 to-gray-900/60 rounded-xl p-3 shadow-lg border border-gray-700/60 transition-all duration-300 ${
          (match.player1 && match.player2 && !match.winner) ? 'hover:border-cyan-400/80 hover:shadow-cyan-500/20 cursor-pointer' : ''
        }`}
        onClick={() => (match.player1 && match.player2 && !match.winner) ? handleMatchClick(match) : null}
      >
        <div className="space-y-2">
          {/* Joueur 1 */}
          <div
            className={`flex justify-between items-center px-3 py-1.5 rounded-md transition-colors duration-200 ${
              match.winner === match.player1
                ? 'bg-green-700/40 border border-green-500/70 text-white font-semibold'
                : match.played ? 'bg-gray-800/40 text-gray-400 opacity-70'
                : 'bg-gray-700/50 text-gray-100'
            }`}
          >
            {/* Utilisation de text-white générique, la couleur vient du fond */}
            <span className="font-medium truncate">{match.player1 || '...'}</span>
            {match.played && match.score1 !== null && ( // Ajout check score1 !== null
              <span className="text-cyan-400 font-bold">{match.score1}</span>
            )}
          </div>
          {/* Joueur 2 */}
          <div
            className={`flex justify-between items-center px-3 py-1.5 rounded-md transition-colors duration-200 ${
              match.winner === match.player2
                ? 'bg-green-700/40 border border-green-500/70 text-white font-semibold'
                : match.played ? 'bg-gray-800/40 text-gray-400 opacity-70'
                : 'bg-gray-700/50 text-gray-100'
            }`}
          >
             {/* Utilisation de text-white générique */}
            <span className="font-medium truncate">{match.player2 || '...'}</span>
            {match.played && match.score2 !== null && ( // Ajout check score2 !== null
              <span className="text-cyan-400 font-bold">{match.score2}</span>
            )}
          </div>
          {/* Bouton Score */}
          {match.player1 && match.player2 && !match.winner && (
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

      {/* Affichage Champion */}
      {champion && (
        <div className="bg-gradient-to-br from-yellow-900/40 to-gray-800 rounded-2xl p-8 shadow-2xl border-4 border-yellow-500/50 text-center">
          <Crown className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-4xl font-bold text-yellow-400 mb-2">Champion du Tournoi !</h2>
          <p className="text-5xl font-black text-white">{champion}</p>
        </div>
      )}

      {/* Affichage du Podium */}
      {champion && thirdPlaceWinner && matches && matches.length > 0 && (
        <div className="mt-12 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700">
          <h3 className="text-3xl font-bold text-center text-gray-200 mb-8">Podium Final</h3>
          <div className="flex flex-col md:flex-row justify-around items-center gap-8">
            {(() => { // Début IIFE
              const finalMatch = matches.find(m => m && m.round === totalRounds - 1 && !m.id.startsWith("match_third_place_")); // Ajout check m
              const secondPlace = finalMatch && finalMatch.player1 && finalMatch.player2 // Ajout check player1/player2
                ? (finalMatch.player1 === champion ? finalMatch.player2 : finalMatch.player1)
                : 'Non déterminé';

              return ( // Début return IIFE
                <>
                  {/* 2ème Place */}
                  <div className="text-center order-2 md:order-1">
                    <p className="text-6xl mb-2">🥈</p>
                    <p className="text-2xl font-semibold text-gray-300">2ème Place</p>
                    <p className="text-3xl font-bold text-gray-100 mt-1">{secondPlace || '...'}</p> {/* Fallback affichage */}
                  </div>
                  {/* 1ère Place */}
                  <div className="text-center order-1 md:order-2 scale-110">
                    <p className="text-7xl mb-2">🥇</p>
                    <p className="text-3xl font-bold text-yellow-400">CHAMPION</p>
                    <p className="text-4xl font-extrabold text-white mt-1">{champion}</p>
                  </div>
                  {/* 3ème Place */}
                  <div className="text-center order-3 md:order-3">
                    <p className="text-6xl mb-2">🥉</p>
                    <p className="text-2xl font-semibold text-orange-400">3ème Place</p>
                    <p className="text-3xl font-bold text-gray-100 mt-1">{thirdPlaceWinner}</p>
                  </div>
                </>
              ); // Fin return IIFE
            })()}{/* Fin appel IIFE */}
          </div> {/* Fin div flex podium */}
        </div> // Fin div carte podium
      )} {/* Fin condition podium */}


      {/* Affichage du Tableau (si tournoi non fini) */}
      {!champion && matches.length > 0 && (
        <div className="overflow-x-auto pb-4">
            <div className="flex gap-8 min-w-max px-4">
              {/* Boucle sur les rounds principaux */}
              {roundsData.map((round, roundIndex) => (
                // Vérifie s'il y a des matchs dans ce round avant d'afficher la colonne
                round.matches && round.matches.length > 0 && (
                    <div key={roundIndex} className="flex flex-col w-72 flex-shrink-0">
                    <h3 className={`text-xl font-bold text-center mb-4 pb-2 border-b-2 ${
                        round.name === 'Finale' ? 'text-yellow-400 border-yellow-700' : 'text-cyan-400 border-cyan-700'
                    }`}>
                        {round.name}
                    </h3>
                    <div className="space-y-4 flex-grow flex flex-col justify-around">
                        {/* Affiche les cartes des matchs du round */}
                        {round.matches.map(renderMatchCard)}
                    </div>
                    </div>
                )
              ))}

              {/* Colonne séparée pour la Petite Finale */}
              {thirdPlaceMatch && (
                 <div className="flex flex-col w-72 flex-shrink-0">
                   <h3 className="text-xl font-bold text-orange-400 text-center mb-4 pb-2 border-b-2 border-orange-700">
                     Match 3ème Place
                   </h3>
                   <div className="space-y-4 flex-grow flex flex-col justify-around">
                     {/* Affiche seulement la carte de la petite finale */}
                     {renderMatchCard(thirdPlaceMatch)}
                   </div>
                 </div>
              )}
            </div> {/* Fin div flex gap-8 */}
        </div> // Fin div overflow-x-auto
      )} {/* Fin condition !champion */}


       {/* Dialog pour entrer les scores */}
       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
         <DialogContent className="bg-gray-900 border-gray-700">
           <DialogHeader>
             <DialogTitle className="text-2xl text-white">
               {selectedMatch && (
                 <>
                   {selectedMatch.player1 || 'Joueur 1'} {/* Fallback affichage */}
                   <span className="text-cyan-400 mx-2">vs</span>
                   {selectedMatch.player2 || 'Joueur 2'} {/* Fallback affichage */}
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
                    // La condition disabled vérifie le nul seulement si c'est la finale ou 3e place
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
    </div> // Fin div principale
  ); // Fin return
}; // Fin composant

export default Step4Bracket;