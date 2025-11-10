# Fichier: server.py
from fastapi import FastAPI, APIRouter, HTTPException, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime, timezone
import random
import math
from bson import ObjectId # Pour gérer les _id de MongoDB si nécessaire

# --- Configuration initiale ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Connexion MongoDB ---
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME', 'fc26') # Utilise 'fc26' par défaut si non défini

if not mongo_url:
    logging.error("Erreur critique: La variable d'environnement MONGO_URL n'est pas définie.")
    # raise ValueError("MONGO_URL not set")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]
tournaments_collection = db["tournaments"] # Collection pour stocker les tournois

# --- FastAPI App et Router ---
app = FastAPI(title="Tournament API")
api_router = APIRouter(prefix="/api")

# --- Modèles Pydantic (Structures de données) ---

class PlayerStats(BaseModel):
    name: str
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goalsFor: int = 0
    goalsAgainst: int = 0
    goalDiff: int = 0
    points: int = 0
    groupPosition: Optional[int] = None

class GroupMatch(BaseModel):
    id: str = Field(default_factory=lambda: f"match_{uuid.uuid4()}")
    player1: str
    player2: str
    score1: Optional[int] = None
    score2: Optional[int] = None
    played: bool = False

class Group(BaseModel):
    name: str
    players: List[PlayerStats]
    matches: List[GroupMatch]

class KnockoutMatch(BaseModel):
    id: str = Field(default_factory=lambda: f"match_{uuid.uuid4()}")
    round: int
    matchIndex: int
    player1: Optional[str] = None
    player2: Optional[str] = None
    score1: Optional[int] = None
    score2: Optional[int] = None
    winner: Optional[str] = None
    played: bool = False

class Tournament(BaseModel):
    id: str = Field(default_factory=lambda: f"tournoi_{uuid.uuid4()}", alias="_id")
    name: str = "Tournoi EA FC"
    players: List[str]
    groups: List[Group] = []
    knockoutMatches: List[KnockoutMatch] = []
    qualifiedPlayers: List[str] = []
    winner: Optional[str] = None
    thirdPlace : Optional[str] = None
    currentStep: str = "config"
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()}
    )

# Modèles pour les requêtes entrantes
class TournamentCreateRequest(BaseModel):
    playerNames: List[str]
    tournamentName: Optional[str] = "Tournoi EA FC"
    numGroups: Optional[int] = None # <-- AJOUTÉ

    @field_validator('playerNames')
    def check_player_count(cls, v):
        if len(v) < 4:
            raise ValueError("Minimum 4 joueurs requis")
        return v

class ScoreUpdateRequest(BaseModel):
    score1: int
    score2: int

    @field_validator('score1', 'score2')
    def check_non_negative(cls, v):
        if v < 0:
            raise ValueError("Les scores ne peuvent pas être négatifs")
        return v

# --- Fonctions Utilitaires (Logique du Tournoi) ---

# FONCTION MODIFIÉE pour accepter num_groups
def create_groups_logic(players: List[str], num_groups: Optional[int] = None) -> List[Group]:
    totalPlayers = len(players)
    
    if num_groups is None or num_groups <= 1:
        # Logique par défaut si l'admin ne choisit pas (favorise poules de 4)
        num_groups = math.ceil(totalPlayers / 4)
        # Ajustement pour 10 joueurs -> 2 poules de 5
        if totalPlayers > 8 and totalPlayers % 4 in [1, 2]:
             num_groups = math.floor(totalPlayers / 4) 
        
        logging.info(f"Calcul auto: {totalPlayers} joueurs -> {num_groups} poules (par défaut)")
    else:
        logging.info(f"Calcul manuel: {totalPlayers} joueurs -> {num_groups} poules (choix admin)")

    # Nouvelle logique de répartition (pour 41 joueurs / 8 poules -> [6, 5, 5, 5, 5, 5, 5, 5])
    shuffled = random.sample(players, totalPlayers)
    
    base_size = totalPlayers // num_groups # Taille de base (41 // 8 = 5)
    remainder = totalPlayers % num_groups # Nbre de poules qui auront +1 joueur (41 % 8 = 1)
    
    groupSizes = []
    for i in range(num_groups):
        if i < remainder:
            groupSizes.append(base_size + 1) # 1 poule aura 6 joueurs
        else:
            groupSizes.append(base_size)     # 7 poules auront 5 joueurs
            
    logging.info(f"Distribution calculée des poules: {groupSizes}")

    groups = []
    playerIndex = 0
    for i, size in enumerate(groupSizes):
        group_player_names = shuffled[playerIndex : playerIndex + size]
        playerIndex += size
        group_players_stats = [PlayerStats(name=name) for name in group_player_names]

        matches = []
        for j in range(len(group_player_names)):
            for k in range(j + 1, len(group_player_names)):
                matches.append(GroupMatch(player1=group_player_names[j], player2=group_player_names[k]))

        groups.append(Group(
            name=chr(65 + i), # Poule A, B, C...
            players=group_players_stats,
            matches=matches
        ))
    return groups

