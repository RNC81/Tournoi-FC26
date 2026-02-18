# PROJECT MANIFEST - Tournoi FC26

> **Manifest technique du projet**  
> **Dernière mise à jour:** 2026-02-15  
> **Projet:** Tournoi FC26

## Chantier Actuel: Refonte Visuelle "Modern Dark" (EducationFirst Style)
- **Objectif**: Reproduction fidèle du design "EducationFirst" (Dark Mode + Lime Accents).
- **Sécurité (Audit)**:
    - [x] Validation Security_Auditor : Design sombre standard. Pas de composants lourds. L'usage de contrastes forts (Lime/Noir) est bon pour la lisibilité si bien dosé.
- **Style Guide (Reference)**:
    - **Palette**: Fond `#1F1F1F` (Dark Zinc), Cartes `#2A2A2A`, Accents `#BEF264` (Lime).
    - **Structure**: Sidebar latérale fixe, Topbar, Cartes très arrondies (`rounded-3xl`).
- **Plan Technique**:
    - [x] `index.css` : Reset complet pour le thème Dark/Lime.
    - [x] `DashboardLayout.jsx` : Création d'un layout persistant (Sidebar + Topbar).
    - [x] Composants : Harmonisation complète (`Manager`, `Steps`, `Pages`).

- **Objectif :** Interface "Bento Grid" + Glassmorphism.
- **Stack :** React + TailwindCSS + Framer Motion.
- **Modifications Prévues :**
  - `frontend/package.json` : Ajout `framer-motion`.
  - `frontend/src/pages/DashboardPage.jsx` : Transformation en CSS Grid responsive.
  - `frontend/src/index.css` : Ajout des classes utilitaires (gradients, glass-effect).
- **Impact Backend :** Aucun (Purement frontend).

---

---

## 🌍 Contexte & Infrastructure (Mémoire du Projet)

