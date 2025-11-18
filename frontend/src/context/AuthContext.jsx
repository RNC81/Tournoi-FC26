// Fichier: frontend/src/context/AuthContext.jsx

import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import apiClient from '../api'; // Importe notre apiClient configuré

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000';

const AuthContext = createContext(null);

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null); // On stocke le nom d'utilisateur
  const [loading, setLoading] = useState(true); // Pour le chargement initial

  useEffect(() => {
    // Au démarrage, on vérifie si un token est dans localStorage
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      // On valide le token (ici on suppose qu'il est valide,
      // idéalement on appellerait une route /api/auth/me)
      setToken(storedToken);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      
      // Petit hack pour récupérer le username depuis le token (partie du milieu)
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        setUser({ username: payload.sub });
      } catch (e) {
        console.error("Erreur décodage token", e);
        // Si le token est invalide, on le supprime
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        username,
        password,
      });
      const { access_token } = response.data;
      
      setToken(access_token);
      localStorage.setItem('authToken', access_token);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // On décode le token pour le nom d'utilisateur
      const payload = JSON.parse(atob(access_token.split('.')[1]));
      setUser({ username: payload.sub });

      return true; // Succès
    } catch (error) {
      console.error("Échec de la connexion", error);
      return false; // Échec
    }
  };

  const register = async (username, password) => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/register`, {
        username,
        password,
      });
      return true; // Succès
    } catch (error) {
      console.error("Échec de l'inscription", error);
      return false; // Échec
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    delete apiClient.defaults.headers.common['Authorization'];
  };

  const value = {
    token,
    user,
    isAuthenticated: !!token,
    loading,
    login,
    register,
    logout,
  };

  // Ne rend rien tant qu'on ne sait pas si on est connecté ou non
  if (loading) {
    return null; // Ou un loader global si vous préférez
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};