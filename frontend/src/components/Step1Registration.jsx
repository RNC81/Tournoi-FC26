import { useState } from 'react';
import { Users, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { createTournament } from '../api'; // Import API call

const Step1Registration = ({ onComplete }) => {
  const [playerCount, setPlayerCount] = useState('');
  const [playerNames, setPlayerNames] = useState([]);
  const [showNameInputs, setShowNameInputs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Pour l'indicateur de chargement
  const { toast } = useToast();

  const handlePlayerCountSubmit = () => {
    const count = parseInt(playerCount);
    if (!count || count < 4) {
      toast({ title: 'Erreur', description: 'Le nombre de joueurs doit être au minimum 4.', variant: 'destructive' });
      return;
    }
    if (count > 64) { // Limite arbitraire, peut être ajustée
      toast({ title: 'Erreur', description: 'Le nombre de joueurs ne peut pas dépasser 64.', variant: 'destructive' });
      return;
    }
    setPlayerNames(Array(count).fill(''));
    setShowNameInputs(true);
  };

  const handleNameChange = (index, value) => {
    const newNames = [...playerNames];
    newNames[index] = value;
    setPlayerNames(newNames);
  };

  const handleSubmit = async () => {
    const filledNames = playerNames.map(name => name.trim()).filter(name => name !== '');

    if (filledNames.length !== playerNames.length) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les noms de joueurs.', variant: 'destructive' });
      return;
    }

    const uniqueNames = new Set(filledNames);
    if (uniqueNames.size !== filledNames.length) {
      toast({ title: 'Erreur', description: 'Tous les noms de joueurs doivent être uniques.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Appel API pour créer le tournoi
      const tournamentData = await createTournament(filledNames);
      toast({ title: 'Succès', description: `Tournoi créé avec ${filledNames.length} joueurs ! Préparation du tirage...` });

      setTimeout(() => {
        onComplete(tournamentData); // Passe les données complètes du tournoi créé
    }, 1500);
    } catch (error) {
      toast({ title: 'Erreur API', description: "Impossible de créer le tournoi. Veuillez réessayer.", variant: 'destructive' });
      console.error("Failed to create tournament:", error);
    } finally {
      setIsSubmitting(false);
    }
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
                disabled={isSubmitting}
              />
            </div>
            <Button
              onClick={handlePlayerCountSubmit}
              disabled={!playerCount || parseInt(playerCount) < 4 || isSubmitting}
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
                     disabled={isSubmitting}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => { setShowNameInputs(false); setPlayerNames([]); setPlayerCount(''); }}
                variant="outline"
                className="flex-1 py-6 text-lg border-gray-600 text-gray-300 hover:bg-gray-800"
                 disabled={isSubmitting}
              >
                Retour
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || playerNames.some(name => name.trim() === '')}
                className="flex-1 py-6 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
              >
                 {isSubmitting ? "Création..." : "Valider les inscriptions"}
                 {!isSubmitting && <ArrowRight className="ml-2 w-5 h-5" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Step1Registration;
