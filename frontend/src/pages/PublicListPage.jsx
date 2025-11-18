import React from 'react';
import { Link } from 'react-router-dom';

const PublicListPage = () => {
  return (
    <div className="p-8 text-white">
      <h1 className="text-3xl font-bold mb-4">Tournois en cours</h1>
      <p>Étape 5 : C'est ici que nous afficherons la liste publique des tournois.</p>
      <Link to="/login" className="text-cyan-400 hover:underline">Accès Admin</Link>
    </div>
  );
};

export default PublicListPage;