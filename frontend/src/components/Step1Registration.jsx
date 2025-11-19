/* Fichier: frontend/src/components/Step1Registration.jsx */
import { useState } from 'react';
import { Users, ArrowRight, GitBranch, Type, Swords } from 'lucide-react'; 
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { createTournament } from '../api'; 
import { RadioGroup, RadioGroupItem } from './ui/radio-group'; // Import RadioGroup

const Step1Registration = ({ onComplete, isAdmin }) => { 
  const [playerCount, setPlayerCount] = useState('');
  const [numGroups, setNumGroups] = useState(''); 
  const [tournamentName, setTournamentName] = useState('');
  const [format, setFormat] = useState('1v1'); // <-- NOUVEAU ÉTAT
  const [playerNames, setPlayerNames] = useState([]);
  const [showNameInputs, setShowNameInputs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const { toast } = useToast();

  if (!isAdmin) {
      return (
          <div className="text-center text-red-500">
              Accès non autorisé à la configuration.
          </div>
      );
  }

  const handlePlayerCountSubmit = () => {
    const count = parseInt(playerCount);
    if (!count || count < 4) {
      toast({ title: 'Erreur', description: 'Le nombre de joueurs doit être au minimum 4.', variant: 'destructive' });
      return;
    }
    // Validation 2v2
    if (format === '2v2' && count % 2 !== 0) {
        toast({ title: 'Erreur', description: 'Pour le mode 2v2, le nombre de joueurs doit être PAIR.', variant: 'destructive' });
        return;
    }

    if (count > 64) { 
      toast({ title: 'Erreur', description: 'Le nombre de joueurs ne peut pas dépasser 64.', variant: 'destructive' });
      return;
    }
    
    // Suggestion de poules
    // En 2v2, le nombre d'entités est divisé par 2
    const numEntities = format === '2v2' ? count / 2 : count;
    const suggestedGroups = Math.ceil(numEntities / 4);
    setNumGroups(suggestedGroups.toString());
    
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
    
    const groupsInt = numGroups ? parseInt(numGroups) : 0;
    // En 2v2, on vérifie par rapport au nombre d'ÉQUIPES
    const numEntities = format === '2v2' ? filledNames.length / 2 : filledNames.length;

    if (numGroups && (groupsInt <= 1 || groupsInt > numEntities)) {
        toast({ title: 'Erreur', description: 'Nombre de poules invalide.', variant: 'destructive' });
        return;
    }
    const finalNumGroups = groupsInt > 0 ? groupsInt : null;

    setIsSubmitting(true);
    try {
      const finalName = tournamentName.trim() || "Tournoi EA FC";
      // On passe le format
      const tournamentData = await createTournament(filledNames, finalNumGroups, finalName, format);
      
      toast({ title: 'Succès', description: `Tournoi "${finalName}" (${format}) créé !` });
      onComplete(tournamentData); 
    } catch (error) {
      toast({ title: 'Erreur API', description: error.response?.data?.detail || "Impossible de créer le tournoi.", variant: 'destructive' });
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
            
            {/* Choix du Nom */}
            <div>
               <Label htmlFor="tName" className="text-lg text-gray-300 mb-2 block">
                 Nom du Tournoi
               </Label>
               <Input
                  id="tName"
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="ex: Tournoi du Samedi Soir"
                  className="text-lg py-6 bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                  disabled={isSubmitting}
               />
            </div>

            {/* Choix du Format */}
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <Label className="text-lg text-gray-300 mb-4 block flex items-center gap-2">
                    <Swords className="w-5 h-5 text-cyan-400" /> Mode de Jeu
                </Label>
                <RadioGroup value={format} onValueChange={setFormat} className="flex flex-col sm:flex-row gap-4">
                    <div className={`flex items-center space-x-2 p-4 rounded-lg border cursor-pointer transition-all ${format === '1v1' ? 'border-cyan-500 bg-cyan-900/20' : 'border-gray-600 hover:bg-gray-800'}`}>
                        <RadioGroupItem value="1v1" id="r1" />
                        <Label htmlFor="r1" className="cursor-pointer font-medium text-white">1 contre 1 (Classique)</Label>
                    </div>
                    <div className={`flex items-center space-x-2 p-4 rounded-lg border cursor-pointer transition-all ${format === '2v2' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-600 hover:bg-gray-800'}`}>
                        <RadioGroupItem value="2v2" id="r2" />
                        <Label htmlFor="r2" className="cursor-pointer font-medium text-white">2 contre 2 (Mêlée)</Label>
                    </div>
                </RadioGroup>
            </div>

            <div>
              <Label htmlFor="playerCount" className="text-lg text-gray-300 mb-2 block">
                Nombre de joueurs (individuels)
              </Label>
              <Input
                id="playerCount"
                type="number"
                min="4"
                max="64"
                value={playerCount}
                onChange={(e) => setPlayerCount(e.target.value)}
                placeholder="Total des participants"
                className="text-lg py-6 bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                onKeyPress={(e) => e.key === 'Enter' && handlePlayerCountSubmit()}
                disabled={isSubmitting}
              />
              {format === '2v2' && (
                  <p className="text-sm text-purple-400 mt-2">⚠️ Le nombre doit être PAIR pour le 2v2.</p>
              )}
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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex flex-col justify-center">
                   <p className="text-gray-400 text-sm">Mode : <span className="text-cyan-400 font-bold">{format}</span></p>
                   <p className="text-gray-300 text-lg">
                     <span className="font-bold text-white">{playerNames.length}</span> joueurs 
                     {format === '2v2' && <span className="text-purple-400"> ({playerNames.length / 2} équipes)</span>}
                   </p>
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="numGroups" className="text-gray-300 flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        Nombre de Poules (Optionnel)
                    </Label>
                    <Input
                        id="numGroups"
                        type="number"
                        min="2"
                        // Max est le nombre d'équipes en 2v2
                        max={format === '2v2' ? playerNames.length / 2 : playerNames.length}
                        value={numGroups}
                        onChange={(e) => setNumGroups(e.target.value)}
                        placeholder="Auto"
                        className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 focus:border-cyan-400 transition-colors"
                        disabled={isSubmitting}
                    />
                 </div>
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
                onClick={() => { setShowNameInputs(false); setPlayerNames([]); setPlayerCount(''); setNumGroups(''); }}
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
                 {isSubmitting ? "Création..." : "Valider et Créer les Poules"}
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