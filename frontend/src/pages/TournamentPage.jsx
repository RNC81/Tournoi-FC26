// Fichier: frontend/src/pages/TournamentPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TournamentManager from '../components/TournamentManager';
import { getTournament } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

const TournamentPage = () => {
  const { id } = useParams(); 
  const { user } = useAuth(); 
  const navigate = useNavigate();

  const [tournamentData, setTournamentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await getTournament(id);
        
        if (!data) {
          setError("Tournoi introuvable.");
        } else {
          setTournamentData(data);
        }
      } catch (err) {
        console.error("Erreur chargement page tournoi:", err);
        setError("Impossible de charger le tournoi.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadData();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-950">
        <Loader2 className="w-16 h-16 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-950 text-white gap-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h1 className="text-2xl font-bold">{error}</h1>
        <Button variant="outline" onClick={() => navigate('/')}>
          Retour à l'accueil
        </Button>
      </div>
    );
  }

  // --- LOGIQUE DE DÉTECTION ADMIN (GOD MODE) ---
  // On est admin SI :
  // 1. On est le propriétaire du tournoi
  // 2. OU on est Super Admin (Droit de modération universel)
  const isOwner = user && (
      tournamentData?.owner_username === user.username || 
      user.role === 'super_admin'
  );

  return (
    <>
        <TournamentManager 
            isAdmin={isOwner} 
            initialData={tournamentData} 
        />
    </>
  );
};

export default TournamentPage;