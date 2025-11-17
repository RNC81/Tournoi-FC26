import axios from 'axios';

// Récupère l'URL de base de l'API depuis les variables d'environnement
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000'; 

console.log("Using API Base URL:", API_BASE_URL); 

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Ajout du timeout pour les "cold starts" de Render
  timeout: 30000, // 30 000 ms = 30 secondes
});

// --- Fonctions d'API ---

/**
 * Crée un nouveau tournoi.
 * @param {string[]} playerNames - Liste des noms des joueurs.
 * @param {number|null} numGroups - Nombre de poules souhaité (ou null).
 * @returns {Promise<object>} Les données du tournoi créé.
 */
export const createTournament = async (playerNames, numGroups) => {
  try {
    // AJOUT de numGroups à la requête
    const response = await apiClient.post('/api/tournament', { playerNames, numGroups });
    return response.data;
  } catch (error) {
    console.error("Error creating tournament:", error.response?.data || error.message);
    throw error; 
  }
};

/**
 * Récupère les données d'un tournoi (par ID ou le 'active').
 * @param {string} tournamentId - L'ID du tournoi ou "active".
 * @returns {Promise<object>} Les données du tournoi.
 */
export const getTournament = async (tournamentId) => {
  try {
    // CORRECTION : Utilise la variable 'url'
    const url = tournamentId === 'active'
      ? '/api/tournament/active'
      : `/api/tournament/${tournamentId}`;
      
    console.log(`Fetching tournament with ID/Alias: ${tournamentId} (URL: ${url})`);
    const response = await apiClient.get(url); // <-- CORRIGÉ: Utilise la variable 'url'
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
 * (Obsolète) Tente de tirer les groupes. Le backend renverra juste l'état.
 * @param {string} tournamentId - L'ID du tournoi.
 * @returns {Promise<object>} Les données du tournoi mises à jour.
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

/**
 * Regénère le tableau knockout en re-mélangeant les qualifiés.
 * @param {string} tournamentId - L'ID du tournoi.
 * @returns {Promise<object>} Les données du tournoi mises à jour.
 */
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