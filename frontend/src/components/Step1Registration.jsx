import { useState, useEffect } from 'react';
import { Users, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';

const Step1Registration = ({ onComplete, initialPlayers }) => {
  const [playerCount, setPlayerCount] = useState(initialPlayers.length || '');
  const [playerNames, setPlayerNames] = useState(initialPlayers.length > 0 ? initialPlayers : []);
  const [showNameInputs, setShowNameInputs] = useState(initialPlayers.length > 0);
  const { toast } = useToast();

  useEffect(() => {
    if (initialPlayers.length > 0) {
      setPlayerCount(initialPlayers.length);
      setPlayerNames(initialPlayers);
      setShowNameInputs(true);
    }
  }, [initialPlayers]);

  const handlePlayerCountSubmit = () => {
    const count = parseInt(playerCount);
    if (!count || count < 4) {
      toast({
        title: 'Erreur',
        description: 'Le nombre de joueurs doit être au minimum 4.',
        variant: 'destructive',
      });
      return;
    }
    if (count > 64) {
      toast({
        title: 'Erreur',
        description: 'Le nombre de joueurs ne peut pas dépasser 64.',
        variant: 'destructive',
      });
      return;
    }

    const names = Array(count).fill('');
    setPlayerNames(names);
    setShowNameInputs(true);
  };

  const handleNameChange = (index, value) => {
    const newNames = [...playerNames];
    newNames[index] = value;
    setPlayerNames(newNames);
  };

  const handleSubmit = () => {
    const filledNames = playerNames.filter((name) => name.trim() !== '');
    
    if (filledNames.length !== playerNames.length) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les noms de joueurs.',
        variant: 'destructive',
      });
      return;
    }

    const uniqueNames = new Set(filledNames);
    if (uniqueNames.size !== filledNames.length) {
      toast({
        title: 'Erreur',
        description: 'Tous les noms de joueurs doivent être uniques.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Succès',
      description: `${filledNames.length} joueurs inscrits avec succès !`,
    });

    onComplete(filledNames);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700">
        <div className="flex items-center gap-3 mb-8">
          <Users className="w-8 h-8 text-cyan-400" />
          <h2 className="text-3xl font-bold text-white">Configuration du Tournoi</h2>
        </div>

        {!showNameInputs ? (
          <div className="space-y-6">
            <div>
              <Label htmlFor="playerCount" className="text-lg text-gray-300 mb-2 block">
                Combien de joueurs participent au tournoi ?
              </Label>
              <Input
                id="playerCount"
                type="number"
                min="4"
                max="64"
                value={playerCount}
                onChange={(e) => setPlayerCount(e.target.value)}
                placeholder="Entrez le nombre de joueurs (min: 4, max: 64)"
                className="text-lg py-6 bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                onKeyPress={(e) => e.key === 'Enter' && handlePlayerCountSubmit()}
              />
            </div>
            <Button
              onClick={handlePlayerCountSubmit}
              className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
            >
              Continuer
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-300">
                <span className="font-bold text-cyan-400">{playerNames.length}</span> joueurs à inscrire
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
              {playerNames.map((name, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`player-${index}`} className="text-gray-300">
                    Joueur {index + 1}
                  </Label>
                  <Input
                    id={`player-${index}`}
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    placeholder={`Nom du joueur ${index + 1}`}
                    className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 focus:border-cyan-400 transition-colors"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => {
                  setShowNameInputs(false);
                  setPlayerNames([]);
                  setPlayerCount('');
                }}
                variant="outline"
                className="flex-1 py-6 text-lg border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                Retour
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 py-6 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
              >
                Valider les inscriptions
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Step1Registration;
