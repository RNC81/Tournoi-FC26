import { useState, useEffect } from 'react';
import { Trophy, Edit, Crown } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';

const Step4Bracket = ({ qualifiedPlayers, knockoutMatches, setKnockoutMatches, winner, setWinner }) => {
  const [matches, setMatches] = useState(knockoutMatches.length > 0 ? knockoutMatches : []);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [champion, setChampion] = useState(winner);
  const { toast } = useToast();

  useEffect(() => {
    if (knockoutMatches.length > 0) {
      setMatches(knockoutMatches);
    }
  }, [knockoutMatches]);

  useEffect(() => {
    if (winner) {
      setChampion(winner);
    }
  }, [winner]);

  const generateBracket = () => {
    const shuffled = [...qualifiedPlayers].sort(() => Math.random() - 0.5);
    const totalRounds = Math.ceil(Math.log2(shuffled.length));
    const bracketSize = Math.pow(2, totalRounds);
    
    const firstRoundPlayers = [...shuffled];
    while (firstRoundPlayers.length < bracketSize) {
      firstRoundPlayers.push(null);
    }

    const allMatches = [];
    let matchId = 0;

    for (let round = 0; round < totalRounds; round++) {
      const matchesInRound = Math.pow(2, totalRounds - round - 1);
      for (let i = 0; i < matchesInRound; i++) {
        allMatches.push({
          id: matchId++,
          round: round,
          matchIndex: i,
          player1: round === 0 ? firstRoundPlayers[i * 2]?.name || null : null,
          player2: round === 0 ? firstRoundPlayers[i * 2 + 1]?.name || null : null,
          score1: null,
          score2: null,
          winner: null,
          played: false,
        });
      }
    }

    allMatches.forEach((match) => {
      if (match.player1 && !match.player2) {
        match.winner = match.player1;
        match.played = true;
        match.score1 = 0;
        match.score2 = 0;
      } else if (match.player2 && !match.player1) {
        match.winner = match.player2;
        match.played = true;
        match.score1 = 0;
        match.score2 = 0;
      }
    });

    for (let round = 0; round < totalRounds - 1; round++) {
      const currentRoundMatches = allMatches.filter((m) => m.round === round);
      currentRoundMatches.forEach((match, index) => {
        if (match.winner) {
          const nextMatch = allMatches.find(
            (m) => m.round === round + 1 && m.matchIndex === Math.floor(index / 2)
          );
          if (nextMatch) {
            if (index % 2 === 0) {
              nextMatch.player1 = match.winner;
            } else {
              nextMatch.player2 = match.winner;
            }
          }
        }
      });
    }

    setMatches(allMatches);
    setKnockoutMatches(allMatches);

    toast({
      title: 'Tableau généré',
      description: 'Le tableau des phases finales a été créé !',
    });
  };

  const handleMatchClick = (matchId) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match.player1 || !match.player2) {
      toast({
        title: 'Match non disponible',
        description: 'Les joueurs ne sont pas encore déterminés.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedMatch(match);
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

    if (s1 === s2) {
      toast({
        title: 'Erreur',
        description: 'En phase finale, il ne peut pas y avoir de match nul. Un joueur doit gagner.',
        variant: 'destructive',
      });
      return;
    }

    const newMatches = [...matches];
    const matchIndex = newMatches.findIndex((m) => m.id === selectedMatch.id);
    const match = newMatches[matchIndex];

    match.score1 = s1;
    match.score2 = s2;
    match.played = true;
    match.winner = s1 > s2 ? match.player1 : match.player2;

    const nextRoundMatch = newMatches.find(
      (m) => m.round === match.round + 1 && m.matchIndex === Math.floor(match.matchIndex / 2)
    );

    if (nextRoundMatch) {
      if (match.matchIndex % 2 === 0) {
        nextRoundMatch.player1 = match.winner;
      } else {
        nextRoundMatch.player2 = match.winner;
      }
    } else {
      setChampion(match.winner);
      setWinner(match.winner);
    }

    setMatches(newMatches);
    setKnockoutMatches(newMatches);
    setIsDialogOpen(false);
    setScore1('');
    setScore2('');
    setSelectedMatch(null);

    toast({
      title: 'Score enregistré',
      description: `${match.player1} ${s1} - ${s2} ${match.player2}`,
    });
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

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Tableau Final - Élimination Directe</h2>
        {matches.length === 0 && (
          <Button
            onClick={generateBracket}
            className="py-6 px-8 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
          >
            <Trophy className="mr-2 w-6 h-6" />
            Générer le tableau final
          </Button>
        )}
      </div>

      {champion && (
        <div className="bg-gradient-to-br from-yellow-900/40 to-gray-800 rounded-2xl p-8 shadow-2xl border-4 border-yellow-500/50 text-center">
          <Crown className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-4xl font-bold text-yellow-400 mb-2">Champion du Tournoi !</h2>
          <p className="text-5xl font-black text-white">{champion}</p>
        </div>
      )}

      {matches.length > 0 && (
        <div className="space-y-12">
          {Array.from({ length: totalRounds }).map((_, roundIndex) => {
            const roundMatches = matches.filter((m) => m.round === roundIndex);
            return (
              <div key={roundIndex} className="space-y-4">
                <h3 className="text-2xl font-bold text-cyan-400 text-center">
                  {getRoundName(roundIndex, totalRounds)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {roundMatches.map((match) => (
                    <div
                      key={match.id}
                      className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 shadow-xl border border-gray-700 hover:border-cyan-500 transition-all duration-300"
                    >
                      <div className="space-y-3">
                        <div
                          className={`flex justify-between items-center p-3 rounded-lg ${
                            match.winner === match.player1
                              ? 'bg-green-900/30 border border-green-600'
                              : 'bg-gray-800'
                          }`}
                        >
                          <span className="text-white font-medium">
                            {match.player1 || 'En attente'}
                          </span>
                          {match.played && (
                            <span className="text-cyan-400 font-bold text-lg">{match.score1}</span>
                          )}
                        </div>
                        <div
                          className={`flex justify-between items-center p-3 rounded-lg ${
                            match.winner === match.player2
                              ? 'bg-green-900/30 border border-green-600'
                              : 'bg-gray-800'
                          }`}
                        >
                          <span className="text-white font-medium">
                            {match.player2 || 'En attente'}
                          </span>
                          {match.played && (
                            <span className="text-cyan-400 font-bold text-lg">{match.score2}</span>
                          )}
                        </div>
                        {match.player1 && match.player2 && (
                          <Button
                            onClick={() => handleMatchClick(match.id)}
                            variant="outline"
                            size="sm"
                            className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-cyan-500"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            {match.played ? 'Modifier' : 'Entrer le score'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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

export default Step4Bracket;
