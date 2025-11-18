// Fichier: frontend/src/context/AuthContext.jsx

import React, { createContext, useState, useContext, useEffect } from 'react';
// import axios from 'axios'; // <-- SUPPRIMÉ
import apiClient from '../api'; // <-- DÉJÀ PRÉSENT, MAINTENANT UTILISÉ

// const API_BASE_URL = ...; // <-- SUPPRIMÉ (inutile)

const AuthContext = createContext(null);

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        setUser({ username: payload.sub });
      } catch (e) {
        console.error("Erreur décodage token", e);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      // --- CORRECTION ICI ---
      // Utilise apiClient au lieu de axios.post
      const response = await apiClient.post(`/api/auth/login`, {
        username,
        password,
      });
      // --- FIN CORRECTION ---
      
      const { access_token } = response.data;
      
      setToken(access_token);
      localStorage.setItem('authToken', access_token);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

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
      // --- CORRECTION ICI ---
      // Utilise apiClient au lieu de axios.post
      await apiClient.post(`/api/auth/register`, {
        username,
        password,
      });
      // --- FIN CORRECTION ---
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

  if (loading) {
    return null; 
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};