# Fichier: backend/server.py
from fastapi import FastAPI, APIRouter, HTTPException, Body, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, field_validator, StringConstraints
from typing import List, Optional, Dict, Any, Union, Annotated
import uuid
from datetime import datetime, timezone, timedelta
import random
import math
from bson import ObjectId

# --- Imports Sécurité ---
from passlib.context import CryptContext
from jose import JWTError, jwt
import bleach # Anti-XSS
from slowapi import Limiter, _rate_limit_exceeded_handler # Rate Limiting
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# --- Configuration initiale ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Constantes d'authentification ---
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    logging.warning("SECRET_KEY non définie, utilisation d'une clé par défaut (NON SÉCURISÉ EN PROD)")
    SECRET_KEY = "votre_mot_de_passe_secret_12345_par_defaut"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 

# --- Rate Limiter Setup ---
limiter = Limiter(key_func=get_remote_address)

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
app = FastAPI(title="Tournament API - Secured V4")

# Ajout du handler pour les erreurs de Rate Limit
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api/auth")

# --- Middleware de Sécurité HTTP (Headers) ---
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Protection contre le Clickjacking (affichage dans une iframe)
        response.headers["X-Frame-Options"] = "DENY"
        # Protection contre le MIME Sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # HSTS (Force HTTPS) - À activer uniquement si vous avez HTTPS configuré sur Render
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # XSS Protection (Browser)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# --- Fonctions de Sanitization (Anti-XSS) ---
def sanitize_text(text: str) -> str:
    if not text: return ""
    # bleach.clean supprime toutes les balises HTML et attributs dangereux
    return bleach.clean(text.strip(), tags=[], attributes={}, strip=True)

# --- Modèles Pydantic Renforcés (Input Validation) ---

# Validateur pour Username : Alphanumérique + _ - . uniquement. 
# Empêche les injections NoSQL basées sur des objets ou caractères spéciaux.
UsernameType = Annotated[str, StringConstraints(pattern=r"^[a-zA-Z0-9_.-]+$", min_length=3, max_length=30)]

class PlayerStats(BaseModel):
    name: str
    real_players: Optional[List[str]] = None
    played: int = Field(ge=0, default=0)
    won: int = Field(ge=0, default=0)
    drawn: int = Field(ge=0, default=0)
    lost: int = Field(ge=0, default=0)
    goalsFor: int = Field(ge=0, default=0)
    goalsAgainst: int = Field(ge=0, default=0)
    goalDiff: int = 0
    points: int = Field(ge=0, default=0)
    groupPosition: Optional[int] = None

class GroupMatch(BaseModel):
    id: str = Field(default_factory=lambda: f"match_{uuid.uuid4()}")
    player1: str
    player2: str
    score1: Optional[int] = Field(ge=0, default=None) # Score ne peut pas être négatif
    score2: Optional[int] = Field(ge=0, default=None)
    played: bool = False

class Group(BaseModel):
    name: str
    players: List[PlayerStats]
    matches: List[GroupMatch]

class KnockoutMatch(BaseModel):
    id: str = Field(default_factory=lambda: f"match_{uuid.uuid4()}")
    round: int = Field(ge=0)
    matchIndex: int = Field(ge=0)
    player1: Optional[str] = None
    player2: Optional[str] = None
    score1: Optional[int] = Field(ge=0, default=None)
    score2: Optional[int] = Field(ge=0, default=None)
    winner: Optional[str] = None
    played: bool = False

class Tournament(BaseModel):
    id: str = Field(default_factory=lambda: f"tournoi_{uuid.uuid4()}", alias="_id")
    name: str
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
    numGroups: Optional[int] = Field(None, ge=2, le=16) # Limite réaliste pour les poules
    format: Optional[str] = "1v1"

    @field_validator('playerNames')
    def validate_and_sanitize_players(cls, v):
        if len(v) < 4:
            raise ValueError("Minimum 4 joueurs requis")
        if len(v) > 64:
            raise ValueError("Maximum 64 joueurs autorisés")
        
        cleaned = []
        for name in v:
            sanitized = sanitize_text(name)
            if len(sanitized) < 2:
                raise ValueError(f"Nom de joueur invalide ou trop court : {name}")
            cleaned.append(sanitized)
        
        # Vérification doublons après nettoyage
        if len(set(cleaned)) != len(cleaned):
             raise ValueError("Les noms des joueurs doivent être uniques (après nettoyage).")
        return cleaned

    @field_validator('tournamentName')
    def sanitize_tournament_name(cls, v):
        clean = sanitize_text(v)
        if len(clean) < 3:
            return "Tournoi EA FC" # Fallback sécurisé
        return clean

    @field_validator('format')
    def validate_format(cls, v):
        if v not in ["1v1", "2v2"]:
            raise ValueError("Format invalide (1v1 ou 2v2 uniquement)")
        return v

