/* Fichier: frontend/src/components/Step2GroupStage.jsx */
import { useState, useEffect, useMemo } from 'react';
import { ArrowRight, Loader2, Shuffle, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { updateScore, completeGroupStage } from '../api';

const getTargetQualifiedCount = (totalPlayers) => {
  if (totalPlayers <= 8) return 4;
  if (totalPlayers <= 16) return 8;
  return totalPlayers >= 24 ? 16 : 8;
};

const Step2GroupStage = ({ tournamentId, players, groups, onGroupsDrawn, onScoreUpdate, onCompleteGroups, isAdmin, format }) => {
  const [generatedGroups, setGeneratedGroups] = useState(groups || []);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Dialog de confirmation finale
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [chosenQualified, setChosenQualified] = useState(null); // null = auto
  const [doRemix, setDoRemix] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    setGeneratedGroups(groups || []);
  }, [groups]);

  const handleMatchClick = (groupIndex, match) => {
    if (!isAdmin) {
      toast({ title: 'Mode Spectateur', description: 'Vous ne pouvez pas modifier les scores.', variant: 'default' });
      return;
    }
    setSelectedMatch({ groupIndex, matchId: match.id });
    setScore1(match.score1 !== null ? match.score1.toString() : '');
    setScore2(match.score2 !== null ? match.score2.toString() : '');
    setIsScoreDialogOpen(true);
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
      setIsScoreDialogOpen(false);
      setScore1('');
      setScore2('');
      setSelectedMatch(null);
      const group = updatedTournament.groups[selectedMatch.groupIndex];
      const match = group.matches.find(m => m.id === selectedMatch.matchId);
      toast({ title: 'Score enregistré', description: `${match.player1} ${s1} - ${s2} ${match.player2}` });
    } catch (error) {
      toast({ title: 'Erreur API', description: "Impossible d'enregistrer le score.", variant: 'destructive' });
    } finally {
      setIsSavingScore(false);
    }
  };

  const handleOpenConfirmDialog = () => {
    setChosenQualified(null);
    setDoRemix(false);
    setIsConfirmDialogOpen(true);
  };

  const handleCompleteStageClick = async () => {
    setIsCompleting(true);
    setIsConfirmDialogOpen(false);
    try {
      await completeGroupStage(tournamentId, chosenQualified, doRemix);
      toast({ title: 'Phase de poules terminée !', description: 'Chargement de la phase finale...' });
      setTimeout(() => { window.location.reload(); }, 500);
    } catch (error) {
      console.error(error);
      let errorMsg = "Impossible de passer à la suite.";
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        errorMsg = Array.isArray(detail) ? detail.map(e => e.msg).join(', ') : detail;
      }
      toast({ title: 'Erreur', description: errorMsg, variant: 'destructive' });
      setIsCompleting(false);
    }
  };

  const allMatchesPlayed = useMemo(() =>
    generatedGroups.every((group) =>
      group.matches.every((match) => match.played)
    ), [generatedGroups]);

  const entityCount = format === '2v2' ? players.length / 2 : players.length;
  const autoQualifiedCount = getTargetQualifiedCount(entityCount);
  const displayQualifiedCount = chosenQualified || autoQualifiedCount;

  const allPlayersRanked = useMemo(() => {
    if (generatedGroups.length === 0) return [];
    const allPlayers = generatedGroups.flatMap(group =>
      group.players.map(player => ({ ...player, groupName: group.name }))
    );
    allPlayers.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.goalDiff !== b.goalDiff) return b.goalDiff - a.goalDiff;
      if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
      return 0;
    });
    return allPlayers;
  }, [generatedGroups]);

  // Options de qualification possibles basées sur le nombre d'entités
  const qualifiedOptions = useMemo(() => {
    const opts = [];
    for (const n of [4, 8, 16, 32]) {
      if (n <= entityCount && n >= 2) opts.push(n);
    }
    return opts;
  }, [entityCount]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Phase de Poules</h2>
        {generatedGroups.length === 0 && <p className="text-zinc-500">Aucun groupe généré.</p>}
      </div>

      {generatedGroups.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {generatedGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="EF-card p-6 border border-white/5">
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                  <h3 className="text-xl font-bold text-white">Poule <span className="text-blue-400">{group.name}</span></h3>
                </div>

                <div className="overflow-x-auto mb-8">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-xs uppercase text-zinc-500 font-semibold tracking-wider">
                        <th className="text-left py-3 px-2">Joueur</th>
                        <th className="text-center py-3 px-1">J</th>
                        <th className="hidden sm:table-cell text-center py-3 px-1">V/N/D</th>
                        <th className="text-center py-3 px-1">Diff</th>
                        <th className="text-center py-3 px-1 text-white">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {group.players.map((player, playerIndex) => (
                        <tr key={playerIndex} className={`transition-colors hover:bg-white/5 ${player.groupPosition <= 2 ? 'bg-blue-500/5' : ''}`}>
                          <td className="py-3 px-2 font-medium text-white">{player.name}</td>
                          <td className="text-center py-3 px-1 text-zinc-400">{player.played}</td>
                          <td className="hidden sm:table-cell text-center py-3 px-1 text-zinc-500 text-xs">
                            <span className="text-blue-400">{player.won}</span>/<span className="text-zinc-400">{player.drawn}</span>/<span className="text-red-400">{player.lost}</span>
                          </td>
                          <td className="text-center py-3 px-1 text-zinc-400">{player.goalDiff > 0 ? '+' : ''}{player.goalDiff}</td>
                          <td className="text-center py-3 px-1 text-blue-400 font-bold text-base">{player.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-semibold text-zinc-500 mb-2 pl-1">Rencontres</h4>
                  {group.matches.map((match, matchIndex) => (
                    <button
                      key={match.id || matchIndex}
                      onClick={() => handleMatchClick(groupIndex, match)}
                      className={`w-full rounded-2xl p-4 transition-all duration-300 border border-transparent flex justify-between items-center group bg-[#141414] ${isAdmin
                        ? 'hover:border-blue-500/30 hover:bg-[#1A1A1A] cursor-pointer active:scale-[0.98]'
                        : 'cursor-default'
                        }`}
                      disabled={!isAdmin}
                    >
                      <span className={`text-sm font-medium ${match.winner === match.player1 ? 'text-blue-400' : 'text-zinc-300'}`}>{match.player1}</span>
                      <div className="flex flex-col items-center px-4">
                        {match.played ? (
                          <span className="text-white font-bold text-lg bg-[#2A2A2A] px-3 py-1 rounded-lg border border-white/5">
                            {match.score1} - {match.score2}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs uppercase font-bold tracking-widest bg-[#1F1F1F] px-2 py-1 rounded">VS</span>
                        )}
                      </div>
                      <span className={`text-sm font-medium ${match.winner === match.player2 ? 'text-blue-400' : 'text-zinc-300'}`}>{match.player2}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* CLASSEMENT GÉNÉRAL */}
          {allMatchesPlayed && (
            <div className="mt-16 EF-card p-8 border-blue-500/20 bg-gradient-to-b from-[#1F1F1F] to-[#141414]">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Classement Général</h3>
                <p className="text-zinc-400">Les <span className="text-blue-400 font-bold">{displayQualifiedCount}</span> premiers sont qualifiés pour la phase finale.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase text-zinc-500 font-bold tracking-wider">
                      <th className="text-center py-4 px-2">#</th>
                      <th className="text-left py-4 px-2">Participant</th>
                      <th className="text-center py-4 px-2">Poule</th>
                      <th className="text-center py-4 px-2">Pts</th>
                      <th className="text-center py-4 px-2">Diff</th>
                      <th className="text-center py-4 px-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {allPlayersRanked.map((player, index) => {
                      const rank = index + 1;
                      const isQualified = rank <= displayQualifiedCount;
                      return (
                        <tr key={index} className={`transition-colors ${isQualified ? 'bg-blue-900/10' : ''}`}>
                          <td className={`bg-[#141414] py-3 px-4 w-12 text-center font-bold ${isQualified ? 'text-blue-400' : 'text-zinc-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isQualified ? 'bg-blue-500/10' : ''}`}>{rank}</div>
                          </td>
                          <td className={`py-3 px-2 font-medium ${isQualified ? 'text-white' : 'text-zinc-500'}`}>{player.name}</td>
                          <td className="text-center py-3 px-2 text-zinc-500">{player.groupName}</td>
                          <td className={`text-center py-3 px-2 font-bold ${isQualified ? 'text-white' : 'text-zinc-500'}`}>{player.points}</td>
                          <td className="text-center py-3 px-2 text-zinc-500">{player.goalDiff > 0 ? '+' : ''}{player.goalDiff}</td>
                          <td className="text-center py-3 px-2">
                            {isQualified
                              ? <span className="text-blue-400 text-xs font-bold uppercase bg-blue-500/10 px-2 py-1 rounded">Qualifié</span>
                              : <span className="text-zinc-600 text-xs uppercase">Éliminé</span>
                            }
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
            <div className="flex justify-center mt-12 mb-8">
              <Button
                onClick={handleOpenConfirmDialog}
                disabled={isCompleting}
                className="EF-btn-primary py-6 px-10 text-lg shadow-[0_0_30px_rgba(59,130,246,0.2)]"
              >
                {isCompleting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <ArrowRight className="ml-2 w-5 h-5" />}
                {isCompleting ? "Validation..." : "Valider et passer à la Phase Finale"}
              </Button>
            </div>
          )}
        </>
      )}

      {/* DIALOG SCORE */}
      <Dialog open={isScoreDialogOpen} onOpenChange={setIsScoreDialogOpen}>
        <DialogContent className="EF-card bg-[#1F1F1F] border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-center text-white font-bold">Mise à jour du score</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-4 py-6">
            <div className="text-center w-1/3">
              <Label className="text-zinc-400 mb-2 block truncate text-sm">{selectedMatch && generatedGroups[selectedMatch.groupIndex]?.matches.find(m => m.id === selectedMatch.matchId)?.player1}</Label>
              <Input type="number" min="0" value={score1} onChange={(e) => setScore1(e.target.value)} className="text-3xl text-center h-16 bg-[#141414] border-white/10 rounded-2xl focus:ring-blue-500/50" disabled={isSavingScore} />
            </div>
            <span className="text-2xl font-bold text-zinc-600">:</span>
            <div className="text-center w-1/3">
              <Label className="text-zinc-400 mb-2 block truncate text-sm">{selectedMatch && generatedGroups[selectedMatch.groupIndex]?.matches.find(m => m.id === selectedMatch.matchId)?.player2}</Label>
              <Input type="number" min="0" value={score2} onChange={(e) => setScore2(e.target.value)} className="text-3xl text-center h-16 bg-[#141414] border-white/10 rounded-2xl focus:ring-blue-500/50" disabled={isSavingScore} />
            </div>
          </div>
          <DialogFooter className="flex flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsScoreDialogOpen(false)} disabled={isSavingScore} className="flex-1 text-zinc-400 hover:text-white hover:bg-white/5">Annuler</Button>
            <Button onClick={handleScoreSubmit} disabled={isSavingScore || score1 === '' || score2 === ''} className="flex-1 EF-btn-primary">
              {isSavingScore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG CONFIRMATION FINALE — CHOIX FORMAT + REMIX */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="EF-card bg-[#1F1F1F] border-white/10 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-center text-white font-bold">Lancer la Phase Finale</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Choix nombre de qualifiés */}
            <div>
              <Label className="EF-label mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Nombre d'équipes qualifiées
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setChosenQualified(null)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${chosenQualified === null ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/30'}`}
                >
                  Auto<br /><span className="text-xs text-zinc-500">({autoQualifiedCount})</span>
                </button>
                {qualifiedOptions.filter(n => n !== autoQualifiedCount).slice(0, 3).map(n => (
                  <button
                    key={n}
                    onClick={() => setChosenQualified(n)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${chosenQualified === n ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/30'}`}
                  >
                    {n}<br /><span className="text-xs text-zinc-500">{n <= 8 ? 'Quarts' : 'Huitièmes'}</span>
                  </button>
                ))}
              </div>
              <p className="text-zinc-600 text-xs mt-2 ml-1">
                {(chosenQualified || autoQualifiedCount) <= 8 ? '→ Quarts de finale' : '→ Huitièmes de finale'}
              </p>
            </div>

            {/* Option remix (2v2 uniquement) */}
            {format === '2v2' && (
              <div>
                <Label className="EF-label mb-3 flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-amber-400" /> Équipes pour la phase finale
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDoRemix(false)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${!doRemix ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/10 text-zinc-400 hover:border-white/30'}`}
                  >
                    🔒 Garder les équipes<br />
                    <span className="text-xs text-zinc-500">Mêmes binômes</span>
                  </button>
                  <button
                    onClick={() => setDoRemix(true)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${doRemix ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-white/10 text-zinc-400 hover:border-white/30'}`}
                  >
                    🔀 Remixer<br />
                    <span className="text-xs text-zinc-500">Nouveaux binômes</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsConfirmDialogOpen(false)} className="flex-1 text-zinc-400 hover:text-white hover:bg-white/5">Annuler</Button>
            <Button onClick={handleCompleteStageClick} disabled={isCompleting} className="flex-1 EF-btn-primary">
              {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 w-4 h-4" />}
              Lancer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Step2GroupStage;