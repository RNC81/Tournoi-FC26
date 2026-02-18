// Fichier: frontend/src/pages/TournamentsListPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Users, Award, Search, Filter, Loader2 } from 'lucide-react';
import { getMyTournaments } from '../api';
import { useToast } from '../hooks/use-toast';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useStadiumZone } from '../context/BackgroundContext';
import PageTransition from '../components/layout/PageTransition';

const TournamentsListPage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // all, active, completed

    // Activer la zone du stade
    useStadiumZone('locker-room');

    useEffect(() => {
        const loadTournaments = async () => {
            try {
                setLoading(true);
                const data = await getMyTournaments();
                setTournaments(data);
            } catch (error) {
                toast({ title: 'Erreur', description: 'Impossible de charger les tournois.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };
        loadTournaments();
    }, [toast]);

    const filteredTournaments = tournaments.filter(t => {
        const matchesSearch = t.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus =
            filterStatus === 'all' ? true :
                filterStatus === 'active' ? !t.winner :
                    filterStatus === 'completed' ? t.winner : true;
        return matchesSearch && matchesStatus;
    });

    const activeTournaments = tournaments.filter(t => !t.winner).length;
    const completedTournaments = tournaments.filter(t => t.winner).length;

    return (
        <PageTransition>
            <div className="space-y-8">
                {/* HEADER */}
                <motion.div
                    className="FM-header-banner"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <Trophy className="w-8 h-8 text-blue-400" />
                                <h1 className="text-4xl font-bold text-white">Mes Tournois</h1>
                            </div>
                            <p className="text-zinc-400">Gérez et suivez tous vos tournois en un seul endroit</p>
                        </div>
                        <Button
                            onClick={() => navigate('/create-tournament')}
                            className="FM-btn-primary"
                        >
                            <Trophy className="w-5 h-5 mr-2" />
                            Nouveau Tournoi
                        </Button>
                    </div>
                </motion.div>

                {/* STATS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <motion.div
                        className="FM-stats-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Trophy className="w-8 h-8 text-blue-400 mb-3" />
                        <p className="text-zinc-400 text-sm mb-1">Total Tournois</p>
                        <p className="text-4xl font-bold text-white">{tournaments.length}</p>
                    </motion.div>

                    <motion.div
                        className="FM-stats-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Award className="w-8 h-8 text-green-400 mb-3" />
                        <p className="text-zinc-400 text-sm mb-1">En Cours</p>
                        <p className="text-4xl font-bold text-white">{activeTournaments}</p>
                    </motion.div>

                    <motion.div
                        className="FM-stats-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Calendar className="w-8 h-8 text-amber-400 mb-3" />
                        <p className="text-zinc-400 text-sm mb-1">Terminés</p>
                        <p className="text-4xl font-bold text-white">{completedTournaments}</p>
                    </motion.div>
                </div>

                {/* FILTERS */}
                <div className="FM-card p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
                            <Input
                                type="text"
                                placeholder="Rechercher un tournoi..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="EF-input pl-12"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => setFilterStatus('all')}
                                variant={filterStatus === 'all' ? 'default' : 'outline'}
                                className={filterStatus === 'all' ? 'bg-blue-500 text-white' : 'EF-btn-secondary'}
                            >
                                Tous
                            </Button>
                            <Button
                                onClick={() => setFilterStatus('active')}
                                variant={filterStatus === 'active' ? 'default' : 'outline'}
                                className={filterStatus === 'active' ? 'bg-green-500 text-white' : 'EF-btn-secondary'}
                            >
                                En cours
                            </Button>
                            <Button
                                onClick={() => setFilterStatus('completed')}
                                variant={filterStatus === 'completed' ? 'default' : 'outline'}
                                className={filterStatus === 'completed' ? 'bg-amber-500 text-white' : 'EF-btn-secondary'}
                            >
                                Terminés
                            </Button>
                        </div>
                    </div>
                </div>

                {/* TOURNAMENTS LIST */}
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
                    </div>
                ) : filteredTournaments.length === 0 ? (
                    <div className="FM-card p-12 text-center">
                        <Trophy className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">Aucun tournoi trouvé</h2>
                        <p className="text-zinc-400 mb-6">
                            {searchTerm ? 'Essayez une autre recherche' : 'Créez votre premier tournoi pour commencer'}
                        </p>
                        {!searchTerm && (
                            <Button onClick={() => navigate('/create-tournament')} className="FM-btn-primary">
                                <Trophy className="w-5 h-5 mr-2" />
                                Créer un Tournoi
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTournaments.map((tournament, index) => (
                            <motion.div
                                key={tournament._id}
                                className="FM-card p-6 cursor-pointer hover:scale-[1.02] transition-transform"
                                onClick={() => navigate(`/tournament/${tournament._id}`)}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Trophy className="w-6 h-6 text-blue-400" />
                                        <h3 className="text-xl font-bold text-white">{tournament.name}</h3>
                                    </div>
                                    {tournament.winner ? (
                                        <span className="FM-badge-active bg-green-500/10 text-green-400 border-green-500/20">
                                            Terminé
                                        </span>
                                    ) : (
                                        <span className="FM-badge-active">
                                            En cours
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2 text-sm text-zinc-400">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        <span>{tournament.players?.length || 0} joueurs</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Award className="w-4 h-4" />
                                        <span>Format: {tournament.format || '1v1'}</span>
                                    </div>
                                    {tournament.winner && (
                                        <div className="flex items-center gap-2 text-amber-400">
                                            <Trophy className="w-4 h-4" />
                                            <span className="font-semibold">Vainqueur: {tournament.winner}</span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default TournamentsListPage;