class ScoreUpdateRequest(BaseModel):
    score1: int = Field(ge=0, le=99) # Anti-troll: max 99 buts
    score2: int = Field(ge=0, le=99)

class UserBase(BaseModel):
    username: str
    role: str = "admin" 
    status: str = "pending" 
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={datetime: lambda dt: dt.isoformat()}
    )

class UserCreate(BaseModel):
    username: UsernameType # Utilise la regex stricte définie plus haut
    password: str = Field(min_length=8) # Renforcement min mot de passe

class UserLogin(BaseModel):
    username: str # Pas de regex stricte ici pour permettre le login même si on change les règles plus tard, mais on vérifie en base.
    password: str

class UserUpdate(BaseModel):
    username: Optional[UsernameType] = None
    password: Optional[str] = Field(None, min_length=8)

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
    role: Optional[str] = None

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
    # Mongo Query sécurisée (recherche par champ exact)
    user = await users_collection.find_one({"username": username})
    if user:
        if "status" not in user: user["status"] = "active"
        if "role" not in user: user["role"] = "admin"
        user["_id"] = str(user["_id"])
        return UserInDB(**user)
    return None

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception
    
    user = await get_user_from_db(token_data.username)
    if user is None:
        raise credentials_exception
    
    if user.status != "active":
         raise HTTPException(status_code=403, detail="Compte inactif ou banni.")
         
    return user

