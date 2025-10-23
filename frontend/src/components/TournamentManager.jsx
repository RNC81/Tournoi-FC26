import { useState, useEffect, useCallback } from 'react';
import Step1Registration from './Step1Registration';
import Step2GroupStage from './Step2GroupStage';
import Step3Qualification from './Step3Qualification';
import Step4Bracket from './Step4Bracket';
import { Trophy, Loader2 } from 'lucide-react'; // Ajout de Loader2 pour l'indicateur
import { useToast } from '../hooks/use-toast';
import { getTournament } from '../api'; // Import de la fonction API

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
  const handleResetTournament = (confirm = true) => {
      const doReset = () => {
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

      if (confirm) {
        if (window.confirm('Êtes-vous sûr de vouloir tout recommencer ? Ceci effacera toutes les données.')) {
           doReset();
        }
      } else {
        doReset();
      }
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
                    />;
        }

      default:
        return <Step1Registration onComplete={handleTournamentCreated} />; // Fallback
    }
  };


  return (
    <div className="min-h-screen w-full py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 fade-in flex justify-between items-center">
             <div className="flex items-center justify-center gap-3 mb-4 flex-grow">
                 <Trophy className="w-12 h-12 text-cyan-400" />
                 <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                   Tournoi EA FC 26
                 </h1>
                 <Trophy className="w-12 h-12 text-cyan-400" />
             </div>
             {currentStep !== 'config' && (
                 <button
                   onClick={() => handleResetTournament(true)} // Confirmation requise ici
                   className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-300 font-medium"
                 >
                   Réinitialiser
                 </button>
               )}
        </div>
         {/* ... (indicateur d'étape reste le même) ... */}
         <div className="flex justify-center items-center gap-4 mb-12">
            {[ { num: 1, name: 'Config' }, { num: 2, name: 'Poules' }, { num: 3, name: 'Qualif.' }, { num: 4, name: 'Finales' }].map((stepInfo) => {
                 let isActive = false;
                 if (currentStep === 'config' && stepInfo.num === 1) isActive = true;
                 if (currentStep === 'groups' && stepInfo.num === 2) isActive = true;
                 if (currentStep === 'qualified' && stepInfo.num === 3) isActive = true;
                 if ((currentStep === 'knockout' || currentStep === 'finished') && stepInfo.num === 4) isActive = true;

                 let isCompleted = false;
                 if (currentStep === 'groups' && stepInfo.num < 2) isCompleted = true;
                 if (currentStep === 'qualified' && stepInfo.num < 3) isCompleted = true;
                 if ((currentStep === 'knockout' || currentStep === 'finished') && stepInfo.num < 4) isCompleted = true;
                 if (currentStep === 'finished' && stepInfo.num === 4) isCompleted = true;


                 return (
                    <div key={stepInfo.num} className="flex items-center">
                        <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${
                            isActive ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/50 scale-110' :
                            isCompleted ? 'bg-green-600 text-white' :
                            'bg-gray-700 text-gray-400'
                            }`}
                        >
                            {stepInfo.num}
                        </div>
                        {stepInfo.num < 4 && (
                            <div
                            className={`w-16 h-1 mx-2 transition-all duration-300 ${
                                isCompleted ? 'bg-gradient-to-r from-green-600 to-green-500' :
                                (isActive && stepInfo.num < 4) ? 'bg-gradient-to-r from-cyan-400 to-blue-500' :
                                'bg-gray-700'
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
