// Fichier: frontend/src/pages/PlayersPage.jsx
import React, { useState, useEffect } from 'react';
import { Users, Trophy, Award, TrendingUp, Search, Loader2 } from 'lucide-react';
import { getMyTournaments } from '../api';
import { useToast } from '../hooks/use-toast';
import { motion } from 'framer-motion';
import { Input } from '../components/ui/input';
import { useStadiumZone } from '../context/BackgroundContext';
import PageTransition from '../components/layout/PageTransition';


const PlayersPage = () => {
    const { toast } = useToast();
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Activer la zone du stade
    useStadiumZone('locker-room');

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const data = await getMyTournaments();
                setTournaments(data);
            } catch (error) {
                toast({ title: 'Erreur', description: 'Impossible de charger les données.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [toast]);

    // Extraire tous les joueurs uniques de tous les tournois
    const allPlayers = tournaments.reduce((acc, tournament) => {
        if (tournament.players) {
            tournament.players.forEach(player => {
                if (!acc.find(p => p.name === player)) {
                    acc.push({
                        name: player,
                        tournaments: tournaments.filter(t => t.players?.includes(player)).length,
                        wins: tournaments.filter(t => t.winner === player).length,
                    });
                }
            });
        }
        return acc;
    }, []);

    const filteredPlayers = allPlayers.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPlayers = allPlayers.length;
    const totalParticipations = allPlayers.reduce((acc, p) => acc + p.tournaments, 0);
    const avgParticipations = totalPlayers > 0 ? (totalParticipations / totalPlayers).toFixed(1) : 0;

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
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <Users className="w-8 h-8 text-blue-400" />
                            <h1 className="text-4xl font-bold text-white">Base de Joueurs</h1>
                        </div>
                        <p className="text-zinc-400">Statistiques et historique de tous vos joueurs</p>
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
                        <Users className="w-8 h-8 text-blue-400 mb-3" />
                        <p className="text-zinc-400 text-sm mb-1">Total Joueurs</p>
                        <p className="text-4xl font-bold text-white">{totalPlayers}</p>
                    </motion.div>

                    <motion.div
                        className="FM-stats-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <TrendingUp className="w-8 h-8 text-green-400 mb-3" />
                        <p className="text-zinc-400 text-sm mb-1">Participations Moy.</p>
                        <p className="text-4xl font-bold text-white">{avgParticipations}</p>
                    </motion.div>

                    <motion.div
                        className="FM-stats-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Trophy className="w-8 h-8 text-amber-400 mb-3" />
                        <p className="text-zinc-400 text-sm mb-1">Total Victoires</p>
                        <p className="text-4xl font-bold text-white">
                            {allPlayers.reduce((acc, p) => acc + p.wins, 0)}
                        </p>
                    </motion.div>
                </div>

                {/* SEARCH */}
                <div className="FM-card p-6">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
                        <Input
                            type="text"
                            placeholder="Rechercher un joueur..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="EF-input pl-12"
                        />
                    </div>
                </div>

                {/* PLAYERS LIST */}
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
                    </div>
                ) : filteredPlayers.length === 0 ? (
                    <div className="FM-card p-12 text-center">
                        <Users className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">Aucun joueur trouvé</h2>
                        <p className="text-zinc-400">
                            {searchTerm ? 'Essayez une autre recherche' : 'Créez un tournoi pour commencer à enregistrer des joueurs'}
                        </p>
                    </div>
                ) : (
                    <div className="FM-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-[#141414] border-b border-white/10">
                                    <tr>
                                        <th className="text-left py-4 px-6 text-zinc-400 font-semibold text-sm">#</th>
                                        <th className="text-left py-4 px-6 text-zinc-400 font-semibold text-sm">Joueur</th>
                                        <th className="text-center py-4 px-6 text-zinc-400 font-semibold text-sm">Tournois</th>
                                        <th className="text-center py-4 px-6 text-zinc-400 font-semibold text-sm">Victoires</th>
                                        <th className="text-center py-4 px-6 text-zinc-400 font-semibold text-sm">Taux de Victoire</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPlayers
                                        .sort((a, b) => b.wins - a.wins)
                                        .map((player, index) => {
                                            const winRate = player.tournaments > 0
                                                ? ((player.wins / player.tournaments) * 100).toFixed(0)
                                                : 0;
                                            return (
                                                <motion.tr
                                                    key={player.name}
                                                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.03 }}
                                                >
                                                    <td className="py-4 px-6 text-zinc-500 font-bold">{index + 1}</td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                                                <span className="text-blue-400 font-bold">
                                                                    {player.name.charAt(0).toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <span className="text-white font-semibold">{player.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <span className="text-zinc-300 font-medium">{player.tournaments}</span>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {player.wins > 0 && <Trophy className="w-4 h-4 text-amber-400" />}
                                                            <span className="text-amber-400 font-bold">{player.wins}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <span className={`font-bold ${winRate >= 50 ? 'text-green-400' : winRate >= 25 ? 'text-blue-400' : 'text-zinc-400'}`}>
                                                            {winRate}%
                                                        </span>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default PlayersPage;
