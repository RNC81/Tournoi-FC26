import { useState, useEffect } from 'react';
import { Shuffle, ArrowRight, Edit } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';

const Step2GroupStage = ({ players, groups, setGroups, onComplete }) => {
  const [generatedGroups, setGeneratedGroups] = useState(groups.length > 0 ? groups : []);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (groups.length > 0) {
      setGeneratedGroups(groups);
    }
  }, [groups]);

  const generateGroups = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const groupSize = 4;
    const numGroups = Math.ceil(shuffled.length / groupSize);
    const newGroups = [];

    for (let i = 0; i < numGroups; i++) {
      const start = i * groupSize;
      const end = start + groupSize;
      const groupPlayers = shuffled.slice(start, end).map((name) => ({
        name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      }));

      const matches = [];
      for (let j = 0; j < groupPlayers.length; j++) {
        for (let k = j + 1; k < groupPlayers.length; k++) {
          matches.push({
            player1: groupPlayers[j].name,
            player2: groupPlayers[k].name,
            score1: null,
            score2: null,
            played: false,
          });
        }
      }

      newGroups.push({
        name: String.fromCharCode(65 + i),
        players: groupPlayers,
        matches,
      });
    }

    setGeneratedGroups(newGroups);
    setGroups(newGroups);
    toast({
      title: 'Tirage effectué',
      description: `${numGroups} poule(s) créée(s) avec succès !`,
    });
  };

  const handleMatchClick = (groupIndex, matchIndex) => {
    setSelectedMatch({ groupIndex, matchIndex });
    const match = generatedGroups[groupIndex].matches[matchIndex];
    setScore1(match.score1 !== null ? match.score1.toString() : '');
    setScore2(match.score2 !== null ? match.score2.toString() : '');
    setIsDialogOpen(true);
  };

  const handleScoreSubmit = () => {
    if (score1 === '' || score2 === '') {
      toast({
        title: 'Erreur',
        description: 'Veuillez entrer les deux scores.',
        variant: 'destructive',
      });
      return;
    }

    const s1 = parseInt(score1);
    const s2 = parseInt(score2);

    if (s1 < 0 || s2 < 0) {
      toast({
        title: 'Erreur',
        description: 'Les scores ne peuvent pas être négatifs.',
        variant: 'destructive',
      });
      return;
    }

    const { groupIndex, matchIndex } = selectedMatch;
    const newGroups = [...generatedGroups];
    const group = newGroups[groupIndex];
    const match = group.matches[matchIndex];

    const wasPlayed = match.played;
    const oldScore1 = match.score1;
    const oldScore2 = match.score2;

    match.score1 = s1;
    match.score2 = s2;
    match.played = true;

    const player1 = group.players.find((p) => p.name === match.player1);
    const player2 = group.players.find((p) => p.name === match.player2);

    if (wasPlayed) {
      player1.played -= 1;
      player2.played -= 1;
      player1.goalsFor -= oldScore1;
      player1.goalsAgainst -= oldScore2;
      player2.goalsFor -= oldScore2;
      player2.goalsAgainst -= oldScore1;

      if (oldScore1 > oldScore2) {
        player1.won -= 1;
        player1.points -= 3;
        player2.lost -= 1;
      } else if (oldScore1 < oldScore2) {
        player2.won -= 1;
        player2.points -= 3;
        player1.lost -= 1;
      } else {
        player1.drawn -= 1;
        player2.drawn -= 1;
        player1.points -= 1;
        player2.points -= 1;
      }
    }

    player1.played += 1;
    player2.played += 1;
    player1.goalsFor += s1;
    player1.goalsAgainst += s2;
    player2.goalsFor += s2;
    player2.goalsAgainst += s1;

    if (s1 > s2) {
      player1.won += 1;
      player1.points += 3;
      player2.lost += 1;
    } else if (s1 < s2) {
      player2.won += 1;
      player2.points += 3;
      player1.lost += 1;
    } else {
      player1.drawn += 1;
      player2.drawn += 1;
      player1.points += 1;
      player2.points += 1;
    }

    player1.goalDiff = player1.goalsFor - player1.goalsAgainst;
    player2.goalDiff = player2.goalsFor - player2.goalsAgainst;

    group.players.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      return b.goalsFor - a.goalsFor;
    });

    setGeneratedGroups(newGroups);
    setGroups(newGroups);
    setIsDialogOpen(false);
    setScore1('');
    setScore2('');
    setSelectedMatch(null);

    toast({
      title: 'Score enregistré',
      description: `${match.player1} ${s1} - ${s2} ${match.player2}`,
    });
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
            onClick={generateGroups}
            className="py-6 px-8 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
          >
            <Shuffle className="mr-2 w-6 h-6" />
            Lancer le tirage au sort des poules
          </Button>
        )}
      </div>

      {generatedGroups.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {generatedGroups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700"
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
                          className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="py-2 px-2 text-white font-medium">{player.name}</td>
                          <td className="text-center py-2 px-1 text-gray-300">{player.played}</td>
                          <td className="text-center py-2 px-1 text-green-400">{player.won}</td>
                          <td className="text-center py-2 px-1 text-yellow-400">{player.drawn}</td>
                          <td className="text-center py-2 px-1 text-red-400">{player.lost}</td>
                          <td className="text-center py-2 px-1 text-gray-300">{player.goalsFor}</td>
                          <td className="text-center py-2 px-1 text-gray-300">{player.goalsAgainst}</td>
                          <td className="text-center py-2 px-1 text-gray-300">{player.goalDiff}</td>
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
                      key={matchIndex}
                      onClick={() => handleMatchClick(groupIndex, matchIndex)}
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
            <div className="flex justify-center">
              <Button
                onClick={onComplete}
                className="py-6 px-8 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
              >
                Terminer la phase de poules et voir les qualifiés
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">
              {selectedMatch && generatedGroups[selectedMatch.groupIndex]?.matches[selectedMatch.matchIndex] && (
                <>
                  {generatedGroups[selectedMatch.groupIndex].matches[selectedMatch.matchIndex].player1}
                  <span className="text-cyan-400 mx-2">vs</span>
                  {generatedGroups[selectedMatch.groupIndex].matches[selectedMatch.matchIndex].player2}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300 mb-2 block">
                  {selectedMatch && generatedGroups[selectedMatch.groupIndex]?.matches[selectedMatch.matchIndex]?.player1}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={score1}
                  onChange={(e) => setScore1(e.target.value)}
                  placeholder="Score"
                  className="text-2xl text-center bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300 mb-2 block">
                  {selectedMatch && generatedGroups[selectedMatch.groupIndex]?.matches[selectedMatch.matchIndex]?.player2}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={score2}
                  onChange={(e) => setScore2(e.target.value)}
                  placeholder="Score"
                  className="text-2xl text-center bg-gray-800 border-gray-600 text-white"
                />
              </div>
            </div>
            <Button
              onClick={handleScoreSubmit}
              className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
            >
              Enregistrer le score
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Step2GroupStage;
