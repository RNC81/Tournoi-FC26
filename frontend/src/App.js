// Fichier: frontend/src/App.js
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import { useAuth } from './context/AuthContext';

// Importez vos pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PublicListPage from './pages/PublicListPage';
import TournamentPage from './pages/TournamentPage';
import CreateTournamentPage from './pages/CreateTournamentPage'; // <-- ASSUREZ-VOUS QUE CETTE LIGNE EST PRÉSENTE

// Un composant simple pour protéger les routes
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth(); // Ajout de 'loading'

  // Attendre que l'authentification soit vérifiée au démarrage
  if (loading) {
    return null; // Affiche une page blanche (ou un loader) pendant la vérification
  }

  if (!isAuthenticated) {
    // Redirige vers la page de connexion
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Routes Publiques */}
          <Route path="/" element={<PublicListPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/tournament/:id" element={<TournamentPage />} />

          {/* Routes Protégées (Admin) */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
          {/* Route de création de tournoi */}
          <Route 
            path="/create-tournament" 
            element={
              <ProtectedRoute>
                <CreateTournamentPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Redirection par défaut */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;