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

// --- NOUVEAU : Intercepteur ---
// Gère les erreurs 401 (Token expiré / Non autorisé)
apiClient.interceptors.response.use(
  (response) => response, // Renvoie la réponse si tout va bien
  (error) => {
    if (error.response && error.response.status === 401) {
      // Si 401, le token est invalide
      // On force la déconnexion en supprimant le token du localStorage
      localStorage.removeItem('authToken');
      // On recharge la page pour forcer le retour à l'écran de login
      window.location.href = '/login'; 
    }
    return Promise.reject(error);
  }
);
// --- FIN NOUVEAU ---


// ... (Toutes vos fonctions 'createTournament', 'getTournament', etc., restent INCHANGÉES) ...

export const createTournament = async (playerNames, numGroups) => {
  try {
    const response = await apiClient.post('/api/tournament', { playerNames, numGroups });
    return response.data;
  } catch (error) {
    console.error("Error creating tournament:", error.response?.data || error.message);
    throw error; 
  }
};

export const getTournament = async (tournamentId) => {
  try {
    const url = tournamentId === 'active'
      ? '/api/tournament/active'
      : `/api/tournament/${tournamentId}`;
    console.log(`Fetching tournament with ID/Alias: ${tournamentId} (URL: ${url})`);
    const response = await apiClient.get(url);
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

// --- NOUVELLE FONCTION ---
/**
 * Récupère tous les tournois de l'utilisateur connecté.
 * @returns {Promise<Array<object>>} Une liste de tournois.
 */
export const getMyTournaments = async () => {
  try {
    const response = await apiClient.get('/api/tournaments/my-tournaments');
    return response.data;
  } catch (error) {
    console.error("Error fetching my tournaments:", error.response?.data || error.message);
    throw error;
  }
};
// --- FIN NOUVELLE FONCTION ---

export const drawGroups = async (tournamentId) => {
  try {
    const response = await apiClient.post(`/api/tournament/${tournamentId}/draw_groups`);
    return response.data;
  } catch (error) {
    console.error("Error drawing groups:", error.response?.data || error.message);
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

export default apiClient;