// Fichier: frontend/src/pages/SuperAdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { getPendingUsers, approveUser, rejectUser } from '../api';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import { CheckCircle, XCircle, User, ShieldAlert, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const SuperAdminDashboard = () => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await getPendingUsers();
            setPendingUsers(data);
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible de charger les utilisateurs en attente.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleApprove = async (username) => {
        try {
            await approveUser(username);
            toast({ title: "Utilisateur approuvé", description: `${username} peut maintenant se connecter.` });
            fetchUsers(); // Refresh
        } catch (error) {
            toast({ title: "Erreur", description: "Échec de l'approbation.", variant: "destructive" });
        }
    };

    const handleReject = async (username) => {
        try {
            await rejectUser(username);
            toast({ title: "Utilisateur rejeté", description: `${username} a été bloqué.` });
            fetchUsers(); // Refresh
        } catch (error) {
            toast({ title: "Erreur", description: "Échec du rejet.", variant: "destructive" });
        }
    };
    
    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="min-h-screen w-full py-8 px-4 bg-gray-950">
            <div className="max-w-5xl mx-auto">
                 <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                        Super Admin Dashboard
                    </h1>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => navigate('/dashboard')} className="border-gray-600 text-gray-300">
                            Mes Tournois
                        </Button>
                        <Button variant="destructive" onClick={handleLogout}>
                            <LogOut className="mr-2 w-4 h-4" /> Déconnexion
                        </Button>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
                    <h2 className="text-xl font-semibold text-gray-200 mb-6 flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Comptes en attente de validation ({pendingUsers.length})
                    </h2>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                        </div>
                    ) : pendingUsers.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 bg-gray-900/50 rounded-lg border border-gray-800 border-dashed">
                            Aucune demande en attente. Tout est calme.
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {pendingUsers.map((u) => (
                                <div key={u.username} className="flex flex-col sm:flex-row justify-between items-center bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                                    <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold text-white">
                                            {u.username[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium text-lg">{u.username}</p>
                                            <p className="text-gray-400 text-sm">Inscrit le: {new Date(u.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button onClick={() => handleReject(u.username)} variant="outline" className="border-red-900 text-red-500 hover:bg-red-950 hover:text-red-400">
                                            <XCircle className="mr-2 w-4 h-4" /> Rejeter
                                        </Button>
                                        <Button onClick={() => handleApprove(u.username)} className="bg-green-600 hover:bg-green-700 text-white">
                                            <CheckCircle className="mr-2 w-4 h-4" /> Approuver
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;