### Hébergement & Déploiement
- **Plateforme :** [Render](https://render.com)
- **URLs de Production :**
  - `https://tournoi-fc26-1.onrender.com`
  - `https://tournoi-fc26.onrender.com`
- **Méthode de déploiement :** GitHub -> Render (Automatique)
- **Note:** Le code actuel est une copie locale pour développement. Toute modification validée ici sera poussée sur GitHub pour mise à jour de la production.

### Environnement de Développement Local
- **OS :** Windows
- **Base de données :** MongoDB Community Server (Local `data/db`)
- **Backend :** FastAPI (Port 8000)
- **Frontend :** React (Port 3000)

---

## 🩺 État de Santé du Projet

### Services Runtime

- 🟢 **Backend FastAPI** → Port 8000 (Running)
- 🟢 **Frontend React** → Port 3000 (Running)
- 🟢 **MongoDB** → Connexion active (Port 27017)
- 🟢 **CORS** → Configuré (localhost + Render)
- 🟢 **Authentification JWT** → Opérationnelle (30min expiration)

### Sécurité

- 🟢 **Rate Limiting** → Actif (slowapi)
- 🟢 **Password Hashing** → Bcrypt configuré
- 🟢 **Anti-XSS** → Sanitization via bleach
- 🟢 **Security Headers** → X-Frame-Options, X-Content-Type-Options
- 🟡 **HSTS** → Désactivé (à activer en prod)
- 🔴 **Audit Logs** → Non implémentés

### Code Quality

- 🟢 **Validation Pydantic** → Stricte (regex, min/max)
- 🟢 **Error Handling** → HTTPException avec messages clairs
- � **Code Duplication** → 0 occurrence détectée
- � **Frontend/Backend Sync** → Routes synchronisées (`/draw_groups` supprimée)

**Légende:** 🟢 OK | 🟡 Attention | 🔴 Critique

---

## 🚨 Dette Technique & Bugs Connus

### � Bugs Critiques
*Aucun bug critique connu actuellement.*

### � Code Smell
*Aucun code smell majeur détecté.*

### 🟡 Améliorations Sécurité

#### Pas de Log d'Audit pour Super Admin
- **Impact:** Impossible de tracer qui supprime/approuve des utilisateurs
- **Recommandation:** Ajouter des logs structurés avec timestamps pour toutes les actions admin
- **Fichiers concernés:** Toutes les routes `/api/admin/*`

#### Rate Limit Basé IP Uniquement
- **Impact:** Un attaquant peut brute-force 10 mots de passe/min pour chaque compte distinct
- **Recommandation:** Ajouter un compteur par `username` en plus de l'IP

#### HSTS Désactivé
- **Fichier:** [server.py](file:///c:/Users/Rayaan/Documents/Antigravity/Tournoi-FC/Tournoi-FC26-main/backend/server.py#L77-L78)
- **Impact:** Connexions HTTP possibles en production (MITM)
- **Action:** Décommenter la ligne HSTS avant déploiement Render

### 🟢 Optimisations Performance (Non-Bloquantes)

#### Pagination Limitée
- **Route:** `GET /api/tournaments/public`
- **Limite actuelle:** 20 tournois
- **Problème:** Pas de pagination paramétrable
- **Impact:** Faible (acceptable pour MVP)

#### Index MongoDB Manquants
- **Collections:** `tournaments`, `users`
- **Champs à indexer:** `owner_username`, `createdAt`, `username`
- **Impact:** Queries lentes si +10k documents

---

## 📡 Configuration Réseau

### Ports Ouverts

- **8000** → FastAPI (Uvicorn)
- **3000** → React Dev Server (Vite)
- **Variable** → MongoDB (via MONGO_URL)

### CORS Policy

**Origines autorisées:**
- `https://tournoi-fc26-1.onrender.com`
- `https://tournoi-fc26.onrender.com`
- `http://localhost:3000`
- `http://127.0.0.1:3000`

**Politique:**
- Credentials autorisés (cookies, auth headers)
- Tous les verbes HTTP acceptés
- Headers personnalisés autorisés

---

## 🛣️ Routes API Backend

### Authentification `/api/auth`

**`POST /api/auth/register`**
- Rate Limit: 5 créations/min par IP
- Validation: Username regex `^[a-zA-Z0-9_.-]{3,30}$`, password min 8 char
- Logique: Premier user = `super_admin` auto-actif, suivants = `admin` (pending)

**`POST /api/auth/login`**
- Rate Limit: 10 tentatives/min par IP
- Retour: JWT token (30min expiration)
- Blocage: Comptes `pending`, `rejected`, `banned`

**`PUT /api/auth/profile`**
- Auth: JWT requis
- Permet: Changement username et/ou password
- Validation: Unicité du nouveau username

---

### Administration `/api/admin` (Super Admin uniquement)

**Gestion des Comptes:**
- `GET /api/admin/users/pending` → Liste comptes en attente
- `GET /api/admin/users` → Tous les utilisateurs
- `POST /api/admin/users/{username}/approve` → Activer un compte
- `POST /api/admin/users/{username}/reject` → Rejeter une demande
- `DELETE /api/admin/users/{username}` → Supprimer un user (sauf soi-même)

---

### Tournois `/api/tournament`

**Routes Publiques:**
- `GET /api/tournaments/public` → Top 20 tournois récents (aucune auth)
- `GET /api/tournament/{id}` → Détails d'un tournoi (aucune auth)

**Routes Authentifiées:**
- `POST /api/tournament` → Créer un tournoi (JWT requis)
  - Min 4 joueurs, max 64
  - Formats: `1v1` ou `2v2`
  - Validation: Sanitization XSS, unicité des noms
  - Si 2v2: nombre pair de joueurs obligatoire

- `GET /api/tournaments/my-tournaments` → Tournois de l'utilisateur connecté
- `DELETE /api/tournament/{id}` → Supprimer son tournoi (ou super_admin)

**Gestion des Matchs:**
- `POST /api/tournament/{id}/match/{match_id}/score`
  - Enregistrer un score (0-99 max, anti-troll)
  - Calcul auto des classements de poule
  - Propagation des vainqueurs en phase éliminatoire

- `POST /api/tournament/{id}/complete_groups`
  - Clôture phase de poule
  - Qualification automatique
  - Génération du tableau éliminatoire

- `POST /api/tournament/{id}/redraw_knockout`
  - Retirer les matchs éliminatoires (conserve les qualifiés)

- `POST /api/tournament/{id}/generate_next_round` (2v2 uniquement)
  - Remixe les équipes entre les tours
  - Évite les paires déjà jouées (max 100 tentatives)

**Utilitaires:**
- `GET /` → Health check root
- `GET /api/status` → Health check API
- `POST /api/test-security` → Test anti-injection NoSQL

---

## 🧠 Logique Métier Critique

### Création Automatique des Poules

**Fonction:** `create_groups_logic()` | [server.py:431-464](file:///c:/Users/Rayaan/Documents/Antigravity/Tournoi-FC/Tournoi-FC26-main/backend/server.py#L431-L464)

**Stratégie d'équilibrage:**
- Nombre de poules auto = `ceil(total_joueurs / 4)`
- Ajustement si reste = 1 ou 2 → `floor(total_joueurs / 4)` pour éviter poules à 1 joueur
- Distribution: Taille de base + 1 joueur pour les `n` premières poules (n = reste)
- Shuffle aléatoire avant répartition

**Exemple concret:**
- 13 joueurs → `ceil(13/4) = 4` poules... MAIS `13 % 4 = 1` → Ajustement à `3` poules
- Résultat: Poules de 5, 4, 4 joueurs

**Mode 2v2:**
- Groupement par paires avant création des poules
- Joueur impair = équipe solo

---

### Calcul Classement de Poule

**Fonction:** `update_group_standings_logic()` | [server.py:466-484](file:///c:/Users/Rayaan/Documents/Antigravity/Tournoi-FC/Tournoi-FC26-main/backend/server.py#L466-L484)

**Critères de tri (ordre décroissant):**
1. **Points** (Victoire = 3, Nul = 1, Défaite = 0)
2. **Différence de buts** (`goalsFor - goalsAgainst`)
3. **Buts marqués** (départage final si égalité parfaite)

Conforme aux règles UEFA/FIFA.

---

### Qualification Automatique

**Fonction:** `determine_qualifiers_logic()` | [server.py:486-513](file:///c:/Users/Rayaan/Documents/Antigravity/Tournoi-FC/Tournoi-FC26-main/backend/server.py#L486-L513)

**Nombre de qualifiés selon total d'entités:**
- ≤ 8 joueurs → 4 qualifiés (demi-finales)
- ≤ 16 joueurs → 8 qualifiés (quarts)
- ≥ 24 joueurs → 16 qualifiés
- Autres cas → 8 qualifiés

**Distribution:**
- Si divisible uniformément → Même nombre/poule (ex: 8 qualifiés, 4 poules = 2/poule)
- Sinon → Meilleurs 2e/3e repêchés selon:
  1. Points
  2. Différence de buts
  3. Buts marqués

---

### Génération Tableau Éliminatoire

**Fonction:** `generate_knockout_matches_logic()` | [server.py:515-535](file:///c:/Users/Rayaan/Documents/Antigravity/Tournoi-FC/Tournoi-FC26-main/backend/server.py#L515-L535)

**Mode 1v1:**
- Arbre complet jusqu'à la finale
- Petite finale automatique si ≥ 4 joueurs qualifiés
- Shuffle des qualifiés pour éviter recroiser adversaires de poule

**Mode 2v2:**
- Un seul tour initial (`single_round=True`)
- Tours suivants générés via `generate_next_round` avec remix des équipes

---

### Remix Équipes 2v2 (Anti-Redondance)

**Fonction:** `complete_groups_and_draw_knockout()` | [server.py:571-623](file:///c:/Users/Rayaan/Documents/Antigravity/Tournoi-FC/Tournoi-FC26-main/backend/server.py#L571-L623)

**Algorithme:**
1. Enregistrer toutes les paires précédentes (poule + éliminatoires)
2. Shuffle du pool de joueurs individuels
3. Vérifier si nouvelles paires ∉ paires précédentes
4. Max 100 tentatives
5. Si échec → Accepter collision

**Pourquoi?** Éviter que les mêmes joueurs rejouent ensemble, sauf si combinaisons épuisées.

---

### Propagation des Vainqueurs

**Fonction:** `update_match_score()` | [server.py:694-768](file:///c:/Users/Rayaan/Documents/Antigravity/Tournoi-FC/Tournoi-FC26-main/backend/server.py#L694-L768)

**Mode 1v1:**
- Vainqueur monte au round suivant, position `matchIndex // 2`
- Perdants des demi-finales → Petite finale
- Finale jouée → `currentStep = "finished"` + `winner` défini

**Mode 2v2:**
- Pas de propagation auto (car remix)
- Détection fin: Dernier round avec 1 seul match joué → `winner` défini

---

## 🔐 Middleware de Sécurité

### Headers HTTP

**Middleware:** `SecurityHeadersMiddleware` | [server.py:70-83](file:///c:/Users/Rayaan/Documents/Antigravity/Tournoi-FC/Tournoi-FC26-main/backend/server.py#L70-L83)

- `X-Frame-Options: DENY` → Anti-Clickjacking
- `X-Content-Type-Options: nosniff` → Anti-MIME Sniffing
- `X-XSS-Protection: 1; mode=block` → Protection navigateur
- ~~`Strict-Transport-Security`~~ → Désactivé (pas de HTTPS local)

---

### Rate Limiting

**Lib:** `slowapi` (basé IP)

- **Login:** 10 tentatives/minute
- **Register:** 5 créations/minute

**Limitation:** Pas de compteur par username (voir Dette Technique).

---

### Sanitization Anti-XSS

**Fonction:** `sanitize_text()` | [server.py:86-89](file:///c:/Users/Rayaan/Documents/Antigravity/Tournoi-FC/Tournoi-FC26-main/backend/server.py#L86-L89)

Appliqué sur:
- Noms de joueurs
- Nom du tournoi

**Méthode:** `bleach.clean()` supprime toutes balises HTML et caractères spéciaux.

---

## 📊 Variables d'Environnement

### Backend (`backend/.env`)

**Obligatoires (serveur refuse de démarrer):**
- `SECRET_KEY` → Clé JWT (fail-fast si absente)
- `MONGO_URL` → URL connexion MongoDB

**Optionnelles:**
- `DB_NAME` → Nom de la base (défaut: `fc26`)
- `PORT` → Port Uvicorn (défaut: `8000`)

### Frontend (`frontend/.env`)

**Optionnelles:**
- `REACT_APP_API_URL` → URL du backend (défaut: `http://127.0.0.1:8000`)

---

## 🔄 Migration MongoDB Auto

**Événement:** Startup FastAPI | [server.py:839-855](file:///c:/Users/Rayaan/Documents/Antigravity/Tournoi-FC/Tournoi-FC26-main/backend/server.py#L839-L855)

**Logique:**
1. Ping MongoDB pour vérifier connexion
2. Si users existent sans champ `status` → Ajout auto (`status: "active"`, `role: "admin"`)
3. Si aucun `super_admin` → Promouvoir le plus ancien utilisateur

**Raison:** Rétrocompatibilité avec anciennes bases sans système de rôles.

---

## ✅ Checklist Avant Déploiement Prod

- [ ] Activer HSTS dans `SecurityHeadersMiddleware`
- [ ] Créer index MongoDB sur `username`, `owner_username`, `createdAt`
- [ ] Implémenter logs d'audit pour actions super_admin
- [ ] Vérifier `MONGO_URL` et `SECRET_KEY` dans env Render
- [ ] Tester CORS avec URL Render en production
- [x] Supprimer route `/draw_groups` du frontend (ou implémenter backend)
- [x] Fix duplication `SECRET_KEY` ligne 32-33

---

**Maintenu par:** Scribe_Technique  
**Format:** Compatible Obsidian Markdown
