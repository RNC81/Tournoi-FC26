// Fichier: frontend/src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { useNavigate, Link } from 'react-router-dom'; 
import { getMyTournaments, updateProfile, getPendingUsers } from '../api'; // Ajout de getPendingUsers
import { Loader2, Plus, LogOut, ArrowRight, Trophy, ShieldAlert, UserCog } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
};

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0); // Compteur de notifs
  
  // État pour le profil
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    if (user) setNewUsername(user.username);
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Chargement des tournois
        const tournamentsData = await getMyTournaments();
        setTournaments(tournamentsData);

        // Si Super Admin, on vérifie s'il y a des comptes en attente pour la notif
        if (user?.role === 'super_admin') {
            try {
                const pendingUsers = await getPendingUsers();
                setPendingCount(pendingUsers.length);
            } catch (e) {
                // Silent fail pour la notif, pas grave
            }
        }

      } catch (error) {
        toast({ title: 'Erreur', description: 'Impossible de charger vos données.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, toast]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleUpdateProfile = async () => {
      if (!newUsername.trim()) return;
      setIsUpdatingProfile(true);
      try {
          const payload = {};
          if (newUsername !== user.username) payload.username = newUsername;
          if (newPassword) payload.password = newPassword;
          
          if (Object.keys(payload).length === 0) {
              setIsProfileOpen(false);
              return;
          }

          await updateProfile(payload);
          toast({ title: "Profil mis à jour", description: "Veuillez vous reconnecter." });
          handleLogout(); 
      } catch (error) {
          const msg = error.response?.data?.detail || "Erreur lors de la mise à jour.";
          toast({ title: "Erreur", description: msg, variant: "destructive" });
      } finally {
          setIsUpdatingProfile(false);
      }
  };

  return (
    <div className="min-h-screen w-full py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex flex-col items-start">
             <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                Tableau de Bord
                {user?.role === 'super_admin' && <Badge variant="destructive" className="text-sm px-2 py-1">Super Admin</Badge>}
             </h1>
             <p className="text-gray-400 text-sm mt-1">Bienvenue, {user?.username}</p>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center md:justify-end">
             {/* Bouton Profil */}
            <Button variant="secondary" onClick={() => setIsProfileOpen(true)} className="bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700">
                <UserCog className="mr-2 w-4 h-4" /> Mon Profil
            </Button>

            {user?.role === 'super_admin' && (
                <Button 
                    variant="secondary" 
                    onClick={() => navigate('/admin')} 
                    className="bg-red-900/30 text-red-400 border border-red-900 hover:bg-red-900/50 relative"
                >
                    <ShieldAlert className="mr-2 w-4 h-4" /> 
                    Administration
                    {pendingCount > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                            {pendingCount}
                        </span>
                    )}
                </Button>
            )}

            <Button variant="outline" onClick={handleLogout} className="border-gray-600 text-gray-300 hover:bg-gray-800">
              <LogOut className="mr-2 w-4 h-4" /> Déconnexion
            </Button>
            <Button onClick={() => navigate('/create-tournament')} className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white">
              <Plus className="mr-2 w-4 h-4" /> Créer un tournoi
            </Button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700">
          <h2 className="text-2xl font-semibold text-white mb-6">Mes Tournois</h2>
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-12 h-12 animate-spin text-cyan-400" /></div>
          ) : tournaments.length === 0 ? (
            <p className="text-gray-400 text-center">Vous n'avez pas encore créé de tournoi.</p>
          ) : (
            <div className="space-y-4">
              {tournaments.map((tournoi) => (
                <Link to={`/tournament/${tournoi.id || tournoi._id}`} key={tournoi.id || tournoi._id} className="block p-6 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors group">
                  <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-cyan-400 group-hover:underline">{tournoi.name}</h3>
                      <p className="text-sm text-gray-400 mt-1">Créé le: {formatDate(tournoi.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-4 mt-4 sm:mt-0">
                      {tournoi.winner ? (
                        <span className="flex items-center text-sm font-medium text-yellow-400"><Trophy className="mr-2 w-4 h-4" /> Terminé (Vainqueur: {tournoi.winner})</span>
                      ) : (
                         <span className="text-sm font-medium text-green-400 animate-pulse">En cours</span>
                      )}
                      <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DIALOGUE PROFIL */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
            <DialogHeader>
                <DialogTitle>Modifier mon profil</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Nom d'utilisateur</Label>
                    <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="bg-gray-800 border-gray-600" />
                </div>
                <div className="space-y-2">
                    <Label>Nouveau mot de passe (laisser vide pour ne pas changer)</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="******" className="bg-gray-800 border-gray-600" />
                </div>
                <p className="text-xs text-yellow-500">Attention : Modifier ces informations vous déconnectera.</p>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsProfileOpen(false)} className="border-gray-600 text-gray-300">Annuler</Button>
                <Button onClick={handleUpdateProfile} disabled={isUpdatingProfile} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                    {isUpdatingProfile ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null} Enregistrer
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;