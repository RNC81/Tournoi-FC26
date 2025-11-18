import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/'); // Redirige vers l'accueil
  };

  return (
    <div className="p-8 text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Tableau de Bord</h1>
        <div>
          <span className="mr-4">Bonjour, {user?.username}</span>
          <Button variant="outline" onClick={handleLogout}>Déconnexion</Button>
        </div>
      </div>
      <p>Étape 4 : C'est ici que nous afficherons la liste "Mes Tournois" et le bouton "Créer".</p>
    </div>
  );
};

export default DashboardPage;