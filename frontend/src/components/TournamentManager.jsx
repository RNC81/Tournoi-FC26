import { useState, useEffect } from 'react';
import Step1Registration from './Step1Registration';
import Step2GroupStage from './Step2GroupStage';
import Step3Qualification from './Step3Qualification';
import Step4Bracket from './Step4Bracket';
import { Trophy } from 'lucide-react';

const TournamentManager = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [players, setPlayers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [qualifiedPlayers, setQualifiedPlayers] = useState([]);
  const [eliminatedPlayers, setEliminatedPlayers] = useState([]);
  const [knockoutMatches, setKnockoutMatches] = useState([]);
  const [winner, setWinner] = useState(null);

  // Load tournament data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('tournamentData');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setCurrentStep(data.currentStep || 1);
        setPlayers(data.players || []);
        setGroups(data.groups || []);
        setQualifiedPlayers(data.qualifiedPlayers || []);
        setEliminatedPlayers(data.eliminatedPlayers || []);
        setKnockoutMatches(data.knockoutMatches || []);
        setWinner(data.winner || null);
      } catch (error) {
        console.error('Error loading tournament data:', error);
      }
    }
  }, []);

  // Save tournament data to localStorage whenever it changes
  useEffect(() => {
    const data = {
      currentStep,
      players,
      groups,
      qualifiedPlayers,
      eliminatedPlayers,
      knockoutMatches,
      winner
    };
    localStorage.setItem('tournamentData', JSON.stringify(data));
  }, [currentStep, players, groups, qualifiedPlayers, eliminatedPlayers, knockoutMatches, winner]);

  const resetTournament = () => {
    if (window.confirm('Voulez-vous vraiment réinitialiser le tournoi ? Toutes les données seront perdues.')) {
      setCurrentStep(1);
      setPlayers([]);
      setGroups([]);
      setQualifiedPlayers([]);
      setEliminatedPlayers([]);
      setKnockoutMatches([]);
      setWinner(null);
      localStorage.removeItem('tournamentData');
    }
  };

  return (
    <div className="min-h-screen w-full py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-cyan-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Tournoi EA FC 26
            </h1>
            <Trophy className="w-12 h-12 text-cyan-400" />
          </div>
          <p className="text-gray-400 text-lg">Gestionnaire de Tournoi 1v1</p>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-center items-center gap-4 mb-12">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${
                  currentStep >= step
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {step}
              </div>
              {step < 4 && (
                <div
                  className={`w-16 h-1 mx-2 transition-all duration-300 ${
                    currentStep > step ? 'bg-gradient-to-r from-cyan-400 to-blue-500' : 'bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Reset Button */}
        {currentStep > 1 && (
          <div className="flex justify-end mb-6">
            <button
              onClick={resetTournament}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-300 font-medium"
            >
              Réinitialiser le Tournoi
            </button>
          </div>
        )}

        {/* Content */}
        <div className="fade-in">
          {currentStep === 1 && (
            <Step1Registration
              onComplete={(playersList) => {
                setPlayers(playersList);
                setCurrentStep(2);
              }}
              initialPlayers={players}
            />
          )}

          {currentStep === 2 && (
            <Step2GroupStage
              players={players}
              groups={groups}
              setGroups={setGroups}
              onComplete={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 3 && (
            <Step3Qualification
              groups={groups}
              onComplete={(qualified, eliminated) => {
                setQualifiedPlayers(qualified);
                setEliminatedPlayers(eliminated);
                setCurrentStep(4);
              }}
              qualifiedPlayers={qualifiedPlayers}
              eliminatedPlayers={eliminatedPlayers}
            />
          )}

          {currentStep === 4 && (
            <Step4Bracket
              qualifiedPlayers={qualifiedPlayers}
              knockoutMatches={knockoutMatches}
              setKnockoutMatches={setKnockoutMatches}
              winner={winner}
              setWinner={setWinner}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentManager;
