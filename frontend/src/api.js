import axios from 'axios';

// Récupère l'URL de base de l'API depuis les variables d'environnement
// VITE_API_URL est défini dans les paramètres de Render pour votre Static Site
// La seule version correcte pour votre projet Create React App
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000'; // Fallback pour dev local si nécessaire

console.log("Using API Base URL:", API_BASE_URL); // Pour vérifier que l'URL est correcte

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // avecCredentials: true // Si vous ajoutez une authentification plus tard
});

// --- Fonctions d'API ---

/**
 * Crée un nouveau tournoi.
 * @param {string[]} playerNames - Liste des noms des joueurs.
 * @returns {Promise<object>} Les données du tournoi créé.
 */
export const createTournament = async (playerNames) => {
  try {
    const response = await apiClient.post('/api/tournament', { playerNames });
    return response.data;
  } catch (error) {
    console.error("Error creating tournament:", error.response?.data || error.message);
    throw error; // Relance l'erreur pour que le composant puisse la gérer
  }
};

/**
 * Récupère les données d'un tournoi existant.
 * @param {string} tournamentId - L'ID du tournoi.
 * @returns {Promise<object>} Les données du tournoi.
 */
export const getTournament = async (tournamentId) => {
  try {
    const url = tournamentId === 'active'
      ? '/api/tournament/active'
      : `/api/tournament/${tournamentId}`;
    console.log(`Fetching tournament with ID: ${tournamentId}`);
    const response = await apiClient.get(`/api/tournament/${tournamentId}`);
    console.log("Tournament data received:", response.data);
    return response.data;
  } catch (error) {
     if (error.response?.status === 404) {
       console.warn(`Tournament ${tournamentId} not found.`);
       return null; // Retourne null si 404, géré par TournamentManager
     }
    console.error("Error fetching tournament:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Lance le tirage au sort des groupes pour un tournoi.
 * @param {string} tournamentId - L'ID du tournoi.
 * @returns {Promise<object>} Les données du tournoi mises à jour avec les groupes.
 */
export const drawGroups = async (tournamentId) => {
  try {
    const response = await apiClient.post(`/api/tournament/${tournamentId}/draw_groups`);
    return response.data;
  } catch (error) {
    console.error("Error drawing groups:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Met à jour le score d'un match (poule ou knockout).
 * @param {string} tournamentId - L'ID du tournoi.
 * @param {string} matchId - L'ID du match.
 * @param {number} score1 - Score du joueur 1.
 * @param {number} score2 - Score du joueur 2.
 * @returns {Promise<object>} Les données du tournoi mises à jour.
 */
export const updateScore = async (tournamentId, matchId, score1, score2) => {
  try {
    const response = await apiClient.post(`/api/tournament/${tournamentId}/match/${matchId}/score`, { score1, score2 });
    return response.data;
  } catch (error) {
    console.error(`Error updating score for match ${matchId}:`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Finalise la phase de groupes et génère le tableau knockout.
 * @param {string} tournamentId - L'ID du tournoi.
 * @returns {Promise<object>} Les données du tournoi mises à jour.
 */
export const completeGroupStage = async (tournamentId) => {
  try {
    const response = await apiClient.post(`/api/tournament/${tournamentId}/complete_groups`);
    return response.data;
  } catch (error) {
    console.error("Error completing group stage:", error.response?.data || error.message);
    throw error;
  }
};

export default apiClient;
