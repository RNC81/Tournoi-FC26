/* Modification de frontend/src/components/Step3Qualification.jsx */
import { useState } from 'react';
import { Shuffle, ArrowRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';
import { completeGroupStage } from '../api';

const Step3Qualification = ({ tournamentId, groups, qualifiedPlayers, eliminatedPlayers, onKnockoutDrawComplete, isAdmin }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const { toast } = useToast();

  const handleDrawKnockout = async () => {
    if (!tournamentId) {
      toast({ title: "Erreur", description: "ID du tournoi manquant.", variant: "destructive" });
      return;
    }
    setIsDrawing(true);
    try {
      const updatedTournament = await completeGroupStage(tournamentId);
      onKnockoutDrawComplete(updatedTournament);
      toast({ title: 'Tirage Terminé', description: 'Le tableau final a été généré.' });
    } catch (error) {
      toast({ title: 'Erreur API', description: "Impossible de générer le tableau.", variant: 'destructive' });
    } finally {
      setIsDrawing(false);
    }
  };

  const getRoundName = () => {
    const count = qualifiedPlayers.length;
    if (count <= 4) return "Demi-finales";
    if (count <= 8) return "Quarts de finale";
    if (count <= 16) return "8èmes de finale";
    return "Phase finale";
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Qualification Phase Finale</h2>
        <p className="text-zinc-500">Voici les résultats officiels des phases de poules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* CARTE QUALIFIÉS */}
        <div className="EF-card p-0 border-blue-500/20 bg-[#1F1F1F] overflow-hidden">
          <div className="bg-blue-500/10 p-6 border-b border-blue-500/10 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-blue-400" />
            <h3 className="text-xl font-bold text-blue-400">Qualifiés ({qualifiedPlayers.length})</h3>
          </div>
          <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
            {qualifiedPlayers.length === 0 ? (
              <p className="text-zinc-500 text-center py-10">Aucun qualifié pour le moment.</p>
            ) : (
              qualifiedPlayers.map((player, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-[#141414] border border-white/5">
                  <span className="font-bold text-white text-lg">{player.name}</span>
                  <div className="text-right">
                    <span className="block font-bold text-blue-400">{player.points} pts</span>
                    <span className="text-xs text-zinc-500">+ {player.goalDiff} diff</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CARTE ÉLIMINÉS */}
        <div className="EF-card p-0 border-red-500/10 bg-[#1F1F1F] overflow-hidden opacity-80">
          <div className="bg-red-500/5 p-6 border-b border-red-500/10 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-500" />
            <h3 className="text-xl font-bold text-red-500">Éliminés ({eliminatedPlayers.length})</h3>
          </div>
          <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
            {eliminatedPlayers.length === 0 ? (
              <p className="text-zinc-500 text-center py-10">Aucun joueur éliminé. Tout le monde passe !</p>
            ) : (
              eliminatedPlayers.map((player, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-[#141414]/50 border border-white/5">
                  <span className="font-medium text-zinc-400">{player.name}</span>
                  <div className="text-right">
                    <span className="block font-medium text-zinc-500">{player.points} pts</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Action Admin */}
      {isAdmin && (
        <div className="flex justify-center pt-8">
          <Button onClick={handleDrawKnockout} disabled={isDrawing} className="EF-btn-primary py-8 px-12 text-xl rounded-full shadow-[0_0_40px_rgba(59,130,246,0.15)] hover:shadow-[0_0_60px_rgba(59,130,246,0.3)] transform hover:scale-105 transition-all">
            {isDrawing ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Shuffle className="mr-3 w-6 h-6" />}
            {isDrawing ? "Génération du tableau..." : `Lancer le tirage des ${getRoundName()}`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Step3Qualification;