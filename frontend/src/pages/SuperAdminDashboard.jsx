// Fichier: frontend/src/pages/SuperAdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { getPendingUsers, approveUser, rejectUser, getAllUsers, deleteUser } from '../api';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import { CheckCircle, XCircle, User, ShieldAlert, Loader2, LogOut, Trash2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';

const SuperAdminDashboard = () => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const [pending, all] = await Promise.all([getPendingUsers(), getAllUsers()]);
            setPendingUsers(pending);
            setAllUsers(all);
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible de charger les données.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const handleApprove = async (username) => {
        try {
            await approveUser(username);
            toast({ title: "Succès", description: `Compte ${username} approuvé.` });
            fetchAllData();
        } catch (error) {
            toast({ title: "Erreur", description: "Échec de l'approbation.", variant: "destructive" });
        }
    };

    const handleReject = async (username) => {
        try {
            await rejectUser(username);
            toast({ title: "Succès", description: `Compte ${username} rejeté.` });
            fetchAllData();
        } catch (error) {
            toast({ title: "Erreur", description: "Échec du rejet.", variant: "destructive" });
        }
    };

    const handleDeleteAccount = async (username) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur ${username} ?`)) return;
        try {
            await deleteUser(username);
            toast({ title: "Compte supprimé", description: `L'utilisateur ${username} a été supprimé.` });
            fetchAllData();
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible de supprimer ce compte.", variant: "destructive" });
        }
    };
    
    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="min-h-screen w-full py-8 px-4 bg-gray-950">
            <div className="max-w-5xl mx-auto">
                 <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
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
                    <Tabs defaultValue="pending" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-800">
                            <TabsTrigger value="pending" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                                En Attente 
                                {pendingUsers.length > 0 && <Badge variant="destructive" className="ml-2 px-2 py-0.5 h-5">{pendingUsers.length}</Badge>}
                            </TabsTrigger>
                            <TabsTrigger value="all" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                                Gestion des Utilisateurs
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="pending">
                             <h2 className="text-xl font-semibold text-gray-200 mb-6 flex items-center gap-2">
                                <User className="w-5 h-5" />
                                Validation des inscriptions
                            </h2>
                            {loading ? (
                                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
                            ) : pendingUsers.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 bg-gray-900/50 rounded-lg border border-gray-800 border-dashed">
                                    Aucune demande en attente.
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {pendingUsers.map((u) => (
                                        <div key={u.username} className="flex flex-col sm:flex-row justify-between items-center bg-gray-800 p-4 rounded-lg border border-gray-700">
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
                                                <Button onClick={() => handleReject(u.username)} variant="outline" className="border-red-900 text-red-500 hover:bg-red-950">
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
                        </TabsContent>

                        <TabsContent value="all">
                            <h2 className="text-xl font-semibold text-gray-200 mb-6 flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                Liste complète des comptes
                            </h2>
                             {loading ? (
                                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
                            ) : (
                                <div className="space-y-3">
                                    {allUsers.map((u) => (
                                        <div key={u.username} className="flex items-center justify-between bg-gray-800/50 p-3 rounded border border-gray-700">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${u.role === 'super_admin' ? 'bg-yellow-500' : u.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`} />
                                                <span className={u.role === 'super_admin' ? 'font-bold text-yellow-500' : 'text-gray-200'}>{u.username}</span>
                                                {u.role === 'super_admin' && <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-500">Super Admin</Badge>}
                                                {u.status === 'pending' && <Badge variant="secondary" className="text-xs">En attente</Badge>}
                                            </div>
                                            
                                            {/* On ne peut pas supprimer un super admin (soi-même) */}
                                            {u.role !== 'super_admin' && (
                                                <Button size="sm" variant="ghost" onClick={() => handleDeleteAccount(u.username)} className="text-gray-500 hover:text-red-500 hover:bg-red-900/20">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;