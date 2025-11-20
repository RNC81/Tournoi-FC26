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
import CreateTournamentPage from './pages/CreateTournamentPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard'; // <-- Nouveau

// Protection basique
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Protection Super Admin
const SuperAdminRoute = ({ children }) => {
    const { isAuthenticated, user, loading } = useAuth();
    if (loading) return null;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.role !== 'super_admin') return <Navigate to="/dashboard" replace />;
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

          {/* Routes Admin (Organisateur) */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/create-tournament" 
            element={
              <ProtectedRoute>
                <CreateTournamentPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Route Super Admin */}
          <Route 
            path="/admin" 
            element={
                <SuperAdminRoute>
                    <SuperAdminDashboard />
                </SuperAdminRoute>
            } 
          />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;