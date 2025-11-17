import { useState, useEffect, useCallback } from 'react'; // 1. AJOUT DE useCallback
import Step1Registration from './Step1Registration';
import Step2GroupStage from './Step2GroupStage';
import Step3Qualification from './Step3Qualification';
import Step4Bracket from './Step4Bracket';
import { Trophy, Loader2, Check, ShieldOff, LogOut, Users } from 'lucide-react'; 
import { useToast } from '../hooks/use-toast';
import { getTournament } from '../api'; 
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

const TOURNAMENT_ID_LS_KEY = 'currentTournamentId';
const ADMIN_STATUS_LS_KEY = 'isAdmin'; 

const TournamentManager = ({ isAdmin }) => { 
  const [currentStep, setCurrentStep] = useState("loading"); 
  const [tournamentId, setTournamentId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [qualifiedPlayers, setQualifiedPlayers] = useState([]); 
  const [eliminatedPlayers, setEliminatedPlayers] = useState([]); 
  const [knockoutMatches, setKnockoutMatches] = useState([]);
  const [winner, setWinner] = useState(null);
  const [thirdPlace, setThirdPlace] = useState(null); 
  const [isLoading, setIsLoading] = useState(true); 
  const { toast } = useToast();

  // 2. MODIFICATION : 'updateFullTournamentState' est enveloppé dans useCallback
  const updateFullTournamentState = useCallback((data) => {
    if (!data) {
        console.warn("Attempted to update state with null data.");
        if (isAdmin) {
             setCurrentStep('config');
        } else {
             setCurrentStep('no_tournament');
        }
        setIsLoading(false);
        return;
    }
    
    // Log seulement si l'état change pour éviter le spam
    if (data.currentStep !== currentStep || data.winner !== winner) {
       console.log("Updating full state from API data:", data);
    }

    setTournamentId(data._id || data.id); 
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
    
    if (data._id || data.id) {
        localStorage.setItem(TOURNAMENT_ID_LS_KEY, data._id || data.id);
    }
    setIsLoading(false); 
  // Ajout des dépendances pour useCallback
  }, [isAdmin, currentStep, winner]); 


  // useEffect de chargement initial (inchangé)
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);

      if (isAdmin) {
        // --- LOGIQUE ADMIN ---
        const savedId = localStorage.getItem(TOURNAMENT_ID_LS_KEY);
        if (savedId) {
          console.log(`Admin: Found saved tournament ID: ${savedId}. Fetching...`);
          try {
            const data = await getTournament(savedId);
            if (data) {
              updateFullTournamentState(data);
            } else {
              console.warn(`Admin: Tournament ${savedId} not found. Resetting.`);
              localStorage.removeItem(TOURNAMENT_ID_LS_KEY);
              setCurrentStep("config");
              setIsLoading(false);
            }
          } catch (error) {
            toast({ title: "Erreur", description: "Impossible de charger le tournoi.", variant: "destructive" });
            console.error("Admin: Failed to load tournament:", error);
            setCurrentStep("config");
            setIsLoading(false);
          }
        } else {
          console.log("Admin: No saved tournament ID found. Starting config.");
          setCurrentStep("config"); 
          setIsLoading(false);
        }

      } else {
        // --- LOGIQUE SPECTATEUR (chargement initial) ---
        console.log("Spectator: Fetching active tournament...");
        try {
          const data = await getTournament('active'); 
          if (data) {
            updateFullTournamentState(data);
          } else {
            console.warn("Spectator: No active tournament found on server.");
            setCurrentStep("no_tournament");
            setIsLoading(false);
          }
        } catch (error) {
          toast({ title: "Erreur", description: "Impossible de charger le tournoi.", variant: "destructive" });
          console.error("Spectator: Failed to load active tournament:", error);
          setCurrentStep("no_tournament");
          setIsLoading(false);
        }
      }
    };
    
    loadData();
  }, [isAdmin, updateFullTournamentState, toast]); // Dépendances mises à jour


  // 3. --- NOUVEAU : Rafraîchissement automatique pour les spectateurs ---
  useEffect(() => {
    // Ne rien faire si on est admin
    if (isAdmin) {
      return;
    }

    // Définir l'intervalle de polling
    const intervalId = setInterval(async () => {
      console.log("Spectator: Polling for active tournament data...");
      try {
        // On ne met pas setIsLoading(true) pour éviter le flash du loader
        const data = await getTournament('active');
        
        if (data) {
          // updateFullTournamentState mettra à jour l'état
          // et s'assurera que isLoading est false
          updateFullTournamentState(data);
        } else {
          // Si le tournoi est supprimé (devient 404),
          // on passe à l'écran "no_tournament"
          setCurrentStep('no_tournament');
        }
      } catch (error) {
        // Échec silencieux, ne pas spammer le spectateur
        console.warn("Spectator: Poll failed (server might be down or busy)", error);
      }
    }, 15000); // Toutes les 15 secondes

    // Fonction de nettoyage pour arrêter l'intervalle si le composant est démonté
    return () => {
      clearInterval(intervalId);
    };
    
  }, [isAdmin, updateFullTournamentState]); // Dépend de isAdmin et de la fonction stable updateFullTournamentState


  // --- Fonctions de gestion d'état (inchangées) ---
  const handleTournamentCreated = (tournamentData) => {
    updateFullTournamentState(tournamentData); 
  };
  const handleGroupsDrawn = (tournamentData) => {
     updateFullTournamentState(tournamentData);
  };
   const handleScoreUpdated = (tournamentData) => {
       updateFullTournamentState(tournamentData);
   };
   const handleGroupStageCompleted = (tournamentData) => {
        updateFullTournamentState(tournamentData);
   };
    const handleKnockoutUpdated = (tournamentData) => {
        updateFullTournamentState(tournamentData);
    };
    const handleTournamentFinished = (tournamentData) => {
        updateFullTournamentState(tournamentData);
    };
  const handleResetTournament = () => {
        if (!isAdmin) return; 
        setIsLoading(true); 
        localStorage.removeItem(TOURNAMENT_ID_LS_KEY);
        setTournamentId(null);
        setPlayers([]);
        setGroups([]);
        setQualifiedPlayers([]);
        setEliminatedPlayers([]);
        setKnockoutMatches([]);
        setWinner(null);
        setCurrentStep("config"); 
        setIsLoading(false); 
        toast({ title: "Tournoi réinitialisé."});
  };
  const handleAdminLogout = () => {
      localStorage.removeItem(ADMIN_STATUS_LS_KEY);
      window.location.reload(); 
  };


  // Affichage pendant le chargement 
  if (isLoading) {
      return (
          <div className="flex justify-center items-center min-h-screen">
              <Loader2 className="h-16 w-16 animate-spin text-cyan-400" />
              <p className="ml-4 text-xl text-gray-300">Chargement du tournoi...</p>
          </div>
      );
  }

  // NOUVEL état : Spectateur et pas de tournoi
  if (currentStep === 'no_tournament') {
       return (
          <div className="flex flex-col justify-center items-center min-h-screen text-center px-4">
              <ShieldOff className="h-24 w-24 text-gray-600 mb-6" />
              <h1 className="text-3xl font-bold text-gray-300 mb-2">Aucun tournoi en cours</h1>
              <p className="text-xl text-gray-400">
                L'administrateur n'a pas encore créé de tournoi.
              </p>
              <p className="text-lg text-gray-500 mt-2">
                Revenez plus tard pour voir l'avancement.
              </p>
          </div>
       );
  }


  // Rendu conditionnel des étapes (passage de isAdmin)
  const renderStep = () => {
    switch (currentStep) {
      case 'config':
        return <Step1Registration onComplete={handleTournamentCreated} isAdmin={isAdmin} />;
      case 'groups':
        return <Step2GroupStage tournamentId={tournamentId} players={players} groups={groups} onGroupsDrawn={handleGroupsDrawn} onScoreUpdate={handleScoreUpdated} onCompleteGroups={handleGroupStageCompleted} isAdmin={isAdmin} />;
      case 'qualified': 
      case 'knockout': 
      case 'finished': 
        if (currentStep === 'qualified') {
             return <Step3Qualification
                        tournamentId={tournamentId}
                        groups={groups} 
                        qualifiedPlayers={qualifiedPlayers}
                        eliminatedPlayers={eliminatedPlayers}
                        onKnockoutDrawComplete={handleKnockoutUpdated} 
                        isAdmin={isAdmin}
                    />;
        } else { // knockout ou finished
             return <Step4Bracket
                        tournamentId={tournamentId}
                        knockoutMatches={knockoutMatches}
                        onScoreUpdate={handleKnockoutUpdated}
                        winner={winner}
                        onFinish={handleTournamentFinished} 
                        groups={groups}
                        thirdPlace={thirdPlace} 
                        isAdmin={isAdmin}
                    />;
        }

      default:
        return isAdmin ? <Step1Registration onComplete={handleTournamentCreated} isAdmin={isAdmin} /> : null;
    }
  };


  return (
    <div className="min-h-screen w-full py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header (corrigé pour centrer) */}
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
                    {currentStep !== 'config' && (
                         <AlertDialog>
                         <AlertDialogTrigger asChild>
                           <Button
                             variant="destructive" 
                             className="px-6 py-2 rounded-lg transition-all duration-300 font-medium w-full sm:w-auto" 
                           >
                             Réinitialiser
                           </Button>
                         </AlertDialogTrigger>
                         <AlertDialogContent className="bg-gray-900 border-gray-700 text-gray-100">
                           <AlertDialogHeader>
                             <AlertDialogTitle className="text-xl text-white">Êtes-vous sûr ?</AlertDialogTitle>
                             <AlertDialogDescription className="text-gray-400">
                               Cette action est irréversible et effacera toutes les données du tournoi en cours.
                             </AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                             <AlertDialogCancel className="text-gray-300 border-gray-600 hover:bg-gray-700">Annuler</AlertDialogCancel>
                             <AlertDialogAction onClick={handleResetTournament} className="bg-red-600 hover:bg-red-700 text-white">
                               Confirmer la réinitialisation
                             </AlertDialogAction>
                           </AlertDialogFooter>
                         </AlertDialogContent>
                       </AlertDialog>
                    )}
                     <Button
                        variant="outline"
                        onClick={handleAdminLogout}
                        className="px-6 py-2 rounded-lg transition-all duration-300 font-medium w-full sm:w-auto border-gray-600 text-gray-300 hover:bg-gray-800"
                     >
                        <LogOut className="w-4 h-4 mr-2" />
                        Quitter Mode Admin
                     </Button>
                </div>
             )}
             
             {!isAdmin && (
                <div className="flex items-center gap-2 bg-gray-800 text-cyan-400 px-4 py-2 rounded-lg border border-gray-700 sm:ml-auto">
                    <Users className="w-5 h-5" />
                    <span className="font-medium">Mode Spectateur (Lecture seule)</span>
                </div>
             )}
        </div>
         
        {/* Indicateur d'étape (inchangé) */}
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
               const isActive = (currentStep === stepInfo.stepKey) ||
                                (stepInfo.stepKey === 'knockout' && currentStep === 'finished');
               const isCompleted = currentStepIndex > thisStepLogicalIndex && thisStepLogicalIndex !== -1;
               const pulseClass = isActive ? 'pulse-step' : ''; 
               const nextStepLogicalIndex = index + 1 < arr.length ? stepOrder.findIndex(s => s === arr[index + 1].stepKey) : -1;
               const lineCompleted = currentStepIndex >= nextStepLogicalIndex && nextStepLogicalIndex !== -1;

               return (
                  <div key={stepInfo.num} className="flex flex-col sm:flex-row items-center">
                      <div className="relative flex flex-col items-center">
                          <div
                              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${pulseClass} ${
                              isActive ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/50 scale-110' :
                              isCompleted ? 'bg-green-600 text-white' :
                              'bg-gray-700 text-gray-400'
                              }`}
                          >
                              {isCompleted ? <Check className="w-6 h-6" /> : stepInfo.num}
                          </div>
                          <span className="absolute top-full mt-2 text-xs text-gray-400 whitespace-nowrap">
                            {stepInfo.name}
                          </span>
                      </div>
                      {stepInfo.num < 4 && (
                          <div
                          className={`w-1 h-12 sm:w-16 sm:h-1 my-2 sm:my-0 sm:mx-2 sm:mt-[-2.5rem] transition-colors duration-500 ${ 
                              lineCompleted ? 'bg-gradient-to-r from-green-600 to-green-500' : 'bg-gray-700'
                          }`}
                          />
                      )}
                  </div>
              )
           })}
       </div>

        {/* Content */}
        <div key={currentStep} className="fade-in">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default TournamentManager;