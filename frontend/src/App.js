/* Modification de frontend/src/App.js */
import { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TournamentManager from './components/TournamentManager';
import { Toaster } from './components/ui/toaster';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './components/ui/alert-dialog';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Shield, Users, Loader2 } from 'lucide-react';
import { useToast } from './hooks/use-toast';

// Clé pour le statut admin
const ADMIN_STATUS_LS_KEY = 'isAdmin';
// Mot de passe (simple, pour l'instant)
const ADMIN_PASSWORD = "1234";

function App() {
  // null, 'admin_prompt', 'spectator', 'admin_authed'
  const [mode, setMode] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Chargement initial
  const { toast } = useToast();

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà admin
    try {
      const storedIsAdmin = localStorage.getItem(ADMIN_STATUS_LS_KEY);
      if (storedIsAdmin === 'true') {
        setIsAdmin(true);
        setMode('admin_authed');
      } else {
        // Pas admin, on affiche le choix
        setMode(null);
      }
    } catch (e) {
      console.error("Erreur localStorage", e);
      setMode(null); // Fallback
    }
    setIsLoading(false);
  }, []);

  const handleAdminLogin = () => {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_STATUS_LS_KEY, 'true');
      setIsAdmin(true);
      setMode('admin_authed');
      toast({ title: 'Accès autorisé', description: 'Mode Administrateur activé.' });
      setPassword('');
    } else {
      toast({ title: 'Erreur', description: 'Mot de passe incorrect.', variant: 'destructive' });
      setPassword('');
      // Optionnel: revenir au choix initial ?
      // setMode(null);
    }
  };

  const handleModeSelect = (selectedMode) => {
    if (selectedMode === 'admin') {
      setMode('admin_prompt');
    } else {
      setMode('spectator');
      setIsAdmin(false); // S'assurer que le mode spectateur n'est pas admin
    }
  };
  
  const handleCancelLogin = () => {
      setMode(null); // Retourne au choix initial
      setPassword('');
  };

  // Affiche un loader pendant la vérification du localStorage
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900">
        <Loader2 className="h-16 w-16 animate-spin text-cyan-400" />
      </div>
    );
  }

  // Affiche le contenu principal (choix, login ou app)
  const renderContent = () => {
    if (mode === 'admin_authed') {
      return <TournamentManager isAdmin={true} />;
    }
    if (mode === 'spectator') {
      return <TournamentManager isAdmin={false} />;
    }

    // Si on n'est ni admin_authed ni spectator, on affiche les modales de choix/login
    return (
      <>
        {/* Affiche l'arrière-plan même pendant le choix */}
        <div className="App" /> 
      
        {/* Dialogue de Choix Initial */}
        <AlertDialog open={mode === null}>
          <AlertDialogContent className="bg-gray-900 border-gray-700 text-gray-100">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl text-white text-center">Bienvenue</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400 text-center">
                Comment souhaitez-vous accéder au tournoi ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col sm:flex-col gap-3 pt-4"> {/* flex-col pour les deux boutons */}
              <Button
                onClick={() => handleModeSelect('admin')}
                className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
              >
                <Shield className="mr-2 w-5 h-5" />
                Mode Administrateur
              </Button>
              <Button
                onClick={() => handleModeSelect('spectator')}
                variant="outline"
                className="w-full py-6 text-lg border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Users className="mr-2 w-5 h-5" />
                Mode Spectateur
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialogue de Mot de Passe Admin */}
        <AlertDialog open={mode === 'admin_prompt'}>
          <AlertDialogContent className="bg-gray-900 border-gray-700 text-gray-100">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl text-white">Accès Administrateur</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Veuillez saisir le code secret pour continuer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
                <Label htmlFor="password">Code Secret</Label>
                <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="****"
                />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelLogin}>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleAdminLogin}>Valider</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  };

  return (
    // Div 'App' déplacée dans renderContent si non-authed pour l'arrière-plan
    <>
      <BrowserRouter>
        <Routes>
          {/* La route principale rend maintenant le contenu dynamique */}
          <Route path="/" element={renderContent()} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;