async def get_current_super_admin(current_user: UserInDB = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Privilèges Super Admin requis.")
    return current_user

# --- Routes d'Authentification ---

@auth_router.post("/register", response_model=UserBase, status_code=201)
@limiter.limit("5/minute") # Rate Limit: 5 créations par minute max par IP
async def register_user(request: Request, user_in: UserCreate):
    # La validation Regex Pydantic a déjà eu lieu ici pour username
    
    existing_user = await users_collection.find_one({"username": user_in.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà pris")
    
    user_count = await users_collection.count_documents({})
    if user_count == 0:
        role = "super_admin"
        status_account = "active"
    else:
        role = "admin"
        status_account = "pending"

    hashed_password = get_password_hash(user_in.password)
    user_doc = {
        "username": user_in.username, 
        "hashed_password": hashed_password,
        "role": role,
        "status": status_account,
        "createdAt": datetime.now(timezone.utc)
    }
    
    new_user = await users_collection.insert_one(user_doc)
    created_user = await users_collection.find_one({"_id": new_user.inserted_id})
    created_user["_id"] = str(created_user["_id"])
    
    return UserBase(**created_user)

@auth_router.post("/login", response_model=Token)
@limiter.limit("10/minute") # Rate Limit: 10 tentatives par minute max (Anti-Brute Force)
async def login_for_access_token(request: Request, user_in: UserLogin):
    # Assainissement basique de l'entrée username pour la log (éviter log injection)
    safe_username = sanitize_text(user_in.username)
    logging.info(f"Tentative de connexion pour: {safe_username}")
    
    user = await get_user_from_db(user_in.username)
    
    if not user or not verify_password(user_in.password, user.hashed_password):
        # On renvoie une erreur générique pour ne pas indiquer si c'est le user ou le mdp qui est faux
        raise HTTPException(status_code=401, detail="Identifiants incorrects", headers={"WWW-Authenticate": "Bearer"})
    
    if user.status == "pending":
        raise HTTPException(status_code=403, detail="Votre compte est en attente de validation par un Super Admin.")
    
    if user.status == "banned" or user.status == "rejected":
        raise HTTPException(status_code=403, detail="Votre compte a été suspendu ou rejeté.")

    try:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "role": user.role}, 
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        logging.error(f"ERREUR JWT: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur interne du serveur")

@auth_router.put("/profile", response_model=UserBase)
async def update_profile(updates: UserUpdate, current_user: UserInDB = Depends(get_current_user)):
    update_data = {}
    
    if updates.username:
        if updates.username != current_user.username:
             existing = await users_collection.find_one({"username": updates.username})
             if existing:
                 raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà pris")
             update_data["username"] = updates.username
    
    if updates.password:
        update_data["hashed_password"] = get_password_hash(updates.password)
    
    if not update_data:
         raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
         
    await users_collection.update_one({"_id": ObjectId(current_user.id)}, {"$set": update_data})
    
    updated_user_doc = await users_collection.find_one({"_id": ObjectId(current_user.id)})
    updated_user_doc["_id"] = str(updated_user_doc["_id"])
    return UserBase(**updated_user_doc)

# --- Routes SUPER ADMIN ---

@api_router.get("/admin/users/pending", response_model=List[UserBase])
async def get_pending_users(current_user: UserInDB = Depends(get_current_super_admin)):
    users = await users_collection.find({"status": "pending"}).to_list(100)
    for u in users: u["_id"] = str(u["_id"])
    return users

@api_router.get("/admin/users", response_model=List[UserBase])
async def get_all_users(current_user: UserInDB = Depends(get_current_super_admin)):
    users = await users_collection.find({}).sort("createdAt", -1).to_list(500)
    for u in users: u["_id"] = str(u["_id"])
    return users

@api_router.delete("/admin/users/{username}", status_code=204)
async def delete_user_admin(username: str, current_user: UserInDB = Depends(get_current_super_admin)):
    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous supprimer vous-même.")
        
    user_to_delete = await users_collection.find_one({"username": username})
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        
    await users_collection.delete_one({"username": username})
    logging.info(f"Utilisateur {username} supprimé par Super Admin {current_user.username}")
    return

@api_router.post("/admin/users/{username}/approve", response_model=UserBase)
async def approve_user(username: str, current_user: UserInDB = Depends(get_current_super_admin)):
    user = await users_collection.find_one({"username": username})
    if not user: raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    await users_collection.update_one({"username": username}, {"$set": {"status": "active"}})
    updated_user = await users_collection.find_one({"username": username})
    updated_user["_id"] = str(updated_user["_id"])
    return UserBase(**updated_user)

@api_router.post("/admin/users/{username}/reject", response_model=UserBase)
async def reject_user(username: str, current_user: UserInDB = Depends(get_current_super_admin)):
    user = await users_collection.find_one({"username": username})
    if not user: raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    await users_collection.update_one({"username": username}, {"$set": {"status": "rejected"}})
    updated_user = await users_collection.find_one({"username": username})
    updated_user["_id"] = str(updated_user["_id"])
    return UserBase(**updated_user)


# --- Fonctions Utilitaires (Tournoi) ---
# ... (create_groups_logic, update_group_standings_logic, etc. - Logique inchangée, mais données déjà nettoyées par Pydantic)

def create_groups_logic(players: List[str], num_groups: Optional[int] = None, format: str = "1v1") -> List[Group]:
    # Les noms 'players' sont déjà sanitized par Pydantic
    entities = []
    if format == "2v2":
        for i in range(0, len(players), 2):
            if i+1 < len(players):
                p1 = players[i]; p2 = players[i+1]
                entities.append(PlayerStats(name=f"{p1} + {p2}", real_players=[p1, p2]))
            else:
                 entities.append(PlayerStats(name=players[i], real_players=[players[i]]))
    else:
        entities = [PlayerStats(name=p) for p in players]
    
    totalEntities = len(entities)
    if num_groups is None or num_groups <= 1:
        num_groups = math.ceil(totalEntities / 4)
        if totalEntities > 8 and totalEntities % 4 in [1, 2]: num_groups = math.floor(totalEntities / 4) 
    
    shuffled_entities = random.sample(entities, totalEntities)
    base_size = totalEntities // num_groups
    remainder = totalEntities % num_groups
    groupSizes = []
    for i in range(num_groups): groupSizes.append(base_size + 1 if i < remainder else base_size)
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
            if match.score1 > match.score2: p1.won += 1; p1.points += 3; p2.lost += 1
            elif match.score1 < match.score2: p2.won += 1; p2.points += 3; p1.lost += 1
            else: p1.drawn += 1; p1.points += 1; p2.drawn += 1; p2.points += 1
    for p_stat in group.players: p_stat.goalDiff = p_stat.goalsFor - p_stat.goalsAgainst
    sorted_players = sorted(group.players, key=lambda p: (p.points, p.goalDiff, p.goalsFor), reverse=True)
    for i, player in enumerate(sorted_players): player.groupPosition = i + 1
    return sorted_players

def determine_qualifiers_logic(groups: List[Group], total_players: int) -> List[str]:
    total_entities = sum(len(g.players) for g in groups)
    if total_entities <= 8: target = 4
    elif total_entities <= 16: target = 8
    else: target = 16 if total_entities >= 24 else 8 
    num_groups = len(groups)
    qualified = []
    if target % num_groups == 0:
        qualifiers_per_group = target // num_groups
        for group in groups:
            sorted_players_in_group = update_group_standings_logic(group)
            group.players = sorted_players_in_group
            for i, player in enumerate(sorted_players_in_group):
                if i < qualifiers_per_group: qualified.append(player.name)
    else:
        base_qualifiers_per_group = math.floor(target / num_groups)
        best_finishers_pool = []
        for group in groups:
            sorted_players_in_group = update_group_standings_logic(group)
            group.players = sorted_players_in_group 
            for i, player in enumerate(sorted_players_in_group):
                if i < base_qualifiers_per_group: qualified.append(player.name)
                else: best_finishers_pool.append(player) 
        needed = target - len(qualified)
        if needed > 0 and best_finishers_pool:
            best_finishers_pool.sort(key=lambda p: (p.points, p.goalDiff, p.goalsFor), reverse=True)
            qualified.extend(p.name for p in best_finishers_pool[:needed])
    return qualified[:target]

def generate_knockout_matches_logic(qualified_names: List[str], single_round: bool = False) -> List[KnockoutMatch]:
    num = len(qualified_names)
    if num == 0: return []
    shuffled = random.sample(qualified_names, num)
    try: total_rounds = math.ceil(math.log2(num))
    except ValueError: total_rounds = 0
    matches = []
    first_round_matches = num // 2
    round_index = 0 
    for i in range(first_round_matches):
        matches.append(KnockoutMatch(id=f"match_{uuid.uuid4()}", round=round_index, matchIndex=i, player1=shuffled[i*2], player2=shuffled[i*2+1]))
    if not single_round:
        matches_in_round = first_round_matches // 2
        while matches_in_round >= 1:
            round_index += 1
            for i in range(matches_in_round): matches.append(KnockoutMatch(id=f"match_{uuid.uuid4()}", round=round_index, matchIndex=i))
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
    # Les données sont validées et nettoyées par Pydantic (TournamentCreateRequest)
    player_names = request.playerNames
    
    if request.format == "2v2" and len(player_names) % 2 != 0: 
        raise HTTPException(status_code=400, detail="Pour un tournoi 2v2, le nombre de joueurs doit être pair.")
    
    generated_groups = create_groups_logic(player_names, request.numGroups, request.format or "1v1")
    
    new_tournament = Tournament(
        name=request.tournamentName, # Déjà nettoyé
        players=player_names, 
        currentStep="groups", 
        groups=generated_groups, 
        owner_username=current_user.username, 
        format=request.format or "1v1"
    )
    
    t_dict = new_tournament.model_dump(by_alias=True)
    t_dict["createdAt"] = new_tournament.createdAt
    t_dict["updatedAt"] = new_tournament.updatedAt
    
    res = await tournaments_collection.insert_one(t_dict)
    created = await tournaments_collection.find_one({"_id": res.inserted_id})
    if created: created["_id"] = str(created["_id"])
    logging.info(f"Tournoi créé par {current_user.username} (Audit Log)")
    return Tournament(**created)

@api_router.post("/tournament/{tournament_id}/complete_groups", response_model=Tournament)
async def complete_groups_and_draw_knockout(tournament_id: str):
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data: raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = Tournament(**tournament_data)
    if not all(m.played for g in tournament.groups for m in g.matches): raise HTTPException(status_code=400, detail="Tous les matchs de poule ne sont pas encore joués")
    
    qualified_entities = determine_qualifiers_logic(tournament.groups, len(tournament.players))
    final_qualified_list = qualified_entities 
    if tournament.format == "2v2":
        # Logique 2v2 reshuffle (inchangée)
        previous_teams_sets = []
        for g in tournament.groups:
            for p in g.players:
                if p.real_players: previous_teams_sets.append(set(p.real_players))
                else:
                    parts = p.name.split(' + ')
                    if len(parts) == 2: previous_teams_sets.append(set(parts))
        individual_pool = []
        all_stats_map = {p.name: p for g in tournament.groups for p in g.players}
        for team_name in qualified_entities:
            stats = all_stats_map.get(team_name)
            if stats and stats.real_players: individual_pool.extend(stats.real_players)
            else: parts = team_name.split(' + '); individual_pool.extend(parts)
        attempts = 0; valid_shuffle = False; new_teams = []
        while attempts < 100 and not valid_shuffle:
            random.shuffle(individual_pool)
            temp_teams = []; collision = False
            for i in range(0, len(individual_pool), 2):
                if i+1 < len(individual_pool):
                    p1 = individual_pool[i]; p2 = individual_pool[i+1]; current_pair = {p1, p2}
                    if current_pair in previous_teams_sets: collision = True; break 
                    temp_teams.append(f"{p1} + {p2}")
                else: temp_teams.append(individual_pool[i])
            if not collision: new_teams = temp_teams; valid_shuffle = True
            attempts += 1
        if not valid_shuffle:
            new_teams = []
            for i in range(0, len(individual_pool), 2):
                if i+1 < len(individual_pool): new_teams.append(f"{individual_pool[i]} + {individual_pool[i+1]}")
                else: new_teams.append(individual_pool[i])
        final_qualified_list = new_teams
    tournament.qualifiedPlayers = final_qualified_list
    tournament.currentStep = "qualified"
    is_2v2 = (tournament.format == "2v2")
    knockout_matches = generate_knockout_matches_logic(final_qualified_list, single_round=is_2v2)
    tournament.knockoutMatches = knockout_matches
    tournament.currentStep = "knockout"
    tournament.updatedAt = datetime.now(timezone.utc)
    update_data = {"$set": {"groups": [g.model_dump() for g in tournament.groups], "qualifiedPlayers": tournament.qualifiedPlayers, "knockoutMatches": [m.model_dump() for m in tournament.knockoutMatches], "currentStep": tournament.currentStep, "updatedAt": tournament.updatedAt}}
    await tournaments_collection.update_one({"_id": tournament_id}, update_data)
    res = await tournaments_collection.find_one({"_id": tournament_id}); res["_id"] = str(res["_id"])
    return Tournament(**res)

@api_router.post("/tournament/{tournament_id}/generate_next_round", response_model=Tournament)
async def generate_next_round(tournament_id: str):
    t_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not t_data: raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = Tournament(**t_data)
    if tournament.format != "2v2": raise HTTPException(status_code=400, detail="Action réservée au mode 2v2")
    current_matches = tournament.knockoutMatches
    if not current_matches: raise HTTPException(status_code=400, detail="Aucun match en cours")
    max_round = max(m.round for m in current_matches if not m.id.startswith("match_third_place_"))
    current_round_matches = [m for m in current_matches if m.round == max_round and not m.id.startswith("match_third_place_")]
    if not all(m.played and m.winner for m in current_round_matches): raise HTTPException(status_code=400, detail="Le tour actuel n'est pas terminé")
    winning_teams = [m.winner for m in current_round_matches]
    losing_teams = []
    for m in current_round_matches:
        if m.winner == m.player1: losing_teams.append(m.player2)
        else: losing_teams.append(m.player1)
    if len(winning_teams) < 2: raise HTTPException(status_code=400, detail="Le tournoi est terminé (Finale jouée)")
    individual_pool = []
    for team_name in winning_teams: parts = team_name.split(' + '); individual_pool.extend(parts)
    random.shuffle(individual_pool)
    new_teams = []
    for i in range(0, len(individual_pool), 2):
        if i+1 < len(individual_pool): new_teams.append(f"{individual_pool[i]} + {individual_pool[i+1]}")
    next_round_index = max_round + 1
    new_matches = []
    for i in range(len(new_teams) // 2):
         new_matches.append(KnockoutMatch(id=f"match_{uuid.uuid4()}", round=next_round_index, matchIndex=i, player1=new_teams[i*2], player2=new_teams[i*2+1]))
    if len(current_round_matches) == 2:
        loser_pool = []
        for team_name in losing_teams: parts = team_name.split(' + '); loser_pool.extend(parts)
        random.shuffle(loser_pool)
        loser_teams = []
        for i in range(0, len(loser_pool), 2): loser_teams.append(f"{loser_pool[i]} + {loser_pool[i+1]}")
        if len(loser_teams) == 2:
            new_matches.append(KnockoutMatch(id=f"match_third_place_{uuid.uuid4()}", round=next_round_index, matchIndex=1, player1=loser_teams[0], player2=loser_teams[1]))
    tournament.knockoutMatches.extend(new_matches)
    tournament.updatedAt = datetime.now(timezone.utc)
    await tournaments_collection.update_one({"_id": tournament_id}, {"$set": {"knockoutMatches": [m.model_dump() for m in tournament.knockoutMatches], "updatedAt": tournament.updatedAt}})
    res = await tournaments_collection.find_one({"_id": tournament_id}); res["_id"] = str(res["_id"])
    return Tournament(**res)

@api_router.delete("/tournament/{tournament_id}", status_code=204)
async def delete_tournament(tournament_id: str, current_user: UserInDB = Depends(get_current_user)):
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data: raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    if tournament_data.get("owner_username") != current_user.username and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Permission refusée.")
    await tournaments_collection.delete_one({"_id": tournament_id})
    logging.info(f"Tournoi {tournament_id} supprimé par {current_user.username}")
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
    if t: t["_id"] = str(t["_id"]); return Tournament(**t)
    raise HTTPException(status_code=404, detail=f"Tournoi '{tournament_id}' non trouvé")

@api_router.post("/tournament/{tournament_id}/match/{match_id}/score", response_model=Tournament)
async def update_match_score(tournament_id: str, match_id: str, scores: ScoreUpdateRequest):
    t = await tournaments_collection.find_one({"_id": tournament_id})
    if not t: raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = t
    match_found = False
    # ... (Logique Score update identique à la V4 mais avec ScoreUpdateRequest validé)
    if tournament.get("groups"):
        for group in tournament["groups"]:
            for match in group.get("matches", []):
                if match.get("id") == match_id:
                    if match.get("played") and match.get("score1") == scores.score1 and match.get("score2") == scores.score2:
                        tournament["_id"] = str(tournament["_id"]); return Tournament(**tournament)
                    match["score1"] = scores.score1; match["score2"] = scores.score2; match["played"] = True; match_found = True
                    updated_standings = update_group_standings_logic(Group(**group))
                    group["players"] = [p.model_dump() for p in updated_standings]
                    break
            if match_found: break
    if not match_found and tournament.get("knockoutMatches"):
        for match in tournament["knockoutMatches"]:
             if match.get("id") == match_id:
                match["score1"] = scores.score1; match["score2"] = scores.score2; match["played"] = True
                winner = None; loser = None
                if scores.score1 > scores.score2: winner = match["player1"]; loser = match["player2"]
                elif scores.score2 > scores.score1: winner = match["player2"]; loser = match["player1"]
                match["winner"] = winner; match_found = True
                if tournament.get("format") != "2v2":
                    current_round = match["round"]; current_idx = match["matchIndex"]
                    qualif = tournament.get("qualifiedPlayers", [])
                    total_rounds = math.ceil(math.log2(len(qualif))) if qualif else 0
                    if total_rounds == 0: 
                         all_m = [m["round"] for m in tournament["knockoutMatches"] if not m["id"].startswith("match_third_place_")]
                         if all_m: total_rounds = max(all_m) + 1
                    semi_final = total_rounds - 2; final_round = total_rounds - 1
                    if match["id"].startswith("match_third_place_"): tournament["thirdPlace"] = winner
                    elif current_round == semi_final:
                        petite = next((m for m in tournament["knockoutMatches"] if m["id"].startswith("match_third_place_")), None)
                        if petite:
                            if not petite.get("player1"): petite["player1"] = loser
                            elif not petite.get("player2"): petite["player2"] = loser
                        next_round = current_round + 1; next_idx = current_idx // 2
                        finale = next((m for m in tournament["knockoutMatches"] if m["round"] == next_round and m["matchIndex"] == next_idx), None)
                        if finale:
                            if current_idx % 2 == 0: finale["player1"] = winner
                            else: finale["player2"] = winner
                    elif current_round == final_round: tournament["winner"] = winner; tournament["currentStep"] = "finished"
                    else:
                        next_round = current_round + 1; next_idx = current_idx // 2
                        next_m = next((m for m in tournament["knockoutMatches"] if m["round"] == next_round and m["matchIndex"] == next_idx), None)
                        if next_m:
                             if current_idx % 2 == 0: next_m["player1"] = winner
                             else: next_m["player2"] = winner
                if tournament.get("format") == "2v2":
                    current_matches = tournament.get("knockoutMatches")
                    max_round = max(m["round"] for m in current_matches if not m["id"].startswith("match_third_place_"))
                    is_last_round = match["round"] == max_round
                    if match["id"].startswith("match_third_place_"): tournament["thirdPlace"] = winner
                    elif is_last_round:
                         matches_in_this_round = [m for m in current_matches if m["round"] == max_round and not m["id"].startswith("match_third_place_")]
                         if len(matches_in_this_round) == 1: tournament["winner"] = winner; tournament["currentStep"] = "finished"
                break
    if not match_found: raise HTTPException(status_code=404, detail=f"Match '{match_id}' non trouvé")
    tournament["updatedAt"] = datetime.now(timezone.utc)
    await tournaments_collection.update_one({"_id": tournament_id}, {"$set": tournament})
    res = await tournaments_collection.find_one({"_id": tournament_id}); res["_id"] = str(res["_id"])
    return Tournament(**res)

@api_router.post("/tournament/{tournament_id}/redraw_knockout", response_model=Tournament)
async def redraw_knockout_bracket(tournament_id: str):
    t = await tournaments_collection.find_one({"_id": tournament_id})
    if not t: raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = Tournament(**t)
    new_km = generate_knockout_matches_logic(tournament.qualifiedPlayers, single_round=(tournament.format=="2v2"))
    tournament.knockoutMatches = new_km
    tournament.updatedAt = datetime.now(timezone.utc)
    update_data = {"$set": {"knockoutMatches": [m.model_dump() for m in new_km], "updatedAt": tournament.updatedAt}}
    await tournaments_collection.update_one({"_id": tournament_id}, update_data)
    res = await tournaments_collection.find_one({"_id": tournament_id}); res["_id"] = str(res["_id"])
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
    try: 
        await client.admin.command('ping')
        logging.info(f"Connected to DB: {db_name}")
        # (Migration Logic from previous step retained here...)
        users_count = await users_collection.count_documents({})
        if users_count > 0:
            await users_collection.update_many({"status": {"$exists": False}}, {"$set": {"status": "active", "role": "admin"}})
            super_admin = await users_collection.find_one({"role": "super_admin"})
            if not super_admin:
                first_user = await users_collection.find_one({}, sort=[("createdAt", 1)])
                if first_user:
                    await users_collection.update_one({"_id": first_user["_id"]}, {"$set": {"role": "super_admin", "status": "active"}})
                    logging.info(f"MIGRATION: {first_user['username']} promu Super Admin.")
    except Exception as e: 
        logging.error(f"DB Connection/Migration Error: {e}")

@app.on_event("shutdown")
async def shutdown(): client.close()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)