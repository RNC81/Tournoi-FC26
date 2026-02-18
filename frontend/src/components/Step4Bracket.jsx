/* Fichier: frontend/src/components/Step4Bracket.jsx */
import { useState, useEffect, useRef } from 'react';
import { Trophy, Edit, Crown, Loader2, Shuffle, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { updateScore, redrawKnockout, generateNextRound } from '../api';

const Step4Bracket = ({ tournamentId, knockoutMatches, onScoreUpdate, winner, groups, thirdPlace, isAdmin, format }) => {
  const [matches, setMatches] = useState(knockoutMatches || []);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [champion, setChampion] = useState(winner);
  const [thirdPlaceWinner, setThirdPlaceWinner] = useState(thirdPlace);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [isRedrawing, setIsRedrawing] = useState(false);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [showRemixDialog, setShowRemixDialog] = useState(false);

  const topRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    setMatches(knockoutMatches || []);
  }, [knockoutMatches]);

  useEffect(() => {
    setChampion(winner);
    if (winner && topRef.current) {
      setTimeout(() => {
        topRef.current.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    }
  }, [winner]);

  useEffect(() => {
    setThirdPlaceWinner(thirdPlace);
  }, [thirdPlace]);

  // --- CALCULS ---
  const mainBracketMatches = matches.filter(m => m && !m.id.startsWith("match_third_place_"));
  const maxRound = mainBracketMatches.length > 0 ? Math.max(0, ...mainBracketMatches.map((m) => m ? m.round : -1)) : -1;
  const matchesInRound0 = mainBracketMatches.filter(m => m.round === 0).length;
  const totalRounds = matchesInRound0 > 0 ? Math.ceil(Math.log2(matchesInRound0 * 2)) : (maxRound + 1);
  const isFinalOrThirdPlace = selectedMatch?.id?.startsWith("match_third_place_") || selectedMatch?.round === (totalRounds - 1);

  // --- HANDLERS ---
  const handleMatchClick = (match) => {
    if (!isAdmin) return;
    if (!match || !match.player1 || !match.player2) {
      // toast({ title: 'Match non prêt', description: 'En attente des adversaires.', variant: 'default' });
      return;
    }
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

    if (isFinalOrThirdPlace && s1 === s2) {
      toast({ title: 'Erreur', description: 'Match nul interdit pour la Finale et la 3ème place.', variant: 'destructive' });
      return;
    }
    if (!selectedMatch) return;

    setIsSavingScore(true);
    try {
      const updatedTournament = await updateScore(tournamentId, selectedMatch.id, s1, s2);

      if (updatedTournament.winner) setChampion(updatedTournament.winner);
      if (updatedTournament.thirdPlace) setThirdPlaceWinner(updatedTournament.thirdPlace);

      onScoreUpdate(updatedTournament);

      setIsDialogOpen(false);
      setScore1(''); setScore2(''); setSelectedMatch(null);
      toast({ title: 'Score enregistré', description: `${selectedMatch.player1} ${s1} - ${s2} ${selectedMatch.player2}` });
    } catch (error) {
      toast({ title: 'Erreur API', description: "Impossible d'enregistrer le score.", variant: 'destructive' });
    } finally {
      setIsSavingScore(false);
    }
  };

  const handleRedraw = async () => {
    if (!isAdmin) return;
    const matchPlayed = matches.some(m => m.played);
    if (matchPlayed) {
      toast({ title: 'Action impossible', description: 'Matchs déjà joués.', variant: 'destructive' });
      return;
    }
    setIsRedrawing(true);
    try {
      const updatedTournament = await redrawKnockout(tournamentId);
      onScoreUpdate(updatedTournament);
      toast({ title: 'Tirage au sort relancé', description: 'Le tableau a été mélangé.' });
    } catch (error) {
      toast({ title: 'Erreur', description: "Impossible de relancer le tirage.", variant: 'destructive' });
    } finally {
      setIsRedrawing(false);
    }
  };

  const handleGenerateNextRound = async (remixChoice) => {
    if (!isAdmin) return;
    setIsGeneratingNext(true);
    setShowRemixDialog(false);
    try {
      const updatedTournament = await generateNextRound(tournamentId, remixChoice);
      onScoreUpdate(updatedTournament);
      const action = remixChoice ? "mélangées" : "conservées";
      toast({ title: "Tour suivant généré !", description: `Les équipes ont été ${action}.` });
    } catch (error) {
      console.error(error);
      let msg = "Erreur lors de la génération.";
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        msg = Array.isArray(detail) ? detail.map(e => e.msg).join(', ') : detail;
      }
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setIsGeneratingNext(false);
    }
  };

  const handleNextRoundClick = () => {
    // Si c'est un tournoi 2v2, afficher le modal de choix
    if (format === '2v2') {
      setShowRemixDialog(true);
    } else {
      // Sinon, générer directement (1v1 n'a pas de remix)
      handleGenerateNextRound(true);
    }
  };

  const currentRoundMatches = mainBracketMatches.filter(m => m.round === maxRound);
  const isCurrentRoundFinished = currentRoundMatches.length > 0 && currentRoundMatches.every(m => m.played && m.winner);
  const showNextRoundButton = isAdmin && isCurrentRoundFinished && !champion;

  const getRoundName = (round, total) => {
    if (total === 0) return "Phase Finale";
    const roundsFromEnd = total - round;
    if (roundsFromEnd === 1) return 'Finale';
    if (roundsFromEnd === 2) return 'Demi-finales';
    if (roundsFromEnd === 3) return 'Quarts de finale';
    if (roundsFromEnd === 4) return '8èmes de finale';
    return `Tour ${round + 1}`;
  };

  const roundsData = Array.from({ length: maxRound + 1 }).map((_, roundIndex) => ({
    name: getRoundName(roundIndex, totalRounds),
    matches: mainBracketMatches.filter(m => m && m.round === roundIndex)
  }));

  const thirdPlaceMatch = matches.find(m => m && m.id.startsWith("match_third_place_"));

  // --- RENDER CARD (DARK MODERN) ---
  const renderMatchCard = (match) => {
    if (!match) return null;
    const isClickable = isAdmin && match.player1 && match.player2;
    const cursorStyle = isClickable ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : 'cursor-default';
    const isCompleted = match.played && match.winner;

    return (
      <div
        key={match.id}
        className={`EF-card bg-[#1F1F1F] p-0 overflow-hidden border border-white/5 transition-all duration-300 shadow-md ${cursorStyle} ${isCompleted ? 'border-blue-500/20' : ''}`}
        onClick={() => isClickable && handleMatchClick(match)}
      >
        <div className="flex flex-col divide-y divide-white/5">
          {/* JOUEUR 1 */}
          <div className={`flex justify-between items-center p-3 relative ${match.winner === match.player1 ? 'bg-blue-500/10' : ''}`}>
            {match.winner === match.player1 && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400"></div>}
            <span className={`font-medium text-sm truncate uppercase ${match.winner === match.player1 ? 'text-white' : 'text-zinc-400'}`}>
              {match.player1 || <span className="text-zinc-600 italic text-xs">En attente</span>}
            </span>
            {match.played && <span className={`text-lg font-bold ${match.winner === match.player1 ? 'text-blue-400' : 'text-zinc-500'}`}>{match.score1}</span>}
          </div>

          {/* JOUEUR 2 */}
          <div className={`flex justify-between items-center p-3 relative ${match.winner === match.player2 ? 'bg-blue-500/10' : ''}`}>
            {match.winner === match.player2 && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400"></div>}
            <span className={`font-medium text-sm truncate uppercase ${match.winner === match.player2 ? 'text-white' : 'text-zinc-400'}`}>
              {match.player2 || <span className="text-zinc-600 italic text-xs">En attente</span>}
            </span>
            {match.played && <span className={`text-lg font-bold ${match.winner === match.player2 ? 'text-blue-400' : 'text-zinc-500'}`}>{match.score2}</span>}
          </div>

          {isAdmin && match.player1 && match.player2 && !match.played && (
            <div className="bg-[#141414] py-1 text-center">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Saisir le score</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-full mx-auto space-y-12 animate-in fade-in duration-500 pb-20">
      {/* Ancre invisible en haut pour le scroll */}
      <div ref={topRef} className="scroll-mt-24"></div>

      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Tableau Final</h2>
        <p className="text-zinc-500 mb-6">Suivez l'avancement des phases éliminatoires.</p>

        {isAdmin && !champion && matches.length > 0 && !matches.some(m => m.played) && (
          <Button variant="outline" size="sm" onClick={handleRedraw} disabled={isRedrawing} className="EF-btn-secondary text-sm h-8">
            {isRedrawing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Shuffle className="mr-2 h-3 w-3" />}
            {isRedrawing ? "Mélange..." : "Re-mélanger le tableau"}
          </Button>
        )}

        {showNextRoundButton && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
            <Button onClick={handleNextRoundClick} disabled={isGeneratingNext} className="EF-btn-primary py-6 px-8 text-lg hover:scale-105 transition-transform">
              {isGeneratingNext ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <ArrowRight className="mr-2 h-6 w-6" />}
              {isGeneratingNext ? "Génération..." : "Lancer le Tour Suivant"}
            </Button>
          </div>
        )}
      </div>

      {champion && (
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1F1F1F] to-black rounded-3xl p-10 border border-amber-500/30 text-center mb-12 animate-in zoom-in duration-500">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none"></div>
          <div className="relative z-10">
            <Crown className="w-24 h-24 text-amber-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
            <h2 className="text-2xl font-bold text-amber-500 uppercase tracking-widest mb-2">Grand Vainqueur</h2>
            <div className="text-6xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl">
              {champion}
            </div>
          </div>
        </div>
      )}

      {champion && (
        <div className="mb-16">
          <div className="flex flex-col md:flex-row justify-center items-end gap-4 md:gap-8">
            {(() => {
              const finalMatch = mainBracketMatches.find(m => m.round === maxRound && !matches.id?.startsWith("match_third_place_"));
              const secondPlace = finalMatch && finalMatch.player1 && finalMatch.player2
                ? (finalMatch.player1 === champion ? finalMatch.player2 : finalMatch.player1)
                : '???';

              return (
                <>
                  <div className="text-center order-2 md:order-1 flex flex-col items-center">
                    <div className="text-xl font-bold text-zinc-400 mb-2">2ème Place</div>
                    <div className="w-24 h-32 bg-zinc-800 rounded-t-xl flex items-end justify-center pb-4 border-t-4 border-zinc-500 shadow-xl">
                      <span className="text-4xl font-bold text-white">2</span>
                    </div>
                    <div className="mt-4 text-2xl font-bold text-white max-w-[150px] truncate">{secondPlace}</div>
                  </div>

                  <div className="text-center order-1 md:order-2 flex flex-col items-center z-10 -mb-6 md:mb-0">
                    <div className="text-2xl font-bold text-amber-400 mb-2">CHAMPION</div>
                    <div className="w-32 h-44 bg-blue-900 rounded-t-xl flex items-end justify-center pb-6 border-t-4 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.2)]">
                      <span className="text-6xl font-black text-white">1</span>
                    </div>
                    <div className="mt-4 text-4xl font-black text-white max-w-[200px] truncate">{champion}</div>
                  </div>

                  <div className="text-center order-3 md:order-3 flex flex-col items-center">
                    <div className="text-xl font-bold text-orange-700 mb-2">3ème Place</div>
                    <div className="w-24 h-24 bg-zinc-900 rounded-t-xl flex items-end justify-center pb-4 border-t-4 border-orange-700 shadow-xl">
                      <span className="text-4xl font-bold text-white">3</span>
                    </div>
                    <div className="mt-4 text-2xl font-bold text-white max-w-[150px] truncate">{thirdPlaceWinner || '-'}</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {matches.length > 0 && (
        <div className="overflow-x-auto pb-8 custom-scrollbar">
          <div className="flex gap-12 min-w-max px-8 justify-center">
            {roundsData.filter(round => round.name !== 'Finale').map((round, roundIndex) => (
              round.matches && round.matches.length > 0 && (
                <div key={roundIndex} className="flex flex-col w-72 flex-shrink-0">
                  <h3 className="text-sm font-bold text-center mb-6 uppercase text-zinc-500 tracking-widest">{round.name}</h3>
                  <div className="space-y-6 flex-grow flex flex-col justify-center">
                    {round.matches.map(renderMatchCard)}
                  </div>
                </div>
              )
            ))}

            {/* FINALE & 3ème PLACE */}
            <div className="flex flex-col w-80 flex-shrink-0 gap-12 justify-center">
              {roundsData.filter(round => round.name === 'Finale').map((round) => (
                round.matches && round.matches.length > 0 && (
                  <div key="finale" className="flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-center uppercase text-amber-500 tracking-widest flex items-center justify-center gap-2">
                      <Crown className="w-4 h-4" /> Grande Finale
                    </h3>
                    <div className="transform scale-110 origin-center">{round.matches.map(renderMatchCard)}</div>
                  </div>
                )
              ))}

              {thirdPlaceMatch && (
                <div className="flex flex-col gap-4 opacity-80 mt-8">
                  <h3 className="text-xs font-bold text-center uppercase text-orange-700 tracking-widest">Petite Finale</h3>
                  <div>{renderMatchCard(thirdPlaceMatch)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="EF-card bg-[#1F1F1F] border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-center text-white font-bold">
              {selectedMatch && (<>{selectedMatch.player1} <span className="text-blue-400 mx-2">vs</span> {selectedMatch.player2}</>)}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-4 py-6">
            <div className="text-center w-1/3">
              <Label className="text-zinc-400 mb-2 block truncate text-sm">{selectedMatch?.player1}</Label>
              <Input type="number" min="0" value={score1} onChange={(e) => setScore1(e.target.value)} className="text-3xl text-center h-16 bg-[#141414] border-white/10 rounded-2xl focus:ring-blue-500/50" disabled={isSavingScore} />
            </div>
            <span className="text-2xl font-bold text-zinc-600">:</span>
            <div className="text-center w-1/3">
              <Label className="text-zinc-400 mb-2 block truncate text-sm">{selectedMatch?.player2}</Label>
              <Input type="number" min="0" value={score2} onChange={(e) => setScore2(e.target.value)} className="text-3xl text-center h-16 bg-[#141414] border-white/10 rounded-2xl focus:ring-blue-500/50" disabled={isSavingScore} />
            </div>
          </div>

          <div className="grid gap-2">
            {isFinalOrThirdPlace && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center mb-2">
                <p className="text-amber-500 text-xs font-bold">Prolongations ou Tirs au but obligatoires en cas d'égalité.</p>
              </div>
            )}
            <DialogFooter className="flex flex-row gap-2 w-full">
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSavingScore} className="flex-1 text-zinc-400 hover:text-white hover:bg-white/5">Annuler</Button>
              <Button onClick={handleScoreSubmit} disabled={isSavingScore || score1 === '' || score2 === '' || (isFinalOrThirdPlace && score1 === score2)} className="flex-1 EF-btn-primary">
                {isSavingScore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CHOIX REMIX (2v2 ONLY) */}
      <Dialog open={showRemixDialog} onOpenChange={setShowRemixDialog}>
        <DialogContent className="EF-card bg-[#1F1F1F] border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center text-white font-bold mb-2">
              Remix des Équipes ?
            </DialogTitle>
            <p className="text-zinc-400 text-center text-sm">
              Voulez-vous mélanger les joueurs pour créer de nouvelles équipes ou conserver les équipes actuelles ?
            </p>
          </DialogHeader>

          <div className="grid gap-3 py-6">
            <Button
              onClick={() => handleGenerateNextRound(true)}
              disabled={isGeneratingNext}
              className="EF-btn-primary py-6 text-lg bg-amber-500 hover:bg-amber-400 text-black"
            >
              <Shuffle className="mr-2 h-5 w-5" />
              Remixer les Équipes
            </Button>
            <Button
              onClick={() => handleGenerateNextRound(false)}
              disabled={isGeneratingNext}
              variant="outline"
              className="EF-btn-secondary py-6 text-lg"
            >
              Garder les Équipes Actuelles
            </Button>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
            <p className="text-blue-400 text-xs font-medium">
              💡 Le remix permet de varier les binômes et d'éviter les redondances.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Step4Bracket;