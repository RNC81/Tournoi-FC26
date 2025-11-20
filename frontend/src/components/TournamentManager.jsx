/* Fichier: frontend/src/components/TournamentManager.jsx */
import { useState, useEffect, useCallback } from 'react';
import Step1Registration from './Step1Registration';
import Step2GroupStage from './Step2GroupStage';
import Step3Qualification from './Step3Qualification';
import Step4Bracket from './Step4Bracket';
import { Trophy, Loader2, Check, ShieldOff, LogOut, Users, Trash2 } from 'lucide-react'; 
import { useToast } from '../hooks/use-toast';
import { getTournament, deleteTournament } from '../api'; 
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
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { toast } = useToast();

  // --- FONCTION DE MISE A JOUR NETTOYÉE ---
  const updateFullTournamentState = useCallback((data) => {
    if (!data) {
        console.warn("Data null, ignore.");
        return;
    }

    const tId = data._id || data.id;
    const newStep = data.currentStep || "config";

    // Mise à jour des états
    setTournamentId(tId); 
    setCurrentStep(newStep);
    setPlayers(data.players || []);
    setGroups(data.groups || []);
    setKnockoutMatches(data.knockoutMatches || []);
    setWinner(data.winner || null);
    setThirdPlace(data.thirdPlace || null); 

    // Gestion des qualifiés (pour Step3)
    if (data.qualifiedPlayers && data.players) {
        const qualifiedObjects = [];
        const elimObjects = [];
        const allPlayerStats = data.groups ? data.groups.flatMap(g => g.players) : [];

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

    setIsLoading(false); 
  }, []); // Dépendances vides pour stabilité


  // 1. CHARGEMENT INITIAL
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
                setCurrentStep("no_tournament");
            }
        };
        fetchT();
    } else {
        setCurrentStep("no_tournament");
        setIsLoading(false);
    }
  }, [initialData, tournamentId, updateFullTournamentState]);

  // 2. POLLING (Rafraîchissement)
  useEffect(() => {
    if (isAdmin || !tournamentId) return;

    const intervalId = setInterval(async () => {
      try {
        const data = await getTournament(tournamentId);
        if (data) updateFullTournamentState(data);
      } catch (error) { }
    }, 5000); 

    return () => clearInterval(intervalId);
  }, [isAdmin, tournamentId, updateFullTournamentState]);


  // Handlers
  const handleTournamentCreated = (d) => updateFullTournamentState(d);
  const handleGroupsDrawn = (d) => updateFullTournamentState(d);
  const handleScoreUpdated = (d) => updateFullTournamentState(d);
  const handleGroupStageCompleted = (d) => updateFullTournamentState(d);
  const handleKnockoutUpdated = (d) => updateFullTournamentState(d);
  const handleTournamentFinished = (d) => updateFullTournamentState(d);

  const handleDeleteTournament = async () => {
        if (!isAdmin || !tournamentId) return; 
        setIsDeleting(true);
        try {
            await deleteTournament(tournamentId);
            toast({ title: "Tournoi supprimé.", description: "Retour au tableau de bord." });
            window.location.href = '/dashboard';
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" });
            setIsDeleting(false);
        }
  };
  
  const handleResetTournament = () => {}; 
  const handleAdminLogout = () => {
      localStorage.removeItem(ADMIN_STATUS_LS_KEY);
      localStorage.removeItem('authToken');
      window.location.href = '/'; 
  };

  if (isLoading || isDeleting) {
      return (
          <div className="flex justify-center items-center min-h-screen">
              <Loader2 className="h-16 w-16 animate-spin text-cyan-400" />
          </div>
      );
  }

  if (currentStep === 'no_tournament') {
       return (
          <div className="flex flex-col justify-center items-center min-h-screen text-center px-4">
              <ShieldOff className="h-24 w-24 text-gray-600 mb-6" />
              <h1 className="text-3xl font-bold text-gray-300 mb-2">Tournoi introuvable</h1>
              <Button onClick={() => window.location.href='/'} className="mt-6" variant="outline">Retour Accueil</Button>
          </div>
       );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'config': return <Step1Registration onComplete={handleTournamentCreated} isAdmin={isAdmin} />;
      case 'groups': return <Step2GroupStage tournamentId={tournamentId} players={players} groups={groups} onGroupsDrawn={handleGroupsDrawn} onScoreUpdate={handleScoreUpdated} onCompleteGroups={handleGroupStageCompleted} isAdmin={isAdmin} />;
      case 'qualified': return <Step3Qualification tournamentId={tournamentId} groups={groups} qualifiedPlayers={qualifiedPlayers} eliminatedPlayers={eliminatedPlayers} onKnockoutDrawComplete={handleKnockoutUpdated} isAdmin={isAdmin} />;
      case 'knockout': 
      case 'finished': return <Step4Bracket tournamentId={tournamentId} knockoutMatches={knockoutMatches} onScoreUpdate={handleKnockoutUpdated} winner={winner} onFinish={handleTournamentFinished} groups={groups} thirdPlace={thirdPlace} isAdmin={isAdmin} />;
      default: return isAdmin ? <Step1Registration onComplete={handleTournamentCreated} isAdmin={isAdmin} /> : null;
    }
  };

  return (
    <div className="min-h-screen w-full py-8 px-4">
      <div className="max-w-7xl mx-auto">
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
                           <Button variant="destructive" className="px-6 py-2 rounded-lg transition-all duration-300 font-medium w-full sm:w-auto">
                             <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                           </Button>
                         </AlertDialogTrigger>
                         <AlertDialogContent className="bg-gray-900 border-gray-700 text-gray-100">
                           <AlertDialogHeader>
                             <AlertDialogTitle>Supprimer le tournoi ?</AlertDialogTitle>
                             <AlertDialogDescription>Action définitive.</AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                             <AlertDialogCancel>Annuler</AlertDialogCancel>
                             <AlertDialogAction onClick={handleDeleteTournament} className="bg-red-600 text-white">Confirmer</AlertDialogAction>
                           </AlertDialogFooter>
                         </AlertDialogContent>
                       </AlertDialog>
                    )}
                     <Button variant="outline" onClick={() => window.location.href = '/dashboard'} className="px-6 py-2 rounded-lg transition-all duration-300 font-medium w-full sm:w-auto border-gray-600 text-gray-300 hover:bg-gray-800">
                        <LogOut className="w-4 h-4 mr-2" /> Dashboard
                     </Button>
                </div>
             )}
        </div>
         
       <div className="flex flex-col sm:flex-row justify-center items-center sm:items-start gap-4 mb-16"> 
           {[
             { num: 1, name: 'Config', stepKey: 'config' },
             { num: 2, name: 'Poules', stepKey: 'groups' },
             { num: 3, name: 'Qualif.', stepKey: 'qualified' }, 
             { num: 4, name: 'Finales', stepKey: 'knockout' } 
           ].map((stepInfo) => {
               const stepOrder = ['config', 'groups', 'qualified', 'knockout', 'finished'];
               const currentStepIndex = currentStep === 'no_tournament' ? -1 : stepOrder.indexOf(currentStep);
               const thisStepLogicalIndex = stepOrder.findIndex(s => s === stepInfo.stepKey);
               const isActive = (currentStep === stepInfo.stepKey) || (stepInfo.stepKey === 'knockout' && currentStep === 'finished');
               const isCompleted = currentStepIndex > thisStepLogicalIndex;
               return (
                  <div key={stepInfo.num} className="flex flex-col sm:flex-row items-center">
                      <div className="relative flex flex-col items-center">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${isActive ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white scale-110' : isCompleted ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                              {isCompleted ? <Check className="w-6 h-6" /> : stepInfo.num}
                          </div>
                          <span className="absolute top-full mt-2 text-xs text-gray-400 whitespace-nowrap">{stepInfo.name}</span>
                      </div>
                      {stepInfo.num < 4 && <div className={`w-1 h-12 sm:w-16 sm:h-1 my-2 sm:my-0 sm:mx-2 sm:mt-[-2.5rem] bg-gray-700`} />}
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