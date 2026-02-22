/* Fichier: frontend/src/components/Step1Registration.jsx */
import { useState, useRef } from 'react';
import { Users, ArrowRight, Swords, Shuffle, UserPlus, X, Upload, UserMinus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { createTournament } from '../api';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

// Fisher-Yates shuffle
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Parse CSV — extrait les noms depuis la première colonne (ou colonne "nom"/"name")
const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const nomColIndex = headers.findIndex(h => h === 'nom' || h === 'name' || h === 'joueur' || h === 'player');

  const hasHeader = nomColIndex !== -1 || isNaN(Number(lines[0].split(sep)[0]));
  const startLine = hasHeader ? 1 : 0;
  const colIndex = nomColIndex !== -1 ? nomColIndex : 0;

  return lines.slice(startLine)
    .map(l => l.split(sep)[colIndex]?.trim())
    .filter(n => n && n.length > 0);
};

const Step1Registration = ({ onComplete, isAdmin }) => {
  const [step, setStep] = useState('config'); // 'config' | 'lobby' | 'teams'
  const [tournamentName, setTournamentName] = useState('');
  const [format, setFormat] = useState('1v1');
  const [players, setPlayers] = useState([]); // Liste des noms
  const [newPlayerName, setNewPlayerName] = useState('');
  const [numGroups, setNumGroups] = useState('');
  const [shuffledNames, setShuffledNames] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const csvInputRef = useRef(null);

  if (!isAdmin) {
    return <div className="text-center text-red-500">Accès non autorisé à la configuration.</div>;
  }

  // ─── STEP 1 : Config ───────────────────────────────────────────────────────
  const handleGoToLobby = () => {
    if (!tournamentName.trim()) {
      toast({ title: 'Erreur', description: 'Donnez un nom au tournoi.', variant: 'destructive' });
      return;
    }
    setStep('lobby');
  };

  // ─── STEP 2 : Lobby (liste joueurs) ────────────────────────────────────────
  const handleAddPlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;
    if (players.includes(name)) {
      toast({ title: 'Doublon', description: `"${name}" est déjà dans la liste.`, variant: 'destructive' });
      return;
    }
    if (players.length >= 64) {
      toast({ title: 'Maximum atteint', description: '64 joueurs max.', variant: 'destructive' });
      return;
    }
    setPlayers(prev => [...prev, name]);
    setNewPlayerName('');
  };

  const handleRemovePlayer = (index) => {
    setPlayers(prev => prev.filter((_, i) => i !== index));
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const names = parseCSV(evt.target.result);
      if (names.length === 0) {
        toast({ title: 'CSV vide', description: 'Aucun nom trouvé dans le fichier.', variant: 'destructive' });
        return;
      }
      const newOnes = names.filter(n => !players.includes(n));
      const duplicates = names.length - newOnes.length;
      setPlayers(prev => [...prev, ...newOnes].slice(0, 64));
      toast({
        title: `${newOnes.length} joueur(s) importé(s)`,
        description: duplicates > 0 ? `${duplicates} doublon(s) ignoré(s).` : 'Import réussi.',
      });
    };
    reader.readAsText(file);
    e.target.value = ''; // reset pour permettre un re-import du même fichier
  };

  const handleGoToTeams = () => {
    const count = players.length;
    if (count < 4) {
      toast({ title: 'Pas assez de joueurs', description: 'Minimum 4 joueurs.', variant: 'destructive' });
      return;
    }
    if (format === '2v2' && count % 2 !== 0) {
      toast({ title: 'Nombre impair', description: 'Le 2v2 nécessite un nombre PAIR de joueurs.', variant: 'destructive' });
      return;
    }
    if (format === '2v2') {
      const shuffled = shuffleArray(players);
      setShuffledNames(shuffled);
      setStep('teams');
    } else {
      handleSubmit(players);
    }
  };

  // ─── STEP 3 : Prévisualisation équipes (2v2 uniquement) ────────────────────
  const handleReshuffle = () => {
    setShuffledNames(shuffleArray(players));
  };

  // ─── Soumettre ─────────────────────────────────────────────────────────────
  const handleSubmit = async (finalNames) => {
    const names = finalNames || shuffledNames;
    const numEntities = format === '2v2' ? names.length / 2 : names.length;
    const groupsInt = numGroups ? parseInt(numGroups) : 0;

    if (numGroups && (groupsInt <= 1 || groupsInt > numEntities)) {
      toast({ title: 'Erreur', description: 'Nombre de poules invalide.', variant: 'destructive' });
      return;
    }
    const finalNumGroups = groupsInt > 0 ? groupsInt : null;

    setIsSubmitting(true);
    try {
      const finalName = tournamentName.trim() || 'Tournoi EA FC';
      const data = await createTournament(names, finalNumGroups, finalName, format);
      toast({ title: 'Succès', description: `Tournoi "${finalName}" créé !` });
      onComplete(data);
    } catch (error) {
      let msg = "Impossible de créer le tournoi.";
      if (error.response?.data?.detail) {
        const d = error.response.data.detail;
        msg = Array.isArray(d) ? d.map(e => e.msg).join(', ') : d;
      }
      toast({ title: 'Erreur API', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  const numEntities = format === '2v2' ? Math.floor(players.length / 2) : players.length;
  const suggestedGroups = numEntities >= 4 ? Math.ceil(numEntities / 4) : '';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="EF-card p-8 shadow-none">

        {/* ── STEP CONFIG ── */}
        {step === 'config' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-300">
            <div className="flex items-center gap-4 mb-2 border-b border-white/5 pb-6">
              <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Nouveau Tournoi</h2>
                <p className="text-zinc-500">Configurez le format, vous ajouterez les joueurs ensuite.</p>
              </div>
            </div>

            <div>
              <Label htmlFor="tName" className="EF-label mb-3 text-base">Nom du Tournoi</Label>
              <Input
                id="tName"
                type="text"
                value={tournamentName}
                onChange={e => setTournamentName(e.target.value)}
                placeholder="ex: Tournoi du Samedi Soir"
                className="EF-input text-lg py-6"
                onKeyDown={e => e.key === 'Enter' && handleGoToLobby()}
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

            <Button
              onClick={handleGoToLobby}
              disabled={!tournamentName.trim()}
              className="w-full EF-btn-primary py-6 text-lg"
            >
              Continuer — Ajouter les joueurs <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        )}

        {/* ── STEP LOBBY ── */}
        {step === 'lobby' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{tournamentName}</h2>
                <p className="text-zinc-500 text-sm">Mode <span className="text-white font-semibold">{format}</span> — Ajoutez les participants</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-blue-400">{players.length}</span>
                <p className="text-zinc-600 text-xs">joueur{players.length > 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Saisie + CSV */}
            <div className="flex gap-2">
              <Input
                type="text"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
                placeholder="Nom du joueur..."
                className="EF-input flex-1"
                disabled={isSubmitting}
              />
              <Button
                onClick={handleAddPlayer}
                disabled={!newPlayerName.trim() || isSubmitting}
                className="EF-btn-primary px-4 shrink-0"
              >
                <UserPlus className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                onClick={() => csvInputRef.current?.click()}
                disabled={isSubmitting}
                className="EF-btn-secondary px-4 shrink-0"
                title="Importer depuis un CSV"
              >
                <Upload className="w-5 h-5" />
              </Button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleCSVImport}
              />
            </div>
            <p className="text-zinc-600 text-xs -mt-3">
              CSV accepté : une colonne <code className="text-zinc-400">nom</code> ou simplement une liste de noms, un par ligne.
            </p>

            {/* Liste */}
            <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {players.length === 0 && (
                <p className="text-zinc-600 text-sm text-center py-8">Aucun joueur ajouté pour l'instant.</p>
              )}
              {players.map((name, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-[#141414] border border-white/5 rounded-xl px-4 py-2.5 group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-600 text-xs w-5 text-right">{i + 1}</span>
                    <span className="text-white text-sm font-medium">{name}</span>
                  </div>
                  <button
                    onClick={() => handleRemovePlayer(i)}
                    className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Nombre de poules + validation */}
            {players.length >= 4 && (
              <div className="bg-[#141414]/50 rounded-2xl p-4 border border-white/5 flex gap-6 items-center">
                <div className="flex-1">
                  <Label htmlFor="numGroups" className="EF-label text-sm mb-1">Nombre de Poules</Label>
                  <Input
                    id="numGroups"
                    type="number"
                    min="2"
                    max={numEntities}
                    value={numGroups}
                    onChange={e => setNumGroups(e.target.value)}
                    placeholder={`Auto (${suggestedGroups} suggéré)`}
                    className="EF-input"
                    disabled={isSubmitting}
                  />
                </div>
                {format === '2v2' && players.length % 2 !== 0 && (
                  <p className="text-amber-400 text-xs">⚠️ Nombre impair — retirez 1 joueur.</p>
                )}
              </div>
            )}

            {/* Avertissements */}
            {format === '2v2' && players.length > 0 && players.length % 2 !== 0 && (
              <p className="text-amber-400 text-xs font-medium text-center">⚠️ Le mode 2v2 nécessite un nombre PAIR de joueurs.</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setStep('config'); setPlayers([]); }}
                className="EF-btn-secondary py-5 flex-shrink-0"
                disabled={isSubmitting}
              >
                Retour
              </Button>
              <Button
                onClick={handleGoToTeams}
                disabled={
                  isSubmitting ||
                  players.length < 4 ||
                  (format === '2v2' && players.length % 2 !== 0)
                }
                className="flex-1 EF-btn-primary py-5 text-base"
              >
                {format === '2v2' ? (
                  <><Shuffle className="mr-2 w-5 h-5" /> Tirer les équipes</>
                ) : (
                  <>Valider et Lancer <ArrowRight className="ml-2 w-5 h-5" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP TEAMS (2v2 uniquement) ── */}
        {step === 'teams' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-300">
            <div className="text-center border-b border-white/5 pb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Équipes Générées</h2>
              <p className="text-zinc-500 text-sm">Remélangez jusqu'à ce que tout le monde soit d'accord, puis lancez.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
              {Array.from({ length: shuffledNames.length / 2 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-[#141414] p-4 rounded-2xl border border-white/5 flex items-center justify-between hover:border-blue-500/20 transition-colors"
                >
                  <span className="font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg text-sm">Équipe {i + 1}</span>
                  <div className="text-right">
                    <div className="text-white font-bold text-sm">{shuffledNames[i * 2]}</div>
                    <div className="text-zinc-500 text-xs mt-0.5">& {shuffledNames[i * 2 + 1]}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('lobby')}
                className="EF-btn-secondary py-5 flex-shrink-0"
                disabled={isSubmitting}
              >
                Retour
              </Button>
              <Button
                onClick={handleReshuffle}
                variant="secondary"
                className="flex-1 py-5 bg-[#2A2A2A] hover:bg-[#333] text-white rounded-full transition-all"
                disabled={isSubmitting}
              >
                <Shuffle className="mr-2 w-5 h-5" /> Re-mélanger
              </Button>
              <Button
                onClick={() => handleSubmit(shuffledNames)}
                disabled={isSubmitting}
                className="flex-1 EF-btn-primary py-5 text-base"
              >
                {isSubmitting ? 'Création...' : <>Valider et Lancer <ArrowRight className="ml-2 w-5 h-5" /></>}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Step1Registration;