def update_group_standings_logic(group: Group) -> List[PlayerStats]:
    # (Fonction inchangée)
    for p_stat in group.players:
        p_stat.played = 0
        p_stat.won = 0
        p_stat.drawn = 0
        p_stat.lost = 0
        p_stat.goalsFor = 0
        p_stat.goalsAgainst = 0
        p_stat.goalDiff = 0
        p_stat.points = 0
    for match in group.matches:
        if match.played:
            p1_stat = next((p for p in group.players if p.name == match.player1), None)
            p2_stat = next((p for p in group.players if p.name == match.player2), None)
            if not p1_stat or not p2_stat: continue
            p1_stat.played += 1
            p2_stat.played += 1
            p1_stat.goalsFor += match.score1
            p1_stat.goalsAgainst += match.score2
            p2_stat.goalsFor += match.score2
            p2_stat.goalsAgainst += match.score1
            if match.score1 > match.score2:
                p1_stat.won += 1
                p1_stat.points += 3
                p2_stat.lost += 1
            elif match.score1 < match.score2:
                p2_stat.won += 1
                p2_stat.points += 3
                p1_stat.lost += 1
            else:
                p1_stat.drawn += 1
                p1_stat.points += 1
                p2_stat.drawn += 1
                p2_stat.points += 1
    for p_stat in group.players:
        p_stat.goalDiff = p_stat.goalsFor - p_stat.goalsAgainst
    sorted_players = sorted(
        group.players,
        key=lambda p: (p.points, p.goalDiff, p.goalsFor),
        reverse=True
    )
    for i, player in enumerate(sorted_players):
        player.groupPosition = i + 1
    return sorted_players


# LOGIQUE DE QUALIFICATION UNIVERSELLE (corrigée)
def determine_qualifiers_logic(groups: List[Group], total_players: int) -> List[str]:
    """
    Logique de qualification universelle et juste pour déterminer les qualifiés.
    """
    
    # 1. Déterminer la cible de qualifiés
    if total_players <= 8: 
         targetQualified = 4
    elif total_players <= 16: 
         targetQualified = 8
    else: 
         targetQualified = 16 if total_players >= 24 else 8 
    
    num_groups = len(groups)
    
    # 2. Calculer combien de joueurs prendre "automatiquement" par poule
    base_qualifiers_per_group = math.floor(targetQualified / num_groups) 
    
    qualified = []
    best_finishers_pool = [] # Pool pour les "meilleurs suivants"

    logging.info(f"Qualification: {total_players} joueurs, {num_groups} poules. Cible: {targetQualified} qualifiés.")
    logging.info(f"Mode de qualification: Top {base_qualifiers_per_group} + meilleurs suivants.")

    for group in groups:
        # S'assurer que les stats sont à jour et triées
        sorted_players_in_group = update_group_standings_logic(group)
        group.players = sorted_players_in_group 

        # 3. Prendre les 'base' qualifiés
        for i, player in enumerate(sorted_players_in_group):
            if i < base_qualifiers_per_group:
                qualified.append(player.name)
            else:
                # Ajouter tous les autres au pool des "meilleurs suivants"
                best_finishers_pool.append(player) 
                
    # 4. Calculer le nombre de places restantes
    needed = targetQualified - len(qualified)

    if needed > 0 and best_finishers_pool:
        # 5. Trier le pool des "meilleurs suivants"
        best_finishers_pool.sort(key=lambda p: (p.points, p.goalDiff, p.goalsFor), reverse=True)
        
        # 6. Ajouter les 'needed' meilleurs
        qualified.extend(p.name for p in best_finishers_pool[:needed])

    # 7. S'assurer qu'on ne dépasse pas (sécurité)
    logging.info(f"Total qualifiés générés: {len(qualified)}")
    return qualified[:targetQualified]


