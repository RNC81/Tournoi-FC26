// Fichier: frontend/src/api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000'; 

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

export const getPublicTournaments = async () => {
  try {
    const response = await apiClient.get('/api/tournaments/public');
    return response.data;
  } catch (error) {
    console.error("Error fetching public tournaments:", error.response?.data || error.message);
    throw error;
  }
};

// --- MODIFICATION : Ajout de 'format' ---
export const createTournament = async (playerNames, numGroups, tournamentName, format) => {
  try {
    const response = await apiClient.post('/api/tournament', { 
        playerNames, 
        numGroups,
        tournamentName,
        format // <-- NOUVEAU
    });
    return response.data;
  } catch (error) {
    console.error("Error creating tournament:", error.response?.data || error.message);
    throw error; 
  }
};

// ... (Autres fonctions inchangées : delete, getMyTournaments, getTournament...) ...

export const deleteTournament = async (tournamentId) => {
    try {
        await apiClient.delete(`/api/tournament/${tournamentId}`);
        return true;
    } catch (error) {
        console.error("Error deleting tournament:", error.response?.data || error.message);
        throw error;
    }
}

export const getMyTournaments = async () => {
  try {
    const response = await apiClient.get('/api/tournaments/my-tournaments');
    return response.data;
  } catch (error) {
    console.error("Error fetching my tournaments:", error.response?.data || error.message);
    throw error;
  }
};

export const generateNextRound = async (tournamentId) => {
  try {
    const response = await apiClient.post(`/api/tournament/${tournamentId}/generate_next_round`);
    return response.data;
  } catch (error) {
    console.error("Error generating next round:", error.response?.data || error.message);
    throw error;
  }
};

export const getTournament = async (tournamentId) => {
  try {
    if (tournamentId === 'active') {
        return null;
    }
    const response = await apiClient.get(`/api/tournament/${tournamentId}`);
    return response.data;
  } catch (error) {
     if (error.response?.status === 404) {
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