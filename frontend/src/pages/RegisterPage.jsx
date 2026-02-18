// Fichier: frontend/src/pages/RegisterPage.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { Loader2, UserPlus, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStadiumZone } from '../context/BackgroundContext';
import PageTransition from '../components/layout/PageTransition';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Activer la zone du stade
  useStadiumZone('entrance');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 4) {
      toast({ title: 'Erreur', description: 'Le mot de passe doit faire au moins 4 caractères.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const result = await register(username, password);
    if (result.success) {
      toast({
        title: 'Inscription reçue',
        description: 'Votre compte a été créé. Un Super Admin doit le valider avant que vous puissiez vous connecter.',
        duration: 8000
      });
      navigate('/login');
    } else {
      toast({ title: 'Erreur', description: result.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="flex justify-center items-center min-h-screen px-4 font-sans">
        <motion.div
          className="w-full max-w-md EF-card p-10 bg-[#1F1F1F]/90 backdrop-blur-sm border border-white/10 shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-blue-400 border border-blue-500/20">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Demande d'accès</h1>
            <p className="text-zinc-500 text-sm mt-3">Créez un compte organisateur (soumis à validation)</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="EF-label">Nom d'utilisateur</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="EF-input p-4"
                placeholder="Votre pseudo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="EF-label">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="EF-input p-4"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full EF-btn-primary mt-4 py-6 text-lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <UserPlus className="mr-2 h-5 w-5" />}
              S'inscrire
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-8">
            Déjà un compte ?{' '}
            <Link to="/login" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Se connecter
            </Link>
          </p>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default RegisterPage;