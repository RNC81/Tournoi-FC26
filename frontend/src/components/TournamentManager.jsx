import { useState, useEffect, useCallback } from 'react';
import Step1Registration from './Step1Registration';
import Step2GroupStage from './Step2GroupStage';
import Step3Qualification from './Step3Qualification';
import Step4Bracket from './Step4Bracket';
import { Trophy, Loader2, Check } from 'lucide-react'; // Ajout de Loader2 pour l'indicateur
import { useToast } from '../hooks/use-toast';
import { getTournament } from '../api'; // Import de la fonction API
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
} from './ui/alert-dialog'; // <-- AJOUTE CET IMPORT COMPLET
import { Button } from './ui/button'; // <-- AJOUTE CETTE LIGNE

const TOURNAMENT_ID_LS_KEY = 'currentTournamentId';

const TournamentManager = () => {
  const [currentStep, setCurrentStep] = useState("loading"); // loading, config, groups, qualified, knockout, finished
  const [tournamentId, setTournamentId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [qualifiedPlayers, setQualifiedPlayers] = useState([]); // Gardons la liste des objets joueurs qualifiés ici
  const [eliminatedPlayers, setEliminatedPlayers] = useState([]); // Liste des objets joueurs éliminés
  const [knockoutMatches, setKnockoutMatches] = useState([]);
  const [winner, setWinner] = useState(null);
  const [thirdPlace, setThirdPlace] = useState(null); // Ajout état thirdPlace
  const [isLoading, setIsLoading] = useState(true); // État de chargement initial
  const { toast } = useToast();

  // Fonction pour mettre à jour l'état complet du tournoi
  const updateFullTournamentState = (data) => {
    if (!data) {
        console.warn("Attempted to update state with null data. Resetting.");
        handleResetTournament(false); // Reset sans confirmation si les données sont invalides
        setIsLoading(false);
        return;
    }
    console.log("Updating full state from API data:", data);
    setTournamentId(data._id || data.id); // Utilise _id reçu de l'API
    setCurrentStep(data.currentStep || "config");
    setPlayers(data.players || []);
    setGroups(data.groups || []);

    // Mise à jour des qualifiés/éliminés basée sur les données backend si disponibles
    if (data.qualifiedPlayers && data.players) {
        // Recréer les objets PlayerStats pour les qualifiés pour Step3
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
                 // On met un objet basique si les stats ne sont pas trouvées (ne devrait pas arriver)
                 elimObjects.push(stats || { name: name, points: 0, goalDiff: 0 });
            }
        });
        setQualifiedPlayers(qualifiedObjects);
        setEliminatedPlayers(elimObjects);

    } else {
        setQualifiedPlayers([]); // Réinitialise si non présents
        setEliminatedPlayers([]);
    }


    setKnockoutMatches(data.knockoutMatches || []);
    setWinner(data.winner || null);
    setThirdPlace(data.thirdPlace || null); // Met à jour thirdPlace si présent
    // Sauvegarde l'ID dans localStorage
    if (data._id || data.id) {
        localStorage.setItem(TOURNAMENT_ID_LS_KEY, data._id || data.id);
    }
    setIsLoading(false); // Fin du chargement
  };


  // Charger le tournoi au montage
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const savedId = localStorage.getItem(TOURNAMENT_ID_LS_KEY);
      if (savedId) {
        console.log(`Found saved tournament ID: ${savedId}. Fetching...`);
        try {
          const data = await getTournament(savedId);
          if (data) {
            updateFullTournamentState(data);
          } else {
            // ID trouvé mais tournoi non trouvé sur le serveur (peut-être supprimé?)
            console.warn(`Tournament with ID ${savedId} not found on server. Resetting.`);
            handleResetTournament(false); // Reset sans confirmation
          }
        } catch (error) {
          toast({ title: "Erreur", description: "Impossible de charger les données du tournoi.", variant: "destructive" });
          console.error("Failed to load tournament:", error);
          // Optionnel: peut-être juste aller à l'écran config au lieu de reset complet?
          setCurrentStep("config");
          setIsLoading(false);
        }
      } else {
        console.log("No saved tournament ID found. Starting fresh.");
        setCurrentStep("config"); // Pas d'ID, on va à la config
        setIsLoading(false);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Déclenché une seule fois au montage


  // --- Fonctions de gestion d'état passées aux composants enfants ---

  const handleTournamentCreated = (tournamentData) => {
    updateFullTournamentState(tournamentData); // Met à jour tout l'état
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

  // Fonction de réinitialisation
  const handleResetTournament = () => {
        setIsLoading(true); // Indique qu'on recharge
        localStorage.removeItem(TOURNAMENT_ID_LS_KEY);
        setTournamentId(null);
        setPlayers([]);
        setGroups([]);
        setQualifiedPlayers([]);
        setEliminatedPlayers([]);
        setKnockoutMatches([]);
        setWinner(null);
        setCurrentStep("config"); // Retour à l'étape initiale
        setIsLoading(false); // Fin du reset
        toast({ title: "Tournoi réinitialisé."});
        // Optionnel : Forcer un rechargement de page si nécessaire, mais normalement pas utile avec React
        // window.location.reload();
      
  };


  // Affichage pendant le chargement initial
  if (isLoading) {
      return (
          <div className="flex justify-center items-center min-h-screen">
              <Loader2 className="h-16 w-16 animate-spin text-cyan-400" />
              <p className="ml-4 text-xl text-gray-300">Chargement du tournoi...</p>
          </div>
      );
  }


  // Rendu conditionnel des étapes
  const renderStep = () => {
    switch (currentStep) {
      case 'config':
        return <Step1Registration onComplete={handleTournamentCreated} />;
      case 'groups':
        return <Step2GroupStage tournamentId={tournamentId} players={players} groups={groups} onGroupsDrawn={handleGroupsDrawn} onScoreUpdate={handleScoreUpdated} onCompleteGroups={handleGroupStageCompleted} />;
      case 'qualified': // On passe directement à l'étape 3 visuellement
      case 'knockout': // Ou à l'étape 4
      case 'finished': // Ou à la fin
        // On a besoin d'un composant qui gère l'affichage de Qualif + Tirage + Bracket
        // Step3Qualification pourrait gérer l'affichage Qualif + Bouton Tirage
        // Step4Bracket pourrait prendre les matchs générés et les afficher
        if (currentStep === 'qualified') {
             return <Step3Qualification
                        tournamentId={tournamentId}
                        groups={groups} // Peut-être plus nécessaire si qualifiés déjà dans l'état
                        qualifiedPlayers={qualifiedPlayers}
                        eliminatedPlayers={eliminatedPlayers}
                        onKnockoutDrawComplete={handleKnockoutUpdated} // Appelé après POST complete_groups
                    />;
        } else { // knockout ou finished
             return <Step4Bracket
                        tournamentId={tournamentId}
                        knockoutMatches={knockoutMatches}
                        onScoreUpdate={handleKnockoutUpdated}
                        winner={winner}
                        onFinish={handleTournamentFinished} // Pour mettre à jour l'état final
                        groups={groups}
                        thirdPlace={thirdPlace} // Peut-être utile pour référence
                    />;
        }

      default:
        return <Step1Registration onComplete={handleTournamentCreated} />; // Fallback
    }
  };


  return (
    <div className="min-h-screen w-full py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header (MODIFIÉ POUR RESPONSIVE) */}
        <div className="text-center mb-12 fade-in flex flex-col sm:flex-row justify-between items-center gap-6">
             <div className="flex items-center justify-center gap-3 flex-grow">
                 <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-cyan-400" />
                 <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                   Tournoi EA FC 26
                 </h1>
                 <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-cyan-400" />
             </div>
             {currentStep !== 'config' && (
                 <AlertDialog>
                 <AlertDialogTrigger asChild>
                   <Button
                     variant="destructive" // Utilise la variante destructive du bouton Shadcn
                     className="px-6 py-2 rounded-lg transition-all duration-300 font-medium w-full sm:w-auto" // Ajout de w-full sm:w-auto
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
                     {/* Appel handleResetTournament SANS argument ici */}
                     <AlertDialogAction onClick={handleResetTournament} className="bg-red-600 hover:bg-red-700 text-white">
                       Confirmer la réinitialisation
                     </AlertDialogAction>
                   </AlertDialogFooter>
                 </AlertDialogContent>
               </AlertDialog>
               )}
        </div>
         
        {/* --- Indicateur d'étape (MODIFIÉ POUR RESPONSIVE) --- */}
       <div className="flex flex-col sm:flex-row justify-center items-center sm:items-start gap-4 mb-16"> {/* Passage en flex-col, sm:flex-row */}
           {[
             { num: 1, name: 'Config', stepKey: 'config' },
             { num: 2, name: 'Poules', stepKey: 'groups' },
             { num: 3, name: 'Qualif.', stepKey: 'qualified' }, // 'qualified' marque la fin des poules
             { num: 4, name: 'Finales', stepKey: 'knockout' } // 'knockout' et 'finished' sont pour l'étape 4
           ].map((stepInfo, index, arr) => {
               // Détermine l'ordre des étapes pour savoir si c'est complété
               const stepOrder = ['config', 'groups', 'qualified', 'knockout', 'finished'];
               const currentStepIndex = stepOrder.indexOf(currentStep);
               // Trouve l'index correspondant à stepKey DANS stepOrder
               const thisStepLogicalIndex = stepOrder.findIndex(s => s === stepInfo.stepKey);

               // Conditions ajustées
               const isActive = (currentStep === stepInfo.stepKey) ||
                                (stepInfo.stepKey === 'knockout' && currentStep === 'finished'); // L'étape 4 reste active si fini
               // Une étape est complétée si l'index de l'étape actuelle est strictement supérieur à l'index logique de cette étape
               const isCompleted = currentStepIndex > thisStepLogicalIndex && thisStepLogicalIndex !== -1;


               // Classe pour la pulsation
               const pulseClass = isActive ? 'pulse-step' : ''; // Applique la classe si l'étape est active

               // Classe pour la ligne de connexion
               // La ligne après l'étape 'i' est complétée si l'étape 'i+1' est active ou complétée
               // Trouve l'index logique de l'étape suivante
               const nextStepLogicalIndex = index + 1 < arr.length ? stepOrder.findIndex(s => s === arr[index + 1].stepKey) : -1;
               const lineCompleted = currentStepIndex >= nextStepLogicalIndex && nextStepLogicalIndex !== -1;


               return (
                  // Conteneur d'étape passe en flex-col sm:flex-row
                  <div key={stepInfo.num} className="flex flex-col sm:flex-row items-center">
                      {/* Conteneur pour le cercle et le texte en dessous */}
                      <div className="relative flex flex-col items-center">
                          <div
                              // Ajout de pulseClass, ajustement des couleurs/styles
                              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${pulseClass} ${
                              isActive ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/50 scale-110' :
                              isCompleted ? 'bg-green-600 text-white' :
                              'bg-gray-700 text-gray-400'
                              }`}
                          >
                              {/* Affiche Check si complété, sinon le numéro */}
                              {isCompleted ? <Check className="w-6 h-6" /> : stepInfo.num}
                          </div>
                          {/* Ajout du nom de l'étape en dessous */}
                          <span className="absolute top-full mt-2 text-xs text-gray-400 whitespace-nowrap">
                            {stepInfo.name}
                          </span>
                      </div>
                      {/* Ligne de connexion (MODIFIÉE POUR RESPONSIVE) */}
                      {stepInfo.num < 4 && (
                          <div
                          // Devient verticale (h-12 w-1) par défaut, et horizontale (w-16 h-1) sur sm+
                          className={`w-1 h-12 sm:w-16 sm:h-1 my-2 sm:my-0 sm:mx-2 sm:mt-[-2.5rem] transition-colors duration-500 ${ // mt négatif pour remonter la ligne
                              lineCompleted ? 'bg-gradient-to-r from-green-600 to-green-500' : 'bg-gray-700'
                          }`}
                          />
                      )}
                  </div>
              )
           })}
       </div>
       {/* --- Fin de l'indicateur --- */}


        {/* Content */}
        <div key={currentStep} className="fade-in">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default TournamentManager;