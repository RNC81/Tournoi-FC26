// Fichier: frontend/src/context/AuthContext.jsx

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import apiClient from '../api'; 

const AuthContext = createContext(null);

// Temps d'inactivité en millisecondes (30 minutes)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; 

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null); 
  const [loading, setLoading] = useState(true);
  
  // Timer de déconnexion auto
  const [inactivityTimer, setInactivityTimer] = useState(null);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    delete apiClient.defaults.headers.common['Authorization'];
    
    if (inactivityTimer) clearTimeout(inactivityTimer);
  }, [inactivityTimer]);

  // Gestionnaire d'activité pour reset le timer
  const resetInactivityTimer = useCallback(() => {
      if (!token) return;
      
      if (inactivityTimer) clearTimeout(inactivityTimer);
      
      const newTimer = setTimeout(() => {
          console.log("Session expirée par inactivité.");
          logout();
          window.location.href = '/login?expired=true';
      }, INACTIVITY_TIMEOUT);
      
      setInactivityTimer(newTimer);
  }, [token, logout, inactivityTimer]);

  // Listeners globaux pour l'activité
  useEffect(() => {
      if (token) {
          window.addEventListener('mousemove', resetInactivityTimer);
          window.addEventListener('keydown', resetInactivityTimer);
          resetInactivityTimer(); // Init
      } else {
          if (inactivityTimer) clearTimeout(inactivityTimer);
      }
      
      return () => {
          window.removeEventListener('mousemove', resetInactivityTimer);
          window.removeEventListener('keydown', resetInactivityTimer);
      };
  }, [token]); // Re-bind si token change


  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        // On récupère aussi le Rôle ici
        setUser({ username: payload.sub, role: payload.role || 'admin' });
      } catch (e) {
        console.error("Erreur décodage token", e);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await apiClient.post(`/api/auth/login`, {
        username,
        password,
      });
      
      const { access_token } = response.data;
      
      setToken(access_token);
      localStorage.setItem('authToken', access_token);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      const payload = JSON.parse(atob(access_token.split('.')[1]));
      setUser({ username: payload.sub, role: payload.role });

      return { success: true }; 
    } catch (error) {
      console.error("Échec de la connexion", error);
      // On retourne le message d'erreur spécifique (ex: compte pending)
      const msg = error.response?.data?.detail || "Erreur de connexion";
      return { success: false, message: msg }; 
    }
  };

  const register = async (username, password) => {
    try {
      await apiClient.post(`/api/auth/register`, {
        username,
        password,
      });
      return { success: true }; 
    } catch (error) {
      console.error("Échec de l'inscription", error);
      const msg = error.response?.data?.detail || "Erreur d'inscription";
      return { success: false, message: msg }; 
    }
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