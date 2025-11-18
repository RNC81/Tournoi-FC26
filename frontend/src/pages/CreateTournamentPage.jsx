// Fichier: frontend/src/pages/CreateTournamentPage.jsx
import React from 'react';
import Step1Registration from '../components/Step1Registration';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CreateTournamentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); // On récupère l'utilisateur pour la prop isAdmin

  // 'Step1Registration' va maintenant appeler cette fonction
  // au lieu de celle de l'ancien TournamentManager
  const handleTournamentCreated = (tournamentData) => {
    // Une fois le tournoi créé, on redirige l'admin
    // vers la page de ce nouveau tournoi
    navigate(`/tournament/${tournamentData.id || tournamentData._id}`);
  };

  return (
    <div className="min-h-screen w-full py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* On passe la prop 'isAdmin' (toujours true ici) 
            et la nouvelle fonction 'onComplete' */}
        <Step1Registration 
          isAdmin={!!user} 
          onComplete={handleTournamentCreated} 
        />
      </div>
    </div>
  );
};

export default CreateTournamentPage;