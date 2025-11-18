/* Fichier: frontend/src/components/TournamentManager.jsx */
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Step1Registration from './Step1Registration';
import Step2GroupStage from './Step2GroupStage';
import Step3Qualification from './Step3Qualification';
import Step4Bracket from './Step4Bracket';
import { Trophy, Loader2, Check, ShieldOff, LogOut, Users, Trash2 } from 'lucide-react'; // Ajout Trash2
import { useToast } from '../hooks/use-toast';
import { getTournament, deleteTournament } from '../api'; // Ajout deleteTournament
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog'; 
import { Button } from './ui/button'; 

const TournamentManager = ({ isAdmin, initialData }) => { 
  const [tournamentId, setTournamentId] = useState(initialData?._id || initialData?.id || null);
  const [currentStep, setCurrentStep] = useState("loading"); 
  const [players, setPlayers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [qualifiedPlayers, setQualifiedPlayers] = useState([]); 
  const [eliminatedPlayers, setEliminatedPlayers] = useState([]); 
  const [knockoutMatches, setKnockoutMatches] = useState([]);
  const [winner, setWinner] = useState(null);
  const [thirdPlace, setThirdPlace] = useState(null); 
  const [isLoading, setIsLoading] = useState(!initialData); 
  
  // NOUVEAU : Pour gérer l'état "en cours de suppression"
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();

  // ... (updateFullTournamentState INCHANGÉ) ...
  const updateFullTournamentState = useCallback((data) => {
    if (!data) {
        console.warn("Attempted to update state with null data.");
        setCurrentStep('no_tournament');
        setIsLoading(false);
        return;
    }
    
    if (data.currentStep !== currentStep || data.winner !== winner) {
       console.log("Updating full state from API data:", data);
    }

    const tId = data._id || data.id;
    setTournamentId(tId); 
    setCurrentStep(data.currentStep || "config");
    setPlayers(data.players || []);
    setGroups(data.groups || []);

    if (data.qualifiedPlayers && data.players) {
        const qualifiedObjects = [];
        const elimObjects = [];
        const allPlayerStats = data.groups.flatMap(g => g.players);

        data.qualifiedPlayers.forEach(name => {
             const stats = allPlayerStats.find(p => p.name === name);
             if(stats) qualifiedObjects.push(stats);
        });
        data.players.forEach(name => {
            if (!data.qualifiedPlayers.includes(name)) {
                 const stats = allPlayerStats.find(p => p.name === name);
                 elimObjects.push(stats || { name: name, points: 0, goalDiff: 0 });
            }
        });
        setQualifiedPlayers(qualifiedObjects);
        setEliminatedPlayers(elimObjects);
    } else {
        setQualifiedPlayers([]); 
        setEliminatedPlayers([]);
    }

    setKnockoutMatches(data.knockoutMatches || []);
    setWinner(data.winner || null);
    setThirdPlace(data.thirdPlace || null); 
    
    setIsLoading(false); 
  }, [currentStep, winner]); 


  // ... (useEffect de chargement et polling INCHANGÉS) ...
  useEffect(() => {
    if (initialData) {
        updateFullTournamentState(initialData);
    } else if (tournamentId) {
        const fetchT = async () => {
            try {
                const data = await getTournament(tournamentId);
                if (data) updateFullTournamentState(data);
                else setCurrentStep("no_tournament");
            } catch (e) {
                console.error(e);
                setCurrentStep("no_tournament");
            }
        };
        fetchT();
    } else {
        setCurrentStep("no_tournament");
        setIsLoading(false);
    }
  }, [initialData, tournamentId, updateFullTournamentState]);

  useEffect(() => {
    if (isAdmin || !tournamentId) {
      return;
    }
    const intervalId = setInterval(async () => {
      try {
        const data = await getTournament(tournamentId);
        if (data) updateFullTournamentState(data);
        else setCurrentStep('no_tournament'); // Si supprimé entre temps
      } catch (error) {
        // 404 sera attrapé ici dans api.js et renverra null, donc géré au-dessus
      }
    }, 15000); 
    return () => clearInterval(intervalId);
  }, [isAdmin, tournamentId, updateFullTournamentState]);


  // ... (Handlers standards INCHANGÉS) ...
  const handleTournamentCreated = (tournamentData) => { updateFullTournamentState(tournamentData); };
  const handleGroupsDrawn = (tournamentData) => { updateFullTournamentState(tournamentData); };
  const handleScoreUpdated = (tournamentData) => { updateFullTournamentState(tournamentData); };
  const handleGroupStageCompleted = (tournamentData) => { updateFullTournamentState(tournamentData); };
  const handleKnockoutUpdated = (tournamentData) => { updateFullTournamentState(tournamentData); };
  const handleTournamentFinished = (tournamentData) => { updateFullTournamentState(tournamentData); };

  // --- MODIFIÉ : SUPPRESSION AU LIEU DE RESET ---
  const handleDeleteTournament = async () => {
        if (!isAdmin || !tournamentId) return; 
        
        setIsDeleting(true);
        try {
            await deleteTournament(tournamentId);
            toast({ title: "Tournoi supprimé.", description: "Redirection vers le tableau de bord..." });
            // Redirection immédiate vers le dashboard pour éviter le 404
            window.location.href = '/dashboard';
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible de supprimer le tournoi.", variant: "destructive" });
            setIsDeleting(false);
        }
  };

  if (isLoading || isDeleting) { // Loader si suppression en cours
      return (
          <div className="flex justify-center items-center min-h-screen">
              <Loader2 className="h-16 w-16 animate-spin text-cyan-400" />
              <p className="ml-4 text-xl text-gray-300">
                  {isDeleting ? "Suppression en cours..." : "Chargement..."}
              </p>
          </div>
      );
  }

  if (currentStep === 'no_tournament') {
       return (
          <div className="flex flex-col justify-center items-center min-h-screen text-center px-4">
              <ShieldOff className="h-24 w-24 text-gray-600 mb-6" />
              <h1 className="text-3xl font-bold text-gray-300 mb-2">Tournoi introuvable</h1>
              <p className="text-xl text-gray-400">Les données ne sont pas disponibles ou ont été supprimées.</p>
              <Button onClick={() => window.location.href='/'} className="mt-6" variant="outline">Retour Accueil</Button>
          </div>
       );
  }

  // Rendu conditionnel (inchangé)
  const renderStep = () => {
    switch (currentStep) {
      case 'config':
        return <Step1Registration onComplete={handleTournamentCreated} isAdmin={isAdmin} />;
      case 'groups':
        return <Step2GroupStage tournamentId={tournamentId} players={players} groups={groups} onGroupsDrawn={handleGroupsDrawn} onScoreUpdate={handleScoreUpdated} onCompleteGroups={handleGroupStageCompleted} isAdmin={isAdmin} />;
      case 'qualified': 
        return <Step3Qualification tournamentId={tournamentId} groups={groups} qualifiedPlayers={qualifiedPlayers} eliminatedPlayers={eliminatedPlayers} onKnockoutDrawComplete={handleKnockoutUpdated} isAdmin={isAdmin} />;
      case 'knockout': 
      case 'finished': 
        return <Step4Bracket tournamentId={tournamentId} knockoutMatches={knockoutMatches} onScoreUpdate={handleKnockoutUpdated} winner={winner} onFinish={handleTournamentFinished} groups={groups} thirdPlace={thirdPlace} isAdmin={isAdmin} />;
      default:
        return isAdmin ? <Step1Registration onComplete={handleTournamentCreated} isAdmin={isAdmin} /> : null;
    }
  };

  return (
    <div className="min-h-screen w-full py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 fade-in flex flex-col sm:flex-row justify-center items-center gap-6">
             <div className="flex items-center justify-center gap-3 flex-grow">
                 <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-cyan-400" />
                 <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                   Tournoi EA FC 26
                 </h1>
                 <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-cyan-400" />
             </div>

             {isAdmin && (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:ml-auto">
                    {/* Bouton SUPPRIMER (au lieu de Réinitialiser) */}
                    {currentStep !== 'config' && (
                         <AlertDialog>
                         <AlertDialogTrigger asChild>
                           <Button
                             variant="destructive" 
                             className="px-6 py-2 rounded-lg transition-all duration-300 font-medium w-full sm:w-auto" 
                           >
                             <Trash2 className="w-4 h-4 mr-2" />
                             Supprimer
                           </Button>
                         </AlertDialogTrigger>
                         <AlertDialogContent className="bg-gray-900 border-gray-700 text-gray-100">
                           <AlertDialogHeader>
                             <AlertDialogTitle className="text-xl text-white">Supprimer le tournoi ?</AlertDialogTitle>
                             <AlertDialogDescription className="text-gray-400">
                               Cette action est <strong>définitive</strong>. Toutes les données de ce tournoi seront perdues.
                               Vous serez redirigé vers votre tableau de bord.
                             </AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                             <AlertDialogCancel className="text-gray-300 border-gray-600 hover:bg-gray-700">Annuler</AlertDialogCancel>
                             <AlertDialogAction onClick={handleDeleteTournament} className="bg-red-600 hover:bg-red-700 text-white">
                               Confirmer la suppression
                             </AlertDialogAction>
                           </AlertDialogFooter>
                         </AlertDialogContent>
                       </AlertDialog>
                    )}
                     <Button
                        variant="outline"
                        onClick={() => window.location.href = '/dashboard'}
                        className="px-6 py-2 rounded-lg transition-all duration-300 font-medium w-full sm:w-auto border-gray-600 text-gray-300 hover:bg-gray-800"
                     >
                        <LogOut className="w-4 h-4 mr-2" /> Dashboard
                     </Button>
                </div>
             )}
             
             {!isAdmin && (
                <div className="flex items-center gap-2 bg-gray-800 text-cyan-400 px-4 py-2 rounded-lg border border-gray-700 sm:ml-auto">
                    <Users className="w-5 h-5" />
                    <span className="font-medium">Mode Spectateur</span>
                </div>
             )}
        </div>
         
        {/* Indicateur d'étape */}
       <div className="flex flex-col sm:flex-row justify-center items-center sm:items-start gap-4 mb-16"> 
           {[
             { num: 1, name: 'Config', stepKey: 'config' },
             { num: 2, name: 'Poules', stepKey: 'groups' },
             { num: 3, name: 'Qualif.', stepKey: 'qualified' }, 
             { num: 4, name: 'Finales', stepKey: 'knockout' } 
           ].map((stepInfo, index, arr) => {
               const stepOrder = ['config', 'groups', 'qualified', 'knockout', 'finished'];
               const currentStepIndex = currentStep === 'no_tournament' ? -1 : stepOrder.indexOf(currentStep);
               const thisStepLogicalIndex = stepOrder.findIndex(s => s === stepInfo.stepKey);
               const isActive = (currentStep === stepInfo.stepKey) || (stepInfo.stepKey === 'knockout' && currentStep === 'finished');
               const isCompleted = currentStepIndex > thisStepLogicalIndex && thisStepLogicalIndex !== -1;
               const pulseClass = isActive ? 'pulse-step' : ''; 
               const nextStepLogicalIndex = index + 1 < arr.length ? stepOrder.findIndex(s => s === arr[index + 1].stepKey) : -1;
               const lineCompleted = currentStepIndex >= nextStepLogicalIndex && nextStepLogicalIndex !== -1;

               return (
                  <div key={stepInfo.num} className="flex flex-col sm:flex-row items-center">
                      <div className="relative flex flex-col items-center">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${pulseClass} ${isActive ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/50 scale-110' : isCompleted ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                              {isCompleted ? <Check className="w-6 h-6" /> : stepInfo.num}
                          </div>
                          <span className="absolute top-full mt-2 text-xs text-gray-400 whitespace-nowrap">{stepInfo.name}</span>
                      </div>
                      {stepInfo.num < 4 && (
                          <div className={`w-1 h-12 sm:w-16 sm:h-1 my-2 sm:my-0 sm:mx-2 sm:mt-[-2.5rem] transition-colors duration-500 ${lineCompleted ? 'bg-gradient-to-r from-green-600 to-green-500' : 'bg-gray-700'}`} />
                      )}
                  </div>
              )
           })}
       </div>

        <div key={currentStep} className="fade-in">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default TournamentManager;