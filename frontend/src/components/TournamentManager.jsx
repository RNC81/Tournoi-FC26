/* Fichier: frontend/src/components/TournamentManager.jsx */
import { useState, useEffect, useCallback, useRef } from 'react';
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

// --- STYLE "EDUCATION FIRST" (Dark Modern) ---
// Utilise les classes .EF-card, .EF-btn-*, et la palette Zinc/Lime définie dans index.css

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
  const [format, setFormat] = useState('1v1');

  const [isLoading, setIsLoading] = useState(!initialData);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingStep, setViewingStep] = useState(null); // null = vue normale (currentStep)

  const prevStepRef = useRef(currentStep);
  const lastUpdateRef = useRef(initialData?.updatedAt ? new Date(initialData.updatedAt).getTime() : 0);

  const { toast } = useToast();

  const updateFullTournamentState = useCallback((data) => {
    if (!data) {
      console.warn("Tentative de mise à jour avec données nulles.");
      setCurrentStep('no_tournament');
      setIsLoading(false);
      return;
    }

    const incomingDate = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
    if (incomingDate < lastUpdateRef.current) return;
    lastUpdateRef.current = incomingDate;

    setFormat(data.format || '1v1');

    const newStep = data.currentStep || "config";

    if (prevStepRef.current !== newStep && prevStepRef.current !== "loading") {
      if (prevStepRef.current === "groups" && (newStep === "qualified" || newStep === "knockout")) {
        toast({ title: "Phase terminée", description: "La phase de poules est terminée. Place à la suite !", duration: 4000 });
      }
    }

    if (data.winner && !winner) {
      toast({ title: "Tournoi terminé !", description: `Félicitations à ${data.winner} !`, duration: 5000 });
    }

    prevStepRef.current = newStep;

    const tId = data._id || data.id;
    setTournamentId(tId);
    setCurrentStep(newStep);
    setPlayers(data.players || []);
    setGroups(data.groups || []);

    if (data.qualifiedPlayers && data.players) {
      const qualifiedObjects = [];
      const elimObjects = [];
      const allPlayerStats = data.groups ? data.groups.flatMap(g => g.players) : [];

      data.qualifiedPlayers.forEach(name => {
        const stats = allPlayerStats.find(p => p.name === name);
        if (stats) qualifiedObjects.push(stats);
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
  }, [winner, toast]);


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
    if (isAdmin || !tournamentId || currentStep === 'finished' || winner) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const data = await getTournament(tournamentId);
        if (data) {
          updateFullTournamentState(data);
        }
      } catch (error) {
        // Silent fail
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isAdmin, tournamentId, currentStep, winner, updateFullTournamentState]);


  const handleTournamentUpdate = (tournamentData) => { updateFullTournamentState(tournamentData); };

  const handleDeleteTournament = async () => {
    if (!isAdmin || !tournamentId) return;
    setIsDeleting(true);
    try {
      await deleteTournament(tournamentId);
      toast({ title: "Tournoi supprimé.", description: "Redirection vers le tableau de bord..." });
      window.location.href = '/dashboard';
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer le tournoi.", variant: "destructive" });
      setIsDeleting(false);
    }
  };

  if (isLoading || isDeleting) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-blue-400" />
        <p className="ml-4 text-xl text-zinc-400">
          {isDeleting ? "Suppression en cours..." : "Chargement..."}
        </p>
      </div>
    );
  }

  if (currentStep === 'no_tournament') {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-center px-4">
        <ShieldOff className="h-24 w-24 text-zinc-600 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-2">Tournoi introuvable</h1>
        <p className="text-xl text-zinc-500">Les données ne sont pas disponibles ou ont été supprimées.</p>
        <Button onClick={() => window.location.href = '/'} className="mt-6 EF-btn-secondary">Retour Accueil</Button>
      </div>
    );
  }

  const activeView = viewingStep || currentStep;
  const isReadOnlyView = viewingStep !== null && viewingStep !== currentStep;

  const renderStep = () => {
    switch (activeView) {
      case 'config':
        return <Step1Registration onComplete={handleTournamentUpdate} isAdmin={isAdmin && !isReadOnlyView} />;
      case 'groups':
        return <Step2GroupStage tournamentId={tournamentId} players={players} groups={groups} onGroupsDrawn={handleTournamentUpdate} onScoreUpdate={handleTournamentUpdate} onCompleteGroups={handleTournamentUpdate} isAdmin={isAdmin && !isReadOnlyView} format={format} />;
      case 'qualified':
        return <Step3Qualification tournamentId={tournamentId} groups={groups} qualifiedPlayers={qualifiedPlayers} eliminatedPlayers={eliminatedPlayers} onKnockoutDrawComplete={handleTournamentUpdate} isAdmin={isAdmin && !isReadOnlyView} />;
      case 'knockout':
      case 'finished':
        return <Step4Bracket tournamentId={tournamentId} knockoutMatches={knockoutMatches} onScoreUpdate={handleTournamentUpdate} winner={winner} groups={groups} thirdPlace={thirdPlace} isAdmin={isAdmin && !isReadOnlyView} format={format} />;
      default:
        return isAdmin ? <Step1Registration onComplete={handleTournamentUpdate} isAdmin={isAdmin} /> : null;
    }
  };

  return (
    <div className="min-h-screen w-full py-8 px-4 bg-[#141414]">
      <div className="max-w-7xl mx-auto">

        {/* HEADER & CONTROLS */}
        <div className="text-center mb-12 flex flex-col sm:flex-row justify-center items-center gap-6">
          <div className="flex items-center justify-center gap-3 flex-grow">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <Trophy className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Tournoi <span className="text-blue-400">FC26</span>
            </h1>
          </div>

          {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:ml-auto">
              {currentStep !== 'config' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="px-6 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 transition-all">
                      <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#1F1F1F] border-zinc-800 text-white rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl text-white">Supprimer le tournoi ?</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        Cette action est <strong>définitive</strong>. Toutes les données de ce tournoi seront perdues.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl">Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteTournament} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">Confirmer la suppression</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button variant="outline" onClick={() => window.location.href = '/dashboard'} className="EF-btn-secondary">
                <LogOut className="w-4 h-4 mr-2" /> Dashboard
              </Button>
            </div>
          )}

          {!isAdmin && (
            <div className="flex items-center gap-2 bg-[#1F1F1F] text-blue-400 px-4 py-2 rounded-xl border border-white/5 sm:ml-auto">
              <Users className="w-5 h-5" />
              <span className="font-medium">Mode Spectateur</span>
            </div>
          )}
        </div>

        {/* STEPPER NAVIGATION */}
        <div className="flex flex-col sm:flex-row justify-center items-center sm:items-start gap-4 mb-16 px-4">
          {[
            { num: 1, name: 'Config', stepKey: 'config' },
            { num: 2, name: 'Poules', stepKey: 'groups' },
            { num: 3, name: 'Qualif.', stepKey: 'qualified' },
            { num: 4, name: 'Finales', stepKey: 'knockout' }
          ].map((stepInfo, index, arr) => {
            const stepOrder = ['config', 'groups', 'qualified', 'knockout', 'finished'];
            const currentStepIndex = currentStep === 'no_tournament' ? -1 : stepOrder.indexOf(currentStep);
            const thisStepLogicalIndex = stepOrder.findIndex(s => s === stepInfo.stepKey);
            const isActive = (activeView === stepInfo.stepKey) || (stepInfo.stepKey === 'knockout' && activeView === 'finished');
            const isCompleted = currentStepIndex > thisStepLogicalIndex && thisStepLogicalIndex !== -1;
            const isPast = isCompleted; // phases visitables en lecture seule

            const activeStyle = "bg-blue-400 text-black shadow-[0_0_15px_rgba(59,130,246,0.4)] scale-110 border-0";
            const completedStyle = "bg-[#22C55E] text-white border-0 cursor-pointer hover:scale-105 hover:shadow-[0_0_12px_rgba(34,197,94,0.4)] transition-transform";
            const pendingStyle = "bg-[#1F1F1F] text-zinc-500 border border-white/10";

            const lineCompleted = currentStepIndex >= (index + 1 < arr.length ? stepOrder.findIndex(s => s === arr[index + 1].stepKey) : -1);

            const handleStepClick = () => {
              if (isPast && !isActive) {
                // Naviguer vers une étape passée en lecture seule
                setViewingStep(stepInfo.stepKey);
              } else if (isActive && viewingStep !== null) {
                // Cliquer sur l'étape active remet en vue normale
                setViewingStep(null);
              }
            };

            return (
              <div key={stepInfo.num} className="flex flex-col sm:flex-row items-center w-full sm:w-auto">
                <div className="relative flex flex-col items-center z-10">
                  <div
                    onClick={handleStepClick}
                    title={isPast && !isActive ? `Voir la phase "${stepInfo.name}" (lecture seule)` : undefined}
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${isActive ? activeStyle : isCompleted ? completedStyle : pendingStyle}`}
                  >
                    {isCompleted && !isActive ? <Check className="w-6 h-6" /> : stepInfo.num}
                  </div>
                  <span className={`absolute top-full mt-3 text-xs font-medium whitespace-nowrap ${isActive ? 'text-white' : 'text-zinc-500'}`}>{stepInfo.name}</span>
                </div>

                {/* Ligne connecteur */}
                {stepInfo.num < 4 && (
                  <div className={`w-1 h-12 sm:w-20 sm:h-1 my-2 sm:my-0 sm:mx-[-10px] sm:mt-[-2.5rem] transition-colors duration-500 ${lineCompleted ? 'bg-[#22C55E]' : 'bg-zinc-800'}`} />
                )}
              </div>
            )
          })}
        </div>

        <div key={activeView} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Bannière lecture seule */}
          {isReadOnlyView && (
            <div className="mb-6 flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-3">
              <div className="flex items-center gap-2 text-amber-400">
                <span className="text-lg">👁</span>
                <span className="font-medium text-sm">Vue lecture seule — cette phase est terminée</span>
              </div>
              <button
                onClick={() => setViewingStep(null)}
                className="text-xs text-amber-400 hover:text-white border border-amber-500/40 hover:border-white/30 px-3 py-1.5 rounded-lg transition-all"
              >
                ← Retour à la phase actuelle
              </button>
            </div>
          )}
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default TournamentManager;