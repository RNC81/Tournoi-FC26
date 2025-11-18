# Fichier: server.py
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
from bson import ObjectId # <-- Correction des imports

# --- Imports pour l'authentification ---
from passlib.context import CryptContext
from jose import JWTError, jwt
# --- FIN Imports ---

# --- Configuration initiale ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Constantes d'authentification ---
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    logging.warning("SECRET_KEY non définie, utilisation d'une clé par défaut (NON SÉCURISÉE)")
    SECRET_KEY = "votre_mot_de_passe_secret_12345_par_defaut" # Fallback pour dev
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 heures

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
users_collection = db["users"] # Collection utilisateurs

# --- FastAPI App et Routers ---
app = FastAPI(title="Tournament API")
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api/auth")

# --- Modèles Pydantic (Tournoi) ---

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
    owner_username: Optional[str] = "Ancien Admin" # <-- NOUVEAU CHAMP REQUIS

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()}
    )

class TournamentCreateRequest(BaseModel):
    playerNames: List[str]
    tournamentName: Optional[str] = "Tournoi EA FC"
    numGroups: Optional[int] = None

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

# --- Modèles Pydantic (Utilisateurs) ---

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
        user["_id"] = str(user["_id"]) # Correction du bug ObjectId
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
        logging.warning(f"Échec du login: utilisateur '{user_in.username}' non trouvé.")
        raise HTTPException(
            status_code=401,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not verify_password(user_in.password, user.hashed_password):
        logging.warning(f"Échec du login: mot de passe incorrect pour '{user_in.username}'.")
        raise HTTPException(
            status_code=401,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        logging.info(f"Connexion réussie et token créé pour: {user.username}")
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        logging.error(f"ERREUR CRITIQUE PENDANT LA CRÉATION DU TOKEN JWT: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erreur interne du serveur lors de la génération du token"
        )

# --- Fonctions Utilitaires (Tournoi) ---

def create_groups_logic(players: List[str], num_groups: Optional[int] = None) -> List[Group]:
    totalPlayers = len(players)
    if num_groups is None or num_groups <= 1:
        num_groups = math.ceil(totalPlayers / 4)
        if totalPlayers > 8 and totalPlayers % 4 in [1, 2]:
             num_groups = math.floor(totalPlayers / 4) 
        logging.info(f"Calcul auto: {totalPlayers} joueurs -> {num_groups} poules (par défaut)")
    else:
        logging.info(f"Calcul manuel: {totalPlayers} joueurs -> {num_groups} poules (choix admin)")
    shuffled = random.sample(players, totalPlayers)
    base_size = totalPlayers // num_groups
    remainder = totalPlayers % num_groups
    groupSizes = []
    for i in range(num_groups):
        groupSizes.append(base_size + 1 if i < remainder else base_size)
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
        groups.append(Group(name=chr(65 + i), players=group_players_stats, matches=matches))
    return groups

def update_group_standings_logic(group: Group) -> List[PlayerStats]:
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
    sorted_players = sorted(group.players, key=lambda p: (p.points, p.goalDiff, p.goalsFor), reverse=True)
    for i, player in enumerate(sorted_players):
        player.groupPosition = i + 1
    return sorted_players

def determine_qualifiers_logic(groups: List[Group], total_players: int) -> List[str]:
    if total_players <= 8: 
         targetQualified = 4
    elif total_players <= 16: 
         targetQualified = 8
    else: 
         targetQualified = 16 if total_players >= 24 else 8 
    num_groups = len(groups)
    qualified = []
    logging.info(f"Début Qualification: {total_players} joueurs, {num_groups} poules. Cible: {targetQualified} qualifiés.")
    if targetQualified % num_groups == 0:
        qualifiers_per_group = targetQualified // num_groups
        logging.info(f"Cas 'Propre' détecté. Règle: Top {qualifiers_per_group} de chaque poule.")
        for group in groups:
            sorted_players_in_group = update_group_standings_logic(group)
            group.players = sorted_players_in_group
            for i, player in enumerate(sorted_players_in_group):
                if i < qualifiers_per_group:
                    qualified.append(player.name)
    else:
        logging.info(f"Cas 'Complexe' détecté. Règle: Meilleurs suivants.")
        base_qualifiers_per_group = math.floor(targetQualified / num_groups)
        best_finishers_pool = []
        logging.info(f"Mode de qualification: Top {base_qualifiers_per_group} + meilleurs suivants.")
        for group in groups:
            sorted_players_in_group = update_group_standings_logic(group)
            group.players = sorted_players_in_group 
            for i, player in enumerate(sorted_players_in_group):
                if i < base_qualifiers_per_group:
                    qualified.append(player.name)
                else:
                    best_finishers_pool.append(player) 
        needed = targetQualified - len(qualified)
        if needed > 0 and best_finishers_pool:
            best_finishers_pool.sort(key=lambda p: (p.points, p.goalDiff, p.goalsFor), reverse=True)
            qualified.extend(p.name for p in best_finishers_pool[:needed])
    logging.info(f"Total qualifiés générés: {len(qualified)}")
    return qualified[:targetQualified]


def generate_knockout_matches_logic(qualified_player_names: List[str]) -> List[KnockoutMatch]:
    num_players = len(qualified_player_names)
    if num_players not in [4, 8, 16]:
        logging.warning(f"Nombre de qualifiés inattendu: {num_players}. Le tableau pourrait être déséquilibré.")
    shuffled = random.sample(qualified_player_names, num_players)
    try:
        total_rounds = math.ceil(math.log2(num_players))
    except ValueError: 
        total_rounds = 0
    matches = []
    if num_players == 0:
        return []
    first_round_matches = num_players // 2
    round_index = 0 
    for i in range(first_round_matches):
        matches.append(KnockoutMatch(id=f"match_{uuid.uuid4()}", round=round_index, matchIndex=i, player1=shuffled[i*2], player2=shuffled[i*2+1]))
    matches_in_round = first_round_matches // 2
    while matches_in_round >= 1:
        round_index += 1
        for i in range(matches_in_round):
             matches.append(KnockoutMatch(id=f"match_{uuid.uuid4()}", round=round_index, matchIndex=i))
        matches_in_round //= 2
    if num_players >= 4:
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
    
    generated_groups = create_groups_logic(player_names, request.numGroups)
    
    new_tournament = Tournament(
        name=request.tournamentName or f"Tournoi du {datetime.now(timezone.utc).strftime('%d/%m/%Y')}",
        players=player_names,
        currentStep="groups",
        groups=generated_groups,
        owner_username=current_user.username
    )
    
    tournament_dict = new_tournament.model_dump(by_alias=True)
    tournament_dict["createdAt"] = new_tournament.createdAt
    tournament_dict["updatedAt"] = new_tournament.updatedAt
    
    inserted_result = await tournaments_collection.insert_one(tournament_dict)
    created_tournament = await tournaments_collection.find_one({"_id": inserted_result.inserted_id})
    
    if created_tournament and "_id" in created_tournament:
        created_tournament["_id"] = str(created_tournament["_id"])
        
    return Tournament(**created_tournament)

@api_router.get("/tournaments/my-tournaments", response_model=List[Tournament])
async def get_my_tournaments(current_user: UserInDB = Depends(get_current_user)):
    """ Récupère tous les tournois de l'utilisateur connecté. """
    logging.info(f"Récupération des tournois pour l'utilisateur: {current_user.username}")
    tournaments = await tournaments_collection.find(
        {"owner_username": current_user.username},
        sort=[("createdAt", -1)]
    ).to_list(1000)
    for t in tournaments:
        t["_id"] = str(t["_id"])
    return tournaments

@api_router.get("/tournaments/public", response_model=List[Tournament])
async def get_public_tournaments():
    """ Récupère la liste publique des tournois. """
    tournaments = await tournaments_collection.find(
        {}, 
        sort=[("createdAt", -1)]
    ).limit(20).to_list(20)
    for t in tournaments:
        t["_id"] = str(t["_id"])
    return tournaments

@api_router.get("/tournament/{tournament_id}", response_model=Tournament)
async def get_tournament(tournament_id: str):
    tournament = await tournaments_collection.find_one({"_id": tournament_id})
    if tournament:
        tournament["_id"] = str(tournament["_id"])
        return Tournament(**tournament)
    raise HTTPException(status_code=404, detail=f"Tournoi '{tournament_id}' non trouvé")

@api_router.post("/tournament/{tournament_id}/draw_groups", response_model=Tournament)
async def draw_groups(tournament_id: str):
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament_data["_id"] = str(tournament_data["_id"])
    return Tournament(**tournament_data)

@api_router.post("/tournament/{tournament_id}/match/{match_id}/score", response_model=Tournament)
async def update_match_score(tournament_id: str, match_id: str, scores: ScoreUpdateRequest):
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = tournament_data
    match_found = False
    
    if tournament.get("groups"):
        for group in tournament["groups"]:
            if group.get("matches"):
                for match in group["matches"]:
                    if match.get("id") == match_id:
                        if match.get("played") and match.get("score1") == scores.score1 and match.get("score2") == scores.score2:
                            tournament["_id"] = str(tournament["_id"])
                            return Tournament(**tournament)
                        match["score1"] = scores.score1
                        match["score2"] = scores.score2
                        match["played"] = True
                        match_found = True
                        updated_standings = update_group_standings_logic(Group(**group))
                        group["players"] = [p.model_dump() for p in updated_standings]
                        break
            if match_found: break
    
    if not match_found and tournament.get("knockoutMatches"):
        for match in tournament["knockoutMatches"]:
             if match.get("id") == match_id:
                if match.get("played") and match.get("score1") == scores.score1 and match.get("score2") == scores.score2:
                     tournament["_id"] = str(tournament["_id"])
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
                if total_rounds > 0 :
                    semi_final_round_index = total_rounds - 2 
                    final_round_index = total_rounds - 1    
                else:
                    semi_final_round_index = -1
                    final_round_index = -1
                if match["id"].startswith("match_third_place_"):
                    tournament["thirdPlace"] = winner
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
                elif current_round == final_round_index and final_round_index != -1:
                    tournament["winner"] = winner
                    tournament["currentStep"] = "finished"
                elif final_round_index != -1 :
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
    updated_tournament_data["_id"] = str(updated_tournament_data["_id"])
    return Tournament(**updated_tournament_data)

@api_router.post("/tournament/{tournament_id}/complete_groups", response_model=Tournament)
async def complete_groups_and_draw_knockout(tournament_id: str):
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
    updated_tournament_data["_id"] = str(updated_tournament_data["_id"])
    return Tournament(**updated_tournament_data)

@api_router.post("/tournament/{tournament_id}/redraw_knockout", response_model=Tournament)
async def redraw_knockout_bracket(tournament_id: str):
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
    update_data = {"$set": {"knockoutMatches": [m.model_dump() for m in new_knockout_matches], "updatedAt": tournament.updatedAt}}
    await tournaments_collection.update_one({"_id": tournament_id}, update_data)
    updated_tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    updated_tournament_data["_id"] = str(updated_tournament_data["_id"])
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
app.include_router(auth_router) 

origins = [
    "https://tournoi-fc26-1.onrender.com", 
    "http://localhost:3000",            
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