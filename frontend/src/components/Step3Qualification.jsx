import { useState, useEffect } from 'react';
import { Shuffle, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';

const Step3Qualification = ({ groups, onComplete, qualifiedPlayers, eliminatedPlayers }) => {
  const [qualified, setQualified] = useState(qualifiedPlayers.length > 0 ? qualifiedPlayers : []);
  const [eliminated, setEliminated] = useState(eliminatedPlayers.length > 0 ? eliminatedPlayers : []);
  const [showResults, setShowResults] = useState(qualifiedPlayers.length > 0);
  const { toast } = useToast();

  useEffect(() => {
    if (qualifiedPlayers.length > 0) {
      setQualified(qualifiedPlayers);
      setEliminated(eliminatedPlayers);
      setShowResults(true);
    }
  }, [qualifiedPlayers, eliminatedPlayers]);

  const calculateQualification = () => {
    const allPlayers = [];

    groups.forEach((group) => {
      group.players.forEach((player, index) => {
        allPlayers.push({
          ...player,
          group: group.name,
          groupPosition: index + 1,
        });
      });
    });

    const targetQualified = Math.pow(2, Math.floor(Math.log2(allPlayers.length / 2)));
    const playersPerGroup = Math.ceil(allPlayers.length / groups.length);
    let qualifyPerGroup = Math.floor(targetQualified / groups.length);
    
    if (qualifyPerGroup < 1) qualifyPerGroup = 1;

    const qualifiedList = [];
    const thirdPlaceList = [];

    groups.forEach((group) => {
      for (let i = 0; i < Math.min(qualifyPerGroup, group.players.length); i++) {
        qualifiedList.push({ ...group.players[i], group: group.name });
      }
      
      if (group.players.length > qualifyPerGroup) {
        const thirdPlace = group.players[qualifyPerGroup];
        if (thirdPlace) {
          thirdPlaceList.push({ ...thirdPlace, group: group.name });
        }
      }
    });

    const remainingSlots = targetQualified - qualifiedList.length;
    if (remainingSlots > 0 && thirdPlaceList.length > 0) {
      thirdPlaceList.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        return b.goalsFor - a.goalsFor;
      });

      for (let i = 0; i < Math.min(remainingSlots, thirdPlaceList.length); i++) {
        qualifiedList.push(thirdPlaceList[i]);
      }
    }

    const qualifiedNames = new Set(qualifiedList.map((p) => p.name));
    const eliminatedList = allPlayers.filter((p) => !qualifiedNames.has(p.name));

    setQualified(qualifiedList);
    setEliminated(eliminatedList);
    setShowResults(true);

    toast({
      title: 'Qualification terminée',
      description: `${qualifiedList.length} joueurs qualifiés pour les phases finales !`,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Qualification pour les Phases Finales</h2>
        {!showResults && (
          <Button
            onClick={calculateQualification}
            className="py-6 px-8 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
          >
            Voir les joueurs qualifiés
          </Button>
        )}
      </div>

      {showResults && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gradient-to-br from-green-900/30 to-gray-800 rounded-2xl p-6 shadow-2xl border border-green-700/50">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <h3 className="text-2xl font-bold text-green-400">Joueurs Qualifiés</h3>
            </div>
            <div className="space-y-3">
              {qualified.map((player, index) => (
                <div
                  key={index}
                  className="bg-gray-800/80 rounded-lg p-4 border border-green-700/30 hover:border-green-500/50 transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-bold text-lg">{player.name}</p>
                      <p className="text-gray-400 text-sm">Poule {player.group}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold text-xl">{player.points} pts</p>
                      <p className="text-gray-400 text-sm">Diff: {player.goalDiff}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-900/30 to-gray-800 rounded-2xl p-6 shadow-2xl border border-red-700/50">
            <div className="flex items-center gap-3 mb-6">
              <XCircle className="w-8 h-8 text-red-400" />
              <h3 className="text-2xl font-bold text-red-400">Joueurs Éliminés</h3>
            </div>
            <div className="space-y-3">
              {eliminated.map((player, index) => (
                <div
                  key={index}
                  className="bg-gray-800/80 rounded-lg p-4 border border-red-700/30 hover:border-red-500/50 transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-bold text-lg">{player.name}</p>
                      <p className="text-gray-400 text-sm">Poule {player.group}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 font-bold text-xl">{player.points} pts</p>
                      <p className="text-gray-400 text-sm">Diff: {player.goalDiff}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showResults && (
        <div className="flex justify-center mt-8">
          <Button
            onClick={() => onComplete(qualified, eliminated)}
            className="py-6 px-8 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
          >
            <Shuffle className="mr-2 w-6 h-6" />
            Lancer le tirage au sort des phases finales
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default Step3Qualification;
