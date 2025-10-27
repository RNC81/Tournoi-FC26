/* Modification de frontend/src/components/Step3Qualification.jsx */
import { useState } from 'react';
import { Shuffle, ArrowRight, CheckCircle, XCircle, Loader2 } from 'lucide-react'; 
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';
import { completeGroupStage } from '../api'; 

// Ajout de isAdmin en prop
const Step3Qualification = ({ tournamentId, groups, qualifiedPlayers, eliminatedPlayers, onKnockoutDrawComplete, isAdmin }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const { toast } = useToast();

  const handleDrawKnockout = async () => {
    // ... (logique inchangée, protégée par l'affichage du bouton)
    if (!tournamentId) {
        toast({ title: "Erreur", description: "ID du tournoi manquant.", variant: "destructive"});
        return;
    }
    setIsDrawing(true);
    try {
        const updatedTournament = await completeGroupStage(tournamentId);
        onKnockoutDrawComplete(updatedTournament); 
         toast({ title: 'Tirage Phase Finale Effectué', description: 'Le tableau est prêt !'});
    } catch (error) {
        toast({ title: 'Erreur API', description: "Impossible de finaliser les groupes et tirer le tableau.", variant: 'destructive' });
        console.error("Failed to complete group stage / draw knockout:", error);
    } finally {
        setIsDrawing(false);
    }
  };

   const getRoundName = () => {
     // ... (logique inchangée)
     const count = qualifiedPlayers.length;
     if (count <= 4) return "Demi-finales";
     if (count <= 8) return "Quarts de finale";
     if (count <= 16) return "8èmes de finale";
     return "Phase finale"; 
   };


  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Qualification pour les Phases Finales</h2>
      </div>

        {/* ... (Affichage Qualifiés/Éliminés inchangé) ... */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gradient-to-br from-green-900/30 to-gray-800 rounded-2xl p-6 shadow-2xl border border-green-700/50">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <h3 className="text-2xl font-bold text-green-400">Joueurs Qualifiés ({qualifiedPlayers.length})</h3>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {qualifiedPlayers.map((player, index) => (
                <div
                  key={index}
                  className="bg-gray-800/80 rounded-lg p-4 border border-green-700/30 hover:border-green-500/50 transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-bold text-lg">{player.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold text-xl">{player.points} pts</p>
                      <p className="text-gray-400 text-sm">Diff: {player.goalDiff > 0 ? '+' : ''}{player.goalDiff}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-900/30 to-gray-800 rounded-2xl p-6 shadow-2xl border border-red-700/50">
            <div className="flex items-center gap-3 mb-6">
              <XCircle className="w-8 h-8 text-red-400" />
              <h3 className="text-2xl font-bold text-red-400">Joueurs Éliminés ({eliminatedPlayers.length})</h3>
            </div>
             <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {eliminatedPlayers.map((player, index) => (
                <div
                  key={index}
                  className="bg-gray-800/80 rounded-lg p-4 border border-red-700/30 hover:border-red-500/50 transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-bold text-lg">{player.name}</p>
                    </div>
                     <div className="text-right">
                       <p className="text-red-400 font-bold text-xl">{player.points} pts</p>
                       <p className="text-gray-400 text-sm">Diff: {player.goalDiff > 0 ? '+' : ''}{player.goalDiff}</p>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* VERROUILLAGE : Bouton Tirage Phase Finale */}
        {isAdmin && (
            <div className="flex justify-center mt-8">
              <Button
                onClick={handleDrawKnockout}
                disabled={isDrawing}
                className="py-6 px-8 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg shadow-cyan-500/30"
              >
                 {isDrawing ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Shuffle className="mr-2 w-6 h-6" />}
                 {isDrawing ? "Génération..." : `Lancer le tirage des ${getRoundName()}`}
                {!isDrawing && <ArrowRight className="ml-2 w-5 h-5" />}
              </Button>
            </div>
        )}
    </div>
  );
};

export default Step3Qualification;