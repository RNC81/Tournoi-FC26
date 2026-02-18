// Fichier: frontend/src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getMyTournaments } from '../api';
import { Loader2, Trophy, Users, Calendar } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { motion } from 'framer-motion';
import { useStadiumZone } from '../context/BackgroundContext';
import PageTransition from '../components/layout/PageTransition';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useStadiumZone('locker-room');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const tournamentsData = await getMyTournaments();
        setTournaments(tournamentsData);
      } catch (error) {
        toast({ title: 'Erreur', description: 'Impossible de charger vos données.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [toast]);

  return (
    <PageTransition>
      <motion.div
        className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-white font-semibold text-lg mb-4">Mes Tournois</h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : tournaments.length === 0 ? (
          <p className="text-zinc-400 text-sm text-center py-8">
            Vous n'avez pas encore créé de tournoi.
          </p>
        ) : (
          <div className="space-y-2">
            {tournaments.map((tournament, index) => (
              <motion.div
                key={tournament._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/30 cursor-pointer transition-all group"
                onClick={() => navigate(`/tournament/${tournament._id}`)}
              >
                <div className="flex items-center gap-3">
                  <Trophy className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-white text-sm font-medium group-hover:text-blue-400 transition-colors">
                      {tournament.name}
                    </p>
                    <p className="text-zinc-500 text-xs flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {tournament.players?.length || 0} joueurs
                      </span>
                      <span>·</span>
                      <span>{tournament.format || '1v1'}</span>
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${tournament.winner
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                  {tournament.winner ? 'Terminé' : 'En cours'}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </PageTransition>
  );
};

export default DashboardPage;