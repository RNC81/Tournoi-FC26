import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { Loader2, LogIn } from 'lucide-react';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(username, password);
    if (success) {
      toast({ title: 'Connexion réussie !' });
      navigate('/dashboard'); // Redirige vers le tableau de bord
    } else {
      toast({ title: 'Erreur', description: 'Nom d\'utilisateur ou mot de passe incorrect.', variant: 'destructive' });
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold text-center text-white">Connexion Admin</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-gray-300">Nom d'utilisateur</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-300">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <LogIn className="mr-2" />}
            Se connecter
          </Button>
        </form>
        <p className="text-center text-sm text-gray-400">
          Pas encore de compte ?{' '}
          <Link to="/register" className="font-medium text-cyan-400 hover:underline">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;