def generate_knockout_matches_logic(qualified_player_names: List[str]) -> List[KnockoutMatch]:
    # (Fonction inchangée)
    num_players = len(qualified_player_names)
    if num_players not in [4, 8, 16]:
        logging.warning(f"Nombre de qualifiés inattendu: {num_players}. Le tableau pourrait être déséquilibré.")
    shuffled = random.sample(qualified_player_names, num_players)
    try:
        total_rounds = math.ceil(math.log2(num_players))
    except ValueError: # Cas où num_players = 0
        total_rounds = 0
        
    matches = []
    if num_players == 0:
        return []

    first_round_matches = num_players // 2
    round_index = 0 
    for i in range(first_round_matches):
        matches.append(KnockoutMatch(
            id=f"match_{uuid.uuid4()}",
            round=round_index,
            matchIndex=i,
            player1=shuffled[i*2],
            player2=shuffled[i*2+1],
        ))
    matches_in_round = first_round_matches // 2
    while matches_in_round >= 1:
        round_index += 1
        for i in range(matches_in_round):
             matches.append(KnockoutMatch(
                id=f"match_{uuid.uuid4()}",
                round=round_index,
                matchIndex=i,
            ))
        matches_in_round //= 2
    if num_players >= 4:
        final_round_index = total_rounds - 1
        matches.append(KnockoutMatch(
            id=f"match_third_place_{uuid.uuid4()}",
            round=final_round_index,
            matchIndex=1, # Index 1 (Finale sera 0)
            player1=None,
            player2=None,
        ))
    return matches

# --- Routes API ---

@api_router.post("/tournament", response_model=Tournament, status_code=201)
async def create_tournament(request: TournamentCreateRequest): # Accepte le nouveau request
    """
    Crée un nouveau tournoi avec la liste des joueurs et le nombre de poules souhaité.
    Génère les groupes immédiatement.
    """
    player_names = request.playerNames
    if len(set(player_names)) != len(player_names):
        raise HTTPException(status_code=400, detail="Les noms des joueurs doivent être uniques")

    # --- MODIFIÉ ---
    # Passe le numGroups (qui peut être None) à la logique de création
    generated_groups = create_groups_logic(player_names, request.numGroups)
    
    new_tournament = Tournament(
        name=request.tournamentName or f"Tournoi du {datetime.now(timezone.utc).strftime('%d/%m/%Y')}",
        players=player_names,
        currentStep="groups", # On passe directement à l'étape des groupes
        groups=generated_groups # Les groupes sont créés IMMÉDIATEMENT
    )
    # --- FIN MODIFICATION ---

    tournament_dict = new_tournament.model_dump(by_alias=True)
    tournament_dict["createdAt"] = new_tournament.createdAt
    tournament_dict["updatedAt"] = new_tournament.updatedAt

    inserted_result = await tournaments_collection.insert_one(tournament_dict)
    created_tournament = await tournaments_collection.find_one({"_id": inserted_result.inserted_id})

    if created_tournament and "_id" in created_tournament:
        created_tournament["id"] = str(created_tournament["_id"])

    return Tournament(**created_tournament)

# NOUVELLE ROUTE (placée AVANT /tournament/{tournament_id})
@api_router.get("/tournament/active", response_model=Tournament)
async def get_active_tournament():
    """ Récupère le dernier tournoi actif (le plus récent). """
    tournament = await tournaments_collection.find_one(
        {},
        sort=[("createdAt", -1)] # Trie par 'createdAt' descendant
    )
    if tournament:
        tournament["id"] = str(tournament["_id"])
        return Tournament(**tournament)
    raise HTTPException(status_code=404, detail="Aucun tournoi actif trouvé")
    
@api_router.get("/tournament/{tournament_id}", response_model=Tournament)
async def get_tournament(tournament_id: str):
    """ Récupère l'état complet d'un tournoi par son ID. """
    tournament = await tournaments_collection.find_one({"_id": tournament_id})
    if tournament:
        tournament["id"] = str(tournament["_id"])
        return Tournament(**tournament)
    raise HTTPException(status_code=404, detail=f"Tournoi '{tournament_id}' non trouvé")


# ROUTE OBSOLÈTE (mais gardée pour compatibilité)
@api_router.post("/tournament/{tournament_id}/draw_groups", response_model=Tournament)
async def draw_groups(tournament_id: str):
    """ (OBSOLÈTE) Renvoie simplement le tournoi car les groupes sont déjà créés. """
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament_data["id"] = str(tournament_data["_id"])
    return Tournament(**tournament_data)


@api_router.post("/tournament/{tournament_id}/match/{match_id}/score", response_model=Tournament)
async def update_match_score(tournament_id: str, match_id: str, scores: ScoreUpdateRequest):
    # (Fonction inchangée)
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = tournament_data
    match_found = False
    
    # Chercher dans les groupes
    if tournament.get("groups"):
        for group in tournament["groups"]:
            if group.get("matches"):
                for match in group["matches"]:
                    if match.get("id") == match_id:
                        if match.get("played") and match.get("score1") == scores.score1 and match.get("score2") == scores.score2:
                            tournament["id"] = str(tournament["_id"])
                            return Tournament(**tournament)
                        match["score1"] = scores.score1
                        match["score2"] = scores.score2
                        match["played"] = True
                        match_found = True
                        updated_standings = update_group_standings_logic(Group(**group))
                        group["players"] = [p.model_dump() for p in updated_standings]
                        break
            if match_found: break

    # Chercher dans le knockout
    if not match_found and tournament.get("knockoutMatches"):
        for match in tournament["knockoutMatches"]:
             if match.get("id") == match_id:
                if match.get("played") and match.get("score1") == scores.score1 and match.get("score2") == scores.score2:
                     tournament["id"] = str(tournament["_id"])
                     return Tournament(**tournament)
                
                match["score1"] = scores.score1
                match["score2"] = scores.score2
                match["played"] = True
                
                winner = None
                loser = None
                if scores.score1 > scores.score2:
                    winner = match["player1"]
                    loser = match["player2"]
                elif scores.score2 > scores.score1:
                    winner = match["player2"]
                    loser = match["player1"]
                else:
                    # Gestion du nul
                    qualified_players_list = tournament.get("qualifiedPlayers", [])
                    if not isinstance(qualified_players_list, list): qualified_players_list = []
                    num_qualified = len(qualified_players_list)
                    total_rounds = 0
                    if num_qualified > 0: total_rounds = math.ceil(math.log2(num_qualified))
                    if total_rounds == 0:
                         all_rounds = [m["round"] for m in tournament["knockoutMatches"] if not m["id"].startswith("match_third_place_")]
                         if all_rounds: total_rounds = max(all_rounds) + 1
                    final_round_index = total_rounds - 1
                    is_final_or_third = match["id"].startswith("match_third_place_") or (match["round"] == final_round_index and final_round_index >= 0)

                    if is_final_or_third:
                         raise HTTPException(status_code=400, detail="Match nul interdit en phase finale (Finale / 3ème place)")
                    else:
                         raise HTTPException(status_code=400, detail="Match nul interdit en phase finale")

                match["winner"] = winner
                match_found = True

                # Logique d'avancement
                current_round = match["round"]
                current_match_index = match["matchIndex"]
                qualified_players_list = tournament.get("qualifiedPlayers", [])
                if not isinstance(qualified_players_list, list): qualified_players_list = []
                num_qualified = len(qualified_players_list)
                total_rounds = 0
                if num_qualified > 0:
                     total_rounds = math.ceil(math.log2(num_qualified))
                if total_rounds == 0:
                     all_rounds = [m["round"] for m in tournament["knockoutMatches"] if not m["id"].startswith("match_third_place_")]
                     if all_rounds:
                         total_rounds = max(all_rounds) + 1 
                
                if total_rounds > 0 : # S'assurer qu'on a des rounds
                    semi_final_round_index = total_rounds - 2 
                    final_round_index = total_rounds - 1    
                else:
                    semi_final_round_index = -1
                    final_round_index = -1


                # 1. Petite finale
                if match["id"].startswith("match_third_place_"):
                    tournament["thirdPlace"] = winner
                # 2. Demi-finale
                elif current_round == semi_final_round_index and num_qualified >= 4:
                    petite_finale_match = next((m for m in tournament["knockoutMatches"] if m["id"].startswith("match_third_place_")), None)
                    if petite_finale_match:
                        if petite_finale_match.get("player1") is None:
                            petite_finale_match["player1"] = loser
                        elif petite_finale_match.get("player2") is None:
                            petite_finale_match["player2"] = loser
                    
                    next_round_index = current_round + 1 
                    next_match_index = current_match_index // 2
                    finale_match = next((m for m in tournament["knockoutMatches"]
                                           if m["round"] == next_round_index and m["matchIndex"] == next_match_index), None)
                    if finale_match:
                        if current_match_index % 2 == 0:
                            finale_match["player1"] = winner
                        else:
                            finale_match["player2"] = winner
                # 3. Finale
                elif current_round == final_round_index and final_round_index != -1:
                    tournament["winner"] = winner
                    tournament["currentStep"] = "finished"
                # 4. Autres matchs
                elif final_round_index != -1 : # S'assurer qu'on n'est pas hors limites
                    next_round_index = current_round + 1
                    next_match_index = current_match_index // 2
                    next_match = next((m for m in tournament["knockoutMatches"]
                                       if m["round"] == next_round_index and m["matchIndex"] == next_match_index), None)
                    if next_match:
                        if current_match_index % 2 == 0:
                            next_match["player1"] = winner
                        else:
                            next_match["player2"] = winner
                break

    if not match_found:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' non trouvé dans ce tournoi")

    tournament["updatedAt"] = datetime.now(timezone.utc)
    await tournaments_collection.update_one({"_id": tournament_id}, {"$set": tournament})
    updated_tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    updated_tournament_data["id"] = str(updated_tournament_data["_id"])
    return Tournament(**updated_tournament_data)


@api_router.post("/tournament/{tournament_id}/complete_groups", response_model=Tournament)
async def complete_groups_and_draw_knockout(tournament_id: str):
    # (Fonction inchangée)
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = Tournament(**tournament_data)
    all_played = all(m.played for g in tournament.groups for m in g.matches)
    if not all_played:
        raise HTTPException(status_code=400, detail="Tous les matchs de poule ne sont pas encore joués")
    if tournament.currentStep != "groups":
         raise HTTPException(status_code=400, detail="Action invalide pour l'étape actuelle du tournoi")

    qualified_names = determine_qualifiers_logic(tournament.groups, len(tournament.players))
    tournament.qualifiedPlayers = qualified_names
    tournament.currentStep = "qualified"
    knockout_matches = generate_knockout_matches_logic(qualified_names)
    tournament.knockoutMatches = knockout_matches
    tournament.currentStep = "knockout"
    tournament.updatedAt = datetime.now(timezone.utc)
    update_data = {
        "$set": {
            "groups": [g.model_dump() for g in tournament.groups],
            "qualifiedPlayers": tournament.qualifiedPlayers,
            "knockoutMatches": [m.model_dump() for m in tournament.knockoutMatches],
            "currentStep": tournament.currentStep,
            "updatedAt": tournament.updatedAt
        }
    }
    await tournaments_collection.update_one({"_id": tournament_id}, update_data)
    updated_tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    updated_tournament_data["id"] = str(updated_tournament_data["_id"])
    return Tournament(**updated_tournament_data)


@api_router.post("/tournament/{tournament_id}/redraw_knockout", response_model=Tournament)
async def redraw_knockout_bracket(tournament_id: str):
    # (Fonction inchangée)
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = Tournament(**tournament_data)
    if tournament.currentStep not in ["knockout", "finished"]:
         raise HTTPException(status_code=400, detail="Le tableau final n'a pas encore été généré.")
    if not tournament.qualifiedPlayers:
         raise HTTPException(status_code=400, detail="Aucun joueur qualifié trouvé à mélanger.")
    if any(m.played for m in tournament.knockoutMatches):
        raise HTTPException(status_code=400, detail="Impossible de relancer le tirage, des matchs finaux ont déjà été joués.")
    
    logging.info(f"Regénération du tableau pour le tournoi {tournament_id} avec {len(tournament.qualifiedPlayers)} qualifiés.")
    new_knockout_matches = generate_knockout_matches_logic(tournament.qualifiedPlayers)
    tournament.knockoutMatches = new_knockout_matches
    tournament.updatedAt = datetime.now(timezone.utc)
    update_data = {
        "$set": {
            "knockoutMatches": [m.model_dump() for m in new_knockout_matches],
            "updatedAt": tournament.updatedAt
        }
    }
    await tournaments_collection.update_one({"_id": tournament_id}, update_data)
    updated_tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    updated_tournament_data["id"] = str(updated_tournament_data["_id"])
    return Tournament(**updated_tournament_data)


# --- Routes Status (Inchangées) ---
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


# --- Inclusion du Router et Middleware CORS ---
app.include_router(api_router)

# !! BLOC CORS TRÈS IMPORTANT !!
origins = [
    "https://tournoi-fc26-1.onrender.com",  # L'URL exacte de VOTRE FRONTEND
    "http://localhost:3000",             # Pour vos tests en local
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# --- Logging et Shutdown ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db_client():
    try:
        await client.admin.command('ping')
        logger.info(f"Connecté à MongoDB - Base de données: {db_name}")
    except Exception as e:
        logger.error(f"Erreur de connexion à MongoDB: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    logger.info("Connexion MongoDB fermée.")

# --- Point d'entrée pour Uvicorn ---
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)