// Fichier: frontend/src/App.js
import './App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import { useAuth } from './context/AuthContext';
import { BackgroundProvider } from './context/BackgroundContext';
import GlobalStadiumBackground from './components/layout/GlobalStadiumBackground';
import { AnimatePresence } from 'framer-motion';

// Importez vos pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PublicListPage from './pages/PublicListPage';
import TournamentPage from './pages/TournamentPage';
import CreateTournamentPage from './pages/CreateTournamentPage';
import TournamentsListPage from './pages/TournamentsListPage';
import PlayersPage from './pages/PlayersPage';
import SettingsPage from './pages/SettingsPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DashboardLayout from './components/layout/DashboardLayout';

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

// Wrapper pour AnimatePresence
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Routes Publiques */}
        <Route path="/" element={<PublicListPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/tournament/:id" element={<TournamentPage />} />

        {/* Routes Admin (Organisateur) avec Layout */}
        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/create-tournament" element={<CreateTournamentPage />} />
          <Route path="/tournaments" element={<TournamentsListPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Route Super Admin */}
          <Route
            path="/admin"
            element={
              <SuperAdminRoute>
                <SuperAdminDashboard />
              </SuperAdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <div className="App relative min-h-screen">
      <BackgroundProvider>
        <GlobalStadiumBackground overlayOpacity={0.85} />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
        <Toaster />
      </BackgroundProvider>
    </div>
  );
}

export default App;