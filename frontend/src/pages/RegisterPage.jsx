import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { Loader2, UserPlus } from 'lucide-react';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 4) {
      toast({ title: 'Erreur', description: 'Le mot de passe doit faire au moins 4 caractères.', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    const success = await register(username, password);
    if (success) {
      toast({ title: 'Compte créé !', description: 'Vous pouvez maintenant vous connecter.' });
      navigate('/login'); // Redirige vers la page de connexion
    } else {
      toast({ title: 'Erreur', description: 'Ce nom d\'utilisateur est peut-être déjà pris.', variant: 'destructive' });
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold text-center text-white">Créer un Compte Admin</h1>
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
            {loading ? <Loader2 className="animate-spin" /> : <UserPlus className="mr-2" />}
            S'inscrire
          </Button>
        </form>
         <p className="text-center text-sm text-gray-400">
          Déjà un compte ?{' '}
          <Link to="/login" className="font-medium text-cyan-400 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;