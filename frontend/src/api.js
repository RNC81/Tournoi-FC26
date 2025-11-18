// Fichier: frontend/src/api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000'; 

console.log("Using API Base URL:", API_BASE_URL); 

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, 
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login'; 
    }
    return Promise.reject(error);
  }
);

// --- Fonctions d'API ---

// --- NOUVELLE FONCTION ---
export const getPublicTournaments = async () => {
  try {
    const response = await apiClient.get('/api/tournaments/public');
    return response.data;
  } catch (error) {
    console.error("Error fetching public tournaments:", error.response?.data || error.message);
    throw error;
  }
};
// --- FIN NOUVELLE FONCTION ---

export const createTournament = async (playerNames, numGroups) => {
  try {
    const response = await apiClient.post('/api/tournament', { playerNames, numGroups });
    return response.data;
  } catch (error) {
    console.error("Error creating tournament:", error.response?.data || error.message);
    throw error; 
  }
};

export const getMyTournaments = async () => {
  try {
    const response = await apiClient.get('/api/tournaments/my-tournaments');
    return response.data;
  } catch (error) {
    console.error("Error fetching my tournaments:", error.response?.data || error.message);
    throw error;
  }
};

export const getTournament = async (tournamentId) => {
  try {
    // --- CORRECTION ---
    // On ne gère plus 'active', car la route a été supprimée.
    // Si on reçoit 'active' par erreur, on renvoie null ou on loggue une erreur.
    if (tournamentId === 'active') {
        console.warn("getTournament called with 'active', which is deprecated.");
        return null;
    }
      
    const response = await apiClient.get(`/api/tournament/${tournamentId}`);
    console.log("Tournament data received:", response.data);
    return response.data;
  } catch (error) {
     if (error.response?.status === 404) {
       console.warn(`Tournament ${tournamentId} not found.`);
       return null; 
     }
    console.error("Error fetching tournament:", error.response?.data || error.message);
    throw error;
  }
};

export const updateScore = async (tournamentId, matchId, score1, score2) => {
  try {
    const response = await apiClient.post(`/api/tournament/${tournamentId}/match/${matchId}/score`, { score1, score2 });
    return response.data;
  } catch (error) {
    console.error(`Error updating score for match ${matchId}:`, error.response?.data || error.message);
    throw error;
  }
};

export const completeGroupStage = async (tournamentId) => {
  try {
    const response = await apiClient.post(`/api/tournament/${tournamentId}/complete_groups`);
    return response.data;
  } catch (error) {
    console.error("Error completing group stage:", error.response?.data || error.message);
    throw error;
  }
};

export const redrawKnockout = async (tournamentId) => {
  try {
    const response = await apiClient.post(`/api/tournament/${tournamentId}/redraw_knockout`);
    return response.data;
  } catch (error) {
    console.error("Error redrawing knockout:", error.response?.data || error.message);
    throw error;
  }
};

// drawGroups est obsolète
export const drawGroups = async (tournamentId) => {
  try {
    const response = await apiClient.post(`/api/tournament/${tournamentId}/draw_groups`);
    return response.data;
  } catch (error) {
    console.error("Error drawing groups:", error.response?.data || error.message);
    throw error;
  }
};

export default apiClient;