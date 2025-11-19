# Fichier: backend/server.py
from fastapi import FastAPI, APIRouter, HTTPException, Body, Depends
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime, timezone, timedelta
import random
import math
from bson import ObjectId

# --- Imports pour l'authentification ---
from passlib.context import CryptContext
from jose import JWTError, jwt

# --- Configuration initiale ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Constantes d'authentification ---
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    logging.warning("SECRET_KEY non définie, utilisation d'une clé par défaut")
    SECRET_KEY = "votre_mot_de_passe_secret_12345_par_defaut"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 

# --- Configuration Passlib ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# --- Connexion MongoDB ---
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME', 'fc26')

if not mongo_url:
    logging.error("Erreur critique: La variable d'environnement MONGO_URL n'est pas définie.")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]
tournaments_collection = db["tournaments"]
users_collection = db["users"]

# --- FastAPI App et Routers ---
app = FastAPI(title="Tournament API")
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api/auth")

# --- Modèles Pydantic ---

class PlayerStats(BaseModel):
    name: str
    real_players: Optional[List[str]] = None
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
    format: str = "1v1"
    players: List[str]
    groups: List[Group] = []
    knockoutMatches: List[KnockoutMatch] = []
    qualifiedPlayers: List[str] = []
    winner: Optional[str] = None
    thirdPlace : Optional[str] = None
    currentStep: str = "config"
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    owner_username: Optional[str] = "Ancien Admin"

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()}
    )

class TournamentCreateRequest(BaseModel):
    playerNames: List[str]
    tournamentName: Optional[str] = "Tournoi EA FC"
    numGroups: Optional[int] = None
    format: Optional[str] = "1v1"

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

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserLogin(UserBase):
    password: str

class UserInDB(UserBase):
    id: str = Field(alias="_id")
    hashed_password: str
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- Fonctions de Sécurité ---

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_user_from_db(username: str):
    user = await users_collection.find_one({"username": username})
    if user:
        user["_id"] = str(user["_id"])
        return UserInDB(**user)
    return None

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    user = await get_user_from_db(token_data.username)
    if user is None:
        raise credentials_exception
    return user

# --- Routes d'Authentification ---

@auth_router.post("/register", response_model=UserBase, status_code=201)
async def register_user(user_in: UserCreate):
    existing_user = await users_collection.find_one({"username": user_in.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà pris")
    
    if len(user_in.password) < 4:
         raise HTTPException(status_code=400, detail="Le mot de passe doit faire au moins 4 caractères")
         
    hashed_password = get_password_hash(user_in.password)
    user_doc = {"username": user_in.username, "hashed_password": hashed_password}
    
    new_user = await users_collection.insert_one(user_doc)
    created_user = await users_collection.find_one({"_id": new_user.inserted_id})
    
    return UserBase(**created_user)

@auth_router.post("/login", response_model=Token)
async def login_for_access_token(user_in: UserLogin):
    logging.info(f"Tentative de connexion pour: {user_in.username}")
    user = await get_user_from_db(user_in.username)
    
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect credentials", headers={"WWW-Authenticate": "Bearer"})
        
    if not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect credentials", headers={"WWW-Authenticate": "Bearer"})
    
    try:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        logging.error(f"ERREUR JWT: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur interne du serveur")

# --- Fonctions Utilitaires (Tournoi) ---

def create_groups_logic(players: List[str], num_groups: Optional[int] = None, format: str = "1v1") -> List[Group]:
    entities = []
    
    # --- MODIFICATION : On ne mélange PLUS ici pour le 2v2 si on veut respecter la preview ---
    # Si format 2v2, on suppose que la liste 'players' est DÉJÀ mélangée/ordonnée par le frontend
    if format == "2v2":
        # On prend les joueurs 2 par 2 dans l'ordre fourni
        for i in range(0, len(players), 2):
            if i+1 < len(players):
                p1 = players[i]
                p2 = players[i+1]
                entities.append(PlayerStats(name=f"{p1} + {p2}", real_players=[p1, p2]))
            else:
                # Cas impair (ne devrait pas arriver avec la validation)
                 entities.append(PlayerStats(name=players[i], real_players=[players[i]]))
    else:
        # En 1v1, on peut mélanger ici ou faire confiance.
        # Pour cohérence, faisons confiance à l'ordre, mais mélangeons pour la répartition des poules.
        entities = [PlayerStats(name=p) for p in players]

    totalEntities = len(entities)
    if num_groups is None or num_groups <= 1:
        num_groups = math.ceil(totalEntities / 4)
        if totalEntities > 8 and totalEntities % 4 in [1, 2]:
             num_groups = math.floor(totalEntities / 4) 
        logging.info(f"Calcul auto: {totalEntities} entités -> {num_groups} poules")
    else:
        logging.info(f"Calcul manuel: {totalEntities} entités -> {num_groups} poules")
    
    # On mélange les ENTITÉS (équipes) pour les répartir dans les poules
    # Cela garde les équipes formées, mais les place au hasard dans Poule A, B...
    shuffled_entities = random.sample(entities, totalEntities)
    
    base_size = totalEntities // num_groups
    remainder = totalEntities % num_groups
    groupSizes = []
    for i in range(num_groups):
        groupSizes.append(base_size + 1 if i < remainder else base_size)
        
    groups = []
    entityIndex = 0
    for i, size in enumerate(groupSizes):
        group_entities = shuffled_entities[entityIndex : entityIndex + size]
        entityIndex += size
        matches = []
        for j in range(len(group_entities)):
            for k in range(j + 1, len(group_entities)):
                matches.append(GroupMatch(player1=group_entities[j].name, player2=group_entities[k].name))
        groups.append(Group(name=chr(65 + i), players=group_entities, matches=matches))
    return groups

def update_group_standings_logic(group: Group) -> List[PlayerStats]:
    for p_stat in group.players:
        p_stat.played = 0; p_stat.won = 0; p_stat.drawn = 0; p_stat.lost = 0
        p_stat.goalsFor = 0; p_stat.goalsAgainst = 0; p_stat.goalDiff = 0; p_stat.points = 0
    for match in group.matches:
        if match.played:
            p1 = next((p for p in group.players if p.name == match.player1), None)
            p2 = next((p for p in group.players if p.name == match.player2), None)
            if not p1 or not p2: continue
            p1.played += 1; p2.played += 1
            p1.goalsFor += match.score1; p1.goalsAgainst += match.score2
            p2.goalsFor += match.score2; p2.goalsAgainst += match.score1
            if match.score1 > match.score2:
                p1.won += 1; p1.points += 3; p2.lost += 1
            elif match.score1 < match.score2:
                p2.won += 1; p2.points += 3; p1.lost += 1
            else:
                p1.drawn += 1; p1.points += 1; p2.drawn += 1; p2.points += 1
    for p_stat in group.players: p_stat.goalDiff = p_stat.goalsFor - p_stat.goalsAgainst
    sorted_players = sorted(group.players, key=lambda p: (p.points, p.goalDiff, p.goalsFor), reverse=True)
    for i, player in enumerate(sorted_players): player.groupPosition = i + 1
    return sorted_players

def determine_qualifiers_logic(groups: List[Group], total_original_players: int) -> List[str]:
    # --- CORRECTION CRITIQUE ICI ---
    # On calcule le nombre total d'ENTITÉS (Équipes ou Joueurs) actuellement en jeu
    total_entities = sum(len(g.players) for g in groups)
    
    # On base la qualification sur le nombre d'ÉQUIPES, pas de joueurs individuels
    if total_entities <= 8: target = 4
    elif total_entities <= 16: target = 8
    else: target = 16 if total_entities >= 24 else 8 
    
    num_groups = len(groups)
    qualified = []
    
    if target % num_groups == 0:
        per_group = target // num_groups
        for g in groups:
            sorted_p = update_group_standings_logic(g)
            g.players = sorted_p
            for i, p in enumerate(sorted_p):
                if i < per_group: qualified.append(p.name)
    else:
        base = math.floor(target / num_groups)
        pool = []
        for g in groups:
            sorted_p = update_group_standings_logic(g)
            g.players = sorted_p
            for i, p in enumerate(sorted_p):
                if i < base: qualified.append(p.name)
                else: pool.append(p)
        needed = target - len(qualified)
        if needed > 0 and pool:
            pool.sort(key=lambda p: (p.points, p.goalDiff, p.goalsFor), reverse=True)
            qualified.extend(p.name for p in pool[:needed])
            
    return qualified[:target]


def generate_knockout_matches_logic(qualified_names: List[str], single_round: bool = False) -> List[KnockoutMatch]:
    """
    Génère les matchs.
    Si single_round=True (mode 2v2), ne génère QUE le prochain tour.
    """
    num = len(qualified_names)
    if num == 0: return []
    
    shuffled = random.sample(qualified_names, num)
    try:
        total_rounds = math.ceil(math.log2(num))
    except ValueError: 
        total_rounds = 0

    matches = []
    first_round_matches = num // 2
    round_index = 0 

    for i in range(first_round_matches):
        matches.append(KnockoutMatch(
            id=f"match_{uuid.uuid4()}", 
            round=round_index, 
            matchIndex=i, 
            player1=shuffled[i*2], 
            player2=shuffled[i*2+1]
        ))
    
    if not single_round:
        matches_in_round = first_round_matches // 2
        while matches_in_round >= 1:
            round_index += 1
            for i in range(matches_in_round):
                 matches.append(KnockoutMatch(id=f"match_{uuid.uuid4()}", round=round_index, matchIndex=i))
            matches_in_round //= 2
        if num >= 4:
             final_round_index = total_rounds - 1
             matches.append(KnockoutMatch(id=f"match_third_place_{uuid.uuid4()}", round=final_round_index, matchIndex=1, player1=None, player2=None))

    return matches

# --- Routes API (Tournoi) ---

@api_router.post("/tournament", response_model=Tournament, status_code=201)
async def create_tournament(
    request: TournamentCreateRequest, 
    current_user: UserInDB = Depends(get_current_user)
): 
    player_names = request.playerNames
    if len(set(player_names)) != len(player_names):
        raise HTTPException(status_code=400, detail="Les noms des joueurs doivent être uniques")
    
    if request.format == "2v2" and len(player_names) % 2 != 0:
        raise HTTPException(status_code=400, detail="Pour un tournoi 2v2, le nombre de joueurs doit être pair.")

    generated_groups = create_groups_logic(player_names, request.numGroups, request.format or "1v1")
    
    new_tournament = Tournament(
        name=request.tournamentName or f"Tournoi du {datetime.now(timezone.utc).strftime('%d/%m/%Y')}",
        players=player_names,
        currentStep="groups",
        groups=generated_groups,
        owner_username=current_user.username,
        format=request.format or "1v1"
    )
    
    t_dict = new_tournament.model_dump(by_alias=True)
    t_dict["createdAt"] = new_tournament.createdAt; t_dict["updatedAt"] = new_tournament.updatedAt
    res = await tournaments_collection.insert_one(t_dict)
    created = await tournaments_collection.find_one({"_id": res.inserted_id})
    if created: created["_id"] = str(created["_id"])
    return Tournament(**created)

@api_router.post("/tournament/{tournament_id}/complete_groups", response_model=Tournament)
async def complete_groups_and_draw_knockout(tournament_id: str):
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = Tournament(**tournament_data)
    
    if not all(m.played for g in tournament.groups for m in g.matches):
        raise HTTPException(status_code=400, detail="Tous les matchs de poule ne sont pas encore joués")
    if tournament.currentStep != "groups":
         raise HTTPException(status_code=400, detail="Action invalide")
    
    # 1. Déterminer les qualifiés
    qualified_entities = determine_qualifiers_logic(tournament.groups, len(tournament.players))
    final_qualified_list = qualified_entities 

    # --- LOGIQUE 2v2 (RESHUFFLE) ---
    if tournament.format == "2v2":
        logging.info("Format 2v2 détecté : Dissolution des équipes et nouveau tirage.")
        individual_pool = []
        all_stats_map = {p.name: p for g in tournament.groups for p in g.players}
        
        for team_name in qualified_entities:
            stats = all_stats_map.get(team_name)
            if stats and stats.real_players:
                individual_pool.extend(stats.real_players)
            else:
                parts = team_name.split(' + ')
                individual_pool.extend(parts)
        
        random.shuffle(individual_pool)
        new_teams = []
        for i in range(0, len(individual_pool), 2):
            if i+1 < len(individual_pool):
                new_teams.append(f"{individual_pool[i]} + {individual_pool[i+1]}")
            else:
                new_teams.append(individual_pool[i])
        final_qualified_list = new_teams

    tournament.qualifiedPlayers = final_qualified_list
    tournament.currentStep = "qualified"
    
    # Génération du tableau
    is_2v2 = (tournament.format == "2v2")
    knockout_matches = generate_knockout_matches_logic(final_qualified_list, single_round=is_2v2)
    
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
    res = await tournaments_collection.find_one({"_id": tournament_id})
    res["_id"] = str(res["_id"])
    return Tournament(**res)

# --- NOUVELLE ROUTE : Générer le prochain tour (2v2) ---
@api_router.post("/tournament/{tournament_id}/generate_next_round", response_model=Tournament)
async def generate_next_round(tournament_id: str):
    """
    Pour le mode 2v2 : Prend les vainqueurs, mélange et génère le tour suivant.
    Gère aussi la petite finale si on est en demies.
    """
    t_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not t_data: raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = Tournament(**t_data)
    
    if tournament.format != "2v2":
        raise HTTPException(status_code=400, detail="Action réservée au mode 2v2")
    
    # Trouver le round actuel (le plus élevé)
    current_matches = tournament.knockoutMatches
    if not current_matches:
         raise HTTPException(status_code=400, detail="Aucun match en cours")
         
    max_round = max(m.round for m in current_matches if not m.id.startswith("match_third_place_"))
    
    # Matchs du tour actuel
    current_round_matches = [m for m in current_matches if m.round == max_round and not m.id.startswith("match_third_place_")]
    if not all(m.played and m.winner for m in current_round_matches):
        raise HTTPException(status_code=400, detail="Le tour actuel n'est pas terminé")
        
    winning_teams = [m.winner for m in current_round_matches]
    losing_teams = []
    # Pour récupérer les perdants, on regarde qui n'est pas le winner
    for m in current_round_matches:
        if m.winner == m.player1: losing_teams.append(m.player2)
        else: losing_teams.append(m.player1)

    if len(winning_teams) < 2:
         raise HTTPException(status_code=400, detail="Le tournoi est terminé (Finale jouée)")

    # --- GESTION VAINQUEURS (Finale) ---
    individual_pool = []
    for team_name in winning_teams:
        parts = team_name.split(' + ')
        individual_pool.extend(parts)
    
    random.shuffle(individual_pool)
    
    new_teams = []
    for i in range(0, len(individual_pool), 2):
        if i+1 < len(individual_pool):
            new_teams.append(f"{individual_pool[i]} + {individual_pool[i+1]}")
            
    next_round_index = max_round + 1
    new_matches = []
    
    # Création de la finale (ou du tour suivant)
    for i in range(len(new_teams) // 2):
         new_matches.append(KnockoutMatch(
            id=f"match_{uuid.uuid4()}", 
            round=next_round_index, 
            matchIndex=i, 
            player1=new_teams[i*2], 
            player2=new_teams[i*2+1]
        ))

    # --- GESTION PERDANTS (Petite Finale) ---
    # Si on avait 2 matchs (donc 4 équipes) dans le round actuel, c'était les Demies.
    # On doit créer la petite finale avec les perdants reshufflés.
    if len(current_round_matches) == 2:
        logging.info("Demi-finales 2v2 détectées : Création de la petite finale reshufflée.")
        loser_pool = []
        for team_name in losing_teams:
            parts = team_name.split(' + ')
            loser_pool.extend(parts)
        
        random.shuffle(loser_pool)
        # On devrait avoir 4 joueurs -> 2 équipes
        loser_teams = []
        for i in range(0, len(loser_pool), 2):
             loser_teams.append(f"{loser_pool[i]} + {loser_pool[i+1]}")
             
        if len(loser_teams) == 2:
            new_matches.append(KnockoutMatch(
                id=f"match_third_place_{uuid.uuid4()}", 
                round=next_round_index, # On met la petite finale au même "niveau" que la finale
                matchIndex=1, 
                player1=loser_teams[0], 
                player2=loser_teams[1]
            ))

    # Ajouter au tableau existant
    tournament.knockoutMatches.extend(new_matches)
    
    tournament.updatedAt = datetime.now(timezone.utc)
    
    update_data = {
        "$set": {
            "knockoutMatches": [m.model_dump() for m in tournament.knockoutMatches],
            "updatedAt": tournament.updatedAt
        }
    }
    
    await tournaments_collection.update_one({"_id": tournament_id}, update_data)
    res = await tournaments_collection.find_one({"_id": tournament_id})
    res["_id"] = str(res["_id"])
    return Tournament(**res)


@api_router.delete("/tournament/{tournament_id}", status_code=204)
async def delete_tournament(
    tournament_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    if tournament_data.get("owner_username") != current_user.username:
        raise HTTPException(status_code=403, detail="Permission refusée.")
    await tournaments_collection.delete_one({"_id": tournament_id})
    return 

@api_router.get("/tournaments/public", response_model=List[Tournament])
async def get_public_tournaments():
    tournaments = await tournaments_collection.find({}, sort=[("createdAt", -1)]).limit(20).to_list(20)
    for t in tournaments: t["_id"] = str(t["_id"])
    return tournaments

@api_router.get("/tournaments/my-tournaments", response_model=List[Tournament])
async def get_my_tournaments(current_user: UserInDB = Depends(get_current_user)):
    tournaments = await tournaments_collection.find({"owner_username": current_user.username}, sort=[("createdAt", -1)]).to_list(1000)
    for t in tournaments: t["_id"] = str(t["_id"])
    return tournaments

@api_router.get("/tournament/{tournament_id}", response_model=Tournament)
async def get_tournament(tournament_id: str):
    t = await tournaments_collection.find_one({"_id": tournament_id})
    if t:
        t["_id"] = str(t["_id"])
        return Tournament(**t)
    raise HTTPException(status_code=404, detail=f"Tournoi '{tournament_id}' non trouvé")

@api_router.post("/tournament/{tournament_id}/draw_groups", response_model=Tournament)
async def draw_groups(tournament_id: str):
    t = await tournaments_collection.find_one({"_id": tournament_id})
    if not t: raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    t["_id"] = str(t["_id"])
    return Tournament(**t)

@api_router.post("/tournament/{tournament_id}/match/{match_id}/score", response_model=Tournament)
async def update_match_score(tournament_id: str, match_id: str, scores: ScoreUpdateRequest):
    t = await tournaments_collection.find_one({"_id": tournament_id})
    if not t: raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = t
    match_found = False
    
    # Groupes
    if tournament.get("groups"):
        for group in tournament["groups"]:
            for match in group.get("matches", []):
                if match.get("id") == match_id:
                    if match.get("played") and match.get("score1") == scores.score1 and match.get("score2") == scores.score2:
                        tournament["_id"] = str(tournament["_id"])
                        return Tournament(**tournament)
                    match["score1"] = scores.score1; match["score2"] = scores.score2; match["played"] = True
                    match_found = True
                    updated_standings = update_group_standings_logic(Group(**group))
                    group["players"] = [p.model_dump() for p in updated_standings]
                    break
            if match_found: break
    
    # Knockout
    if not match_found and tournament.get("knockoutMatches"):
        for match in tournament["knockoutMatches"]:
             if match.get("id") == match_id:
                if match.get("played") and match.get("score1") == scores.score1 and match.get("score2") == scores.score2:
                     tournament["_id"] = str(tournament["_id"])
                     return Tournament(**tournament)
                match["score1"] = scores.score1; match["score2"] = scores.score2; match["played"] = True
                winner = None; loser = None
                if scores.score1 > scores.score2: winner = match["player1"]; loser = match["player2"]
                elif scores.score2 > scores.score1: winner = match["player2"]; loser = match["player1"]
                
                match["winner"] = winner
                match_found = True
                
                # --- LOGIQUE 1v1 Standard (Avancement automatique) ---
                if tournament.get("format") != "2v2":
                    current_round = match["round"]
                    current_idx = match["matchIndex"]
                    qualif = tournament.get("qualifiedPlayers", [])
                    total_rounds = math.ceil(math.log2(len(qualif))) if qualif else 0
                    if total_rounds == 0: 
                         all_m = [m["round"] for m in tournament["knockoutMatches"] if not m["id"].startswith("match_third_place_")]
                         if all_m: total_rounds = max(all_m) + 1
                    
                    semi_final = total_rounds - 2
                    final_round = total_rounds - 1
                    
                    if match["id"].startswith("match_third_place_"):
                        tournament["thirdPlace"] = winner
                    elif current_round == semi_final:
                        petite = next((m for m in tournament["knockoutMatches"] if m["id"].startswith("match_third_place_")), None)
                        if petite:
                            if not petite.get("player1"): petite["player1"] = loser
                            elif not petite.get("player2"): petite["player2"] = loser
                        next_round = current_round + 1
                        next_idx = current_idx // 2
                        finale = next((m for m in tournament["knockoutMatches"] if m["round"] == next_round and m["matchIndex"] == next_idx), None)
                        if finale:
                            if current_idx % 2 == 0: finale["player1"] = winner
                            else: finale["player2"] = winner
                    elif current_round == final_round:
                         tournament["winner"] = winner
                         tournament["currentStep"] = "finished"
                    else:
                        next_round = current_round + 1
                        next_idx = current_idx // 2
                        next_m = next((m for m in tournament["knockoutMatches"] if m["round"] == next_round and m["matchIndex"] == next_idx), None)
                        if next_m:
                             if current_idx % 2 == 0: next_m["player1"] = winner
                             else: next_m["player2"] = winner
                # --- FIN LOGIQUE 1v1 ---
                # En 2v2, on ne fait RIEN ici, on attend l'appel de /generate_next_round
                
                # Petite subtilité pour 2v2: Si c'est la finale ou petite finale qui est jouée, on met à jour le statut
                if tournament.get("format") == "2v2":
                    # Check if it's the last round (Finale/Petite Finale)
                    current_matches = tournament.get("knockoutMatches")
                    max_round = max(m["round"] for m in current_matches if not m["id"].startswith("match_third_place_"))
                    is_last_round = match["round"] == max_round

                    if match["id"].startswith("match_third_place_"):
                         tournament["thirdPlace"] = winner
                    elif is_last_round:
                         # C'est la finale ? Il faut vérifier s'il reste qu'un match
                         # En 2v2 reshuffle, on sait que c'est la finale si max_round correspond à 2 équipes
                         # Simplification: Si c'est le dernier match du dernier round généré
                         # On ne sait pas si c'est la finale absolue sans compter les joueurs restants.
                         # Mais si on a un winner, on peut le marquer.
                         # Si tous les matchs du round sont finis et qu'il n'y a qu'un match, c'est la finale.
                         matches_in_this_round = [m for m in current_matches if m["round"] == max_round and not m["id"].startswith("match_third_place_")]
                         if len(matches_in_this_round) == 1:
                             tournament["winner"] = winner
                             tournament["currentStep"] = "finished"

                break

    if not match_found: raise HTTPException(status_code=404, detail=f"Match '{match_id}' non trouvé")
    
    tournament["updatedAt"] = datetime.now(timezone.utc)
    await tournaments_collection.update_one({"_id": tournament_id}, {"$set": tournament})
    res = await tournaments_collection.find_one({"_id": tournament_id})
    res["_id"] = str(res["_id"])
    return Tournament(**res)

@api_router.post("/tournament/{tournament_id}/redraw_knockout", response_model=Tournament)
async def redraw_knockout_bracket(tournament_id: str):
    # ... (Code inchangé) ...
    t = await tournaments_collection.find_one({"_id": tournament_id})
    if not t: raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = Tournament(**t)
    
    new_km = generate_knockout_matches_logic(tournament.qualifiedPlayers, single_round=(tournament.format=="2v2"))
    
    tournament.knockoutMatches = new_km
    tournament.updatedAt = datetime.now(timezone.utc)
    update_data = {"$set": {"knockoutMatches": [m.model_dump() for m in new_km], "updatedAt": tournament.updatedAt}}
    await tournaments_collection.update_one({"_id": tournament_id}, update_data)
    res = await tournaments_collection.find_one({"_id": tournament_id})
    res["_id"] = str(res["_id"])
    return Tournament(**res)

# --- Status & Root ---
@app.get("/") 
async def root(): return {"status": "ok", "message": "Tournament API is running"}
@api_router.get("/status")
async def get_status_checks(): return {"status": "ok"}

# --- CORS ---
app.include_router(api_router)
app.include_router(auth_router)

origins = [
    "https://tournoi-fc26-1.onrender.com", 
    "https://tournoi-fc26-1.onrender.com/",
    "https://tournoi-fc26.onrender.com",    
    "http://localhost:3000",
    "http://localhost:3000/"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

logging.basicConfig(level=logging.INFO)
@app.on_event("startup")
async def startup():
    try: await client.admin.command('ping'); logging.info(f"Connected to DB: {db_name}")
    except Exception as e: logging.error(f"DB Connection Error: {e}")
@app.on_event("shutdown")
async def shutdown(): client.close()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)