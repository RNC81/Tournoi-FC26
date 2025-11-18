// Fichier: frontend/src/pages/PublicListPage.jsx
import React, { useState, useEffect } from 'react';
import { getPublicTournaments } from '../api';
import { Link } from 'react-router-dom';
import { Loader2, Trophy, ArrowRight, Calendar, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';

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
    <div className="min-h-screen w-full py-12 px-4 bg-gray-950"> {/* Fond sombre global */}
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
              Tournois EA FC 26
            </h1>
            <p className="text-gray-400">Suivez les scores et les résultats en direct.</p>
          </div>
          <Link to="/login">
            <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white">
              <User className="mr-2 w-4 h-4" />
              Espace Organisateur
            </Button>
          </Link>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 rounded-2xl border border-gray-800">
            <Trophy className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h2 className="text-xl text-gray-300 font-medium">Aucun tournoi public pour le moment.</h2>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((tournoi) => (
              <Link 
                to={`/tournament/${tournoi.id || tournoi._id}`} 
                key={tournoi.id || tournoi._id}
                className="group relative bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:shadow-2xl hover:shadow-cyan-900/20 transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-blue-900/30 p-2 rounded-lg">
                        <Trophy className="w-6 h-6 text-blue-400" />
                    </div>
                    {tournoi.winner ? (
                        <span className="px-2 py-1 bg-yellow-900/30 text-yellow-500 text-xs font-bold rounded uppercase tracking-wider border border-yellow-700/50">
                            Terminé
                        </span>
                    ) : (
                        <span className="px-2 py-1 bg-green-900/30 text-green-500 text-xs font-bold rounded uppercase tracking-wider border border-green-700/50 animate-pulse">
                            En cours
                        </span>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors truncate">
                    {tournoi.name}
                  </h3>
                  
                  <div className="flex items-center text-gray-400 text-sm mb-4">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(tournoi.createdAt)}
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                    <span className="text-sm text-gray-500">
                        {tournoi.players ? tournoi.players.length : 0} Joueurs
                    </span>
                    <span className="text-cyan-400 text-sm font-medium flex items-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                        Voir <ArrowRight className="ml-1 w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicListPage;