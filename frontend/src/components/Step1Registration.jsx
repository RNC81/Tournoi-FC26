/* Fichier: frontend/src/components/Step1Registration.jsx */
import { useState } from 'react';
import { Users, ArrowRight, GitBranch, Swords, Shuffle, UserPlus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { createTournament } from '../api';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

// Fonction de mélange (Fisher-Yates)
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const Step1Registration = ({ onComplete, isAdmin }) => {
  const [playerCount, setPlayerCount] = useState('');
  const [numGroups, setNumGroups] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [format, setFormat] = useState('1v1');
  const [playerNames, setPlayerNames] = useState([]);
  const [showNameInputs, setShowNameInputs] = useState(false);
  const [showTeamPreview, setShowTeamPreview] = useState(false);
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
    if (format === '2v2' && count % 2 !== 0) {
      toast({ title: 'Erreur', description: 'Pour le mode 2v2, le nombre de joueurs doit être PAIR.', variant: 'destructive' });
      return;
    }
    if (count > 64) {
      toast({ title: 'Erreur', description: 'Le nombre de joueurs ne peut pas dépasser 64.', variant: 'destructive' });
      return;
    }

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

  const handlePreviewTeams = () => {
    const filledNames = playerNames.map(name => name.trim()).filter(name => name !== '');
    if (filledNames.length !== playerNames.length) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les noms.', variant: 'destructive' });
      return;
    }
    const shuffled = shuffleArray(filledNames);
    setPlayerNames(shuffled);
    setShowTeamPreview(true);
  };

  const handleSubmit = async () => {
    const filledNames = playerNames.map(name => name.trim()).filter(name => name !== '');

    if (filledNames.length !== playerNames.length) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les noms de joueurs.', variant: 'destructive' });
      return;
    }

    const numEntities = format === '2v2' ? filledNames.length / 2 : filledNames.length;
    const groupsInt = numGroups ? parseInt(numGroups) : 0;

    if (numGroups && (groupsInt <= 1 || groupsInt > numEntities)) {
      toast({ title: 'Erreur', description: 'Nombre de poules invalide.', variant: 'destructive' });
      return;
    }
    const finalNumGroups = groupsInt > 0 ? groupsInt : null;

    setIsSubmitting(true);
    try {
      const finalName = tournamentName.trim() || "Tournoi EA FC";
      const tournamentData = await createTournament(filledNames, finalNumGroups, finalName, format);

      toast({ title: 'Succès', description: `Tournoi "${finalName}" créé !` });
      onComplete(tournamentData);
    } catch (error) {
      console.error(error);
      let errorMessage = "Impossible de créer le tournoi.";
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          // Pydantic validation error (list of objects)
          errorMessage = detail.map(err => err.msg).join(', ');
        } else {
          // Generic HTTP exception (string)
          errorMessage = detail;
        }
      }
      toast({ title: 'Erreur API', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="EF-card p-10 shadow-none">

        <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
          <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Configuration du Tournoi</h2>
            <p className="text-zinc-500">Définissez les règles et les participants.</p>
          </div>
        </div>

        {!showNameInputs ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-300">
            <div>
              <Label htmlFor="tName" className="EF-label mb-3 text-base">Nom du Tournoi</Label>
              <Input
                id="tName"
                type="text"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                placeholder="ex: Tournoi du Samedi Soir"
                className="EF-input text-lg py-6"
                disabled={isSubmitting}
              />
            </div>

            <div className="bg-[#141414]/50 p-6 rounded-3xl border border-white/5">
              <Label className="EF-label mb-4 text-base flex items-center gap-2">
                <Swords className="w-5 h-5 text-blue-400" /> Mode de Jeu
              </Label>
              <RadioGroup value={format} onValueChange={setFormat} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`flex items-center space-x-4 p-5 rounded-2xl border cursor-pointer transition-all ${format === '1v1' ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/5 hover:bg-white/5'}`}>
                  <RadioGroupItem value="1v1" id="r1" className="text-blue-400 border-zinc-500" />
                  <Label htmlFor="r1" className="cursor-pointer font-bold text-white text-lg">1 vs 1 (Classique)</Label>
                </div>
                <div className={`flex items-center space-x-4 p-5 rounded-2xl border cursor-pointer transition-all ${format === '2v2' ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/5 hover:bg-white/5'}`}>
                  <RadioGroupItem value="2v2" id="r2" className="text-amber-500 border-zinc-500" />
                  <Label htmlFor="r2" className="cursor-pointer font-bold text-white text-lg">2 vs 2 (Mêlée)</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="playerCount" className="EF-label mb-3 text-base">Nombre de joueurs (total)</Label>
              <Input
                id="playerCount"
                type="number"
                min="4"
                max="64"
                value={playerCount}
                onChange={(e) => setPlayerCount(e.target.value)}
                placeholder={format === '2v2' ? "Ex: 8 joueurs (soit 4 équipes)" : "Ex: 8 participants"}
                className="EF-input text-lg py-6"
                onKeyPress={(e) => e.key === 'Enter' && handlePlayerCountSubmit()}
                disabled={isSubmitting}
              />
              {format === '2v2' && (
                <p className="text-xs text-amber-500 mt-2 font-medium ml-2">⚠️ Le nombre doit être PAIR pour le 2v2.</p>
              )}
            </div>

            <Button onClick={handlePlayerCountSubmit} disabled={!playerCount || parseInt(playerCount) < 4 || isSubmitting} className="w-full EF-btn-primary py-6 text-lg">
              Continuer <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        ) : !showTeamPreview ? (
          // --- ÉCRAN DE SAISIE DES NOMS ---
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#141414] rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
                <p className="text-zinc-500 text-sm uppercase tracking-wider mb-1">Résumé Config</p>
                <p className="text-xl text-white">
                  <span className="font-bold text-blue-400">{playerNames.length}</span> Joueurs
                  <span className="text-zinc-600 mx-2">|</span>
                  Mode <span className="font-bold text-white">{format}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numGroups" className="EF-label">Nombre de Poules (Optionnel)</Label>
                <Input
                  id="numGroups"
                  type="number"
                  min="2"
                  max={format === '2v2' ? playerNames.length / 2 : playerNames.length}
                  value={numGroups}
                  onChange={(e) => setNumGroups(e.target.value)}
                  placeholder="Laisser vide pour Auto"
                  className="EF-input"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {playerNames.map((name, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`player-${index}`} className="text-xs text-zinc-500 uppercase tracking-widest pl-1">Joueur {index + 1}</Label>
                  <Input
                    id={`player-${index}`}
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    placeholder={`Nom du joueur ${index + 1}`}
                    className="EF-input border border-white/5 focus:border-blue-500/50"
                    disabled={isSubmitting}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-4">
              <Button onClick={() => { setShowNameInputs(false); setPlayerNames([]); setPlayerCount(''); setNumGroups(''); }} variant="outline" className="flex-1 py-6 text-lg EF-btn-secondary" disabled={isSubmitting}>Retour</Button>

              {format === '2v2' ? (
                <Button onClick={handlePreviewTeams} disabled={isSubmitting || playerNames.some(name => name.trim() === '')} className="flex-1 py-6 text-lg EF-btn-primary bg-amber-500 hover:bg-amber-400 text-black">
                  <Shuffle className="ml-2 w-5 h-5 mr-2" /> Générer les équipes
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting || playerNames.some(name => name.trim() === '')} className="flex-1 py-6 text-lg EF-btn-primary">
                  {isSubmitting ? "Création..." : "Valider et Lancer"} <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          // --- ÉCRAN DE PRÉVISUALISATION DES ÉQUIPES (2v2 ONLY) ---
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-300">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-2">Équipes Générées</h3>
              <p className="text-zinc-500">Un tirage aléatoire a formé les binômes suivants.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              {Array.from({ length: playerNames.length / 2 }).map((_, i) => (
                <div key={i} className="bg-[#141414] p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:border-blue-500/30 transition-colors">
                  <span className="font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg text-sm">Équipe {i + 1}</span>
                  <div className="text-right">
                    <div className="text-white font-bold">{playerNames[i * 2]}</div>
                    <div className="text-zinc-500 text-sm flex items-center justify-end gap-1"><UserPlus className="w-3 h-3" /> {playerNames[i * 2 + 1]}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-4">
              <Button onClick={() => { setShowTeamPreview(false); }} variant="outline" className="flex-1 py-6 text-lg EF-btn-secondary" disabled={isSubmitting}>
                Retour
              </Button>
              <Button onClick={handlePreviewTeams} variant="secondary" className="flex-1 py-6 text-lg bg-[#2A2A2A] hover:bg-[#333] text-white rounded-full transition-all" disabled={isSubmitting}>
                <Shuffle className="mr-2 w-5 h-5" /> Re-mélanger
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-6 text-lg EF-btn-primary">
                {isSubmitting ? "Création..." : "Valider et Lancer"} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Step1Registration;