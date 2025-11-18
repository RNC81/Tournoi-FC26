import React from 'react';
import { useParams } from 'react-router-dom';

const TournamentPage = () => {
  const { id } = useParams(); // Récupère l'ID depuis l'URL

  return (
    <div className="p-8 text-white">
      <h1 className="text-3xl font-bold mb-4">Vue du Tournoi</h1>
      <p>ID du Tournoi : {id}</p>
      <p>Étape 6 : C'est ici que nous chargerons les données du tournoi {id} et que nous afficherons le composant TournamentManager.</p>
    </div>
  );
};

export default TournamentPage;