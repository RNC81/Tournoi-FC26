// Fichier: frontend/src/pages/PublicListPage.jsx
import React, { useState, useEffect } from 'react';
import { getPublicTournaments } from '../api';
import { Link } from 'react-router-dom';
import { Loader2, Trophy, ArrowRight, Calendar, User, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';
import { motion } from 'framer-motion';
import { useStadiumZone } from '../context/BackgroundContext';
import PageTransition from '../components/layout/PageTransition';


// Helper pour la date
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
};

const PublicListPage = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Activer la zone du stade
  useStadiumZone('exterior');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getPublicTournaments();
        setTournaments(data);
      } catch (error) {
        toast({ title: 'Erreur', description: 'Impossible de charger les tournois.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  return (
    <PageTransition>
      <div className="min-h-screen w-full font-sans text-white">
        {/* Navbar simplifiée */}
        <div className="border-b border-white/5 bg-black/30 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-300 to-blue-500 flex items-center justify-center">
                <span className="font-bold text-black text-lg">FC</span>
              </div>
              <span className="text-xl font-bold tracking-tight">Tournoi 26</span>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost" className="text-zinc-300 hover:text-white hover:bg-white/10">
                  Connexion
                </Button>
              </Link>
              <Link to="/register">
                <Button className="FM-btn-primary">
                  Espace Organisateur
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <motion.div
          className="max-w-7xl mx-auto px-6 py-20 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6">
            <Trophy className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400 font-medium">Plateforme de Tournois</span>
          </div>

          <h1 className="text-6xl font-black mb-6 bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-transparent">
            Tournoi FC26
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-8">
            Organisez et suivez vos tournois de football en toute simplicité
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link to="/register">
              <Button className="FM-btn-primary text-lg px-8 py-6">
                Créer un Tournoi
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Liste des tournois */}
        <div className="max-w-7xl mx-auto px-6 pb-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white">Tournois en cours</h2>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-20">
              <Trophy className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg">Aucun tournoi public pour le moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournaments.map((tournament, index) => (
                <motion.div
                  key={tournament._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link to={`/tournament/${tournament._id}`}>
                    <div className="FM-card p-6 hover:scale-[1.02] transition-transform cursor-pointer group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-6 h-6 text-blue-400" />
                          <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                            {tournament.name}
                          </h3>
                        </div>
                        {tournament.winner && (
                          <span className="FM-badge-active bg-green-500/10 text-green-400 border-green-500/20">
                            Terminé
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-sm text-zinc-400">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{tournament.players?.length || 0} joueurs</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(tournament.createdAt)}</span>
                        </div>
                        {tournament.winner && (
                          <div className="flex items-center gap-2 text-amber-400 font-semibold">
                            <Trophy className="w-4 h-4" />
                            <span>Vainqueur: {tournament.winner}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/5">
                        <Button variant="ghost" className="w-full text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                          Voir le tournoi
                          <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default PublicListPage;