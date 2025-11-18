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
        raise HTTPException(
            status_code=401,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not verify_password(user_in.password, user.hashed_password):
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
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        logging.error(f"ERREUR JWT: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur interne du serveur")

# --- Fonctions Utilitaires (Tournoi) ---

def create_groups_logic(players: List[str], num_groups: Optional[int] = None) -> List[Group]:
    totalPlayers = len(players)
    if num_groups is None or num_groups <= 1:
        num_groups = math.ceil(totalPlayers / 4)
        if totalPlayers > 8 and totalPlayers % 4 in [1, 2]:
             num_groups = math.floor(totalPlayers / 4) 
        logging.info(f"Calcul auto: {totalPlayers} joueurs -> {num_groups} poules")
    else:
        logging.info(f"Calcul manuel: {totalPlayers} joueurs -> {num_groups} poules")
    shuffled = random.sample(players, totalPlayers)
    base_size = totalPlayers // num_groups
    remainder = totalPlayers % num_groups
    groupSizes = []
    for i in range(num_groups):
        groupSizes.append(base_size + 1 if i < remainder else base_size)
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

def determine_qualifiers_logic(groups: List[Group], total_players: int) -> List[str]:
    if total_players <= 8: targetQualified = 4
    elif total_players <= 16: targetQualified = 8
    else: targetQualified = 16 if total_players >= 24 else 8 
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
        base_qualifiers = math.floor(targetQualified / num_groups)
        pool = []
        for group in groups:
            sorted_p = update_group_standings_logic(group)
            group.players = sorted_p 
            for i, p in enumerate(sorted_p):
                if i < base_qualifiers: qualified.append(p.name)
                else: pool.append(p) 
        needed = targetQualified - len(qualified)
        if needed > 0 and pool:
            pool.sort(key=lambda p: (p.points, p.goalDiff, p.goalsFor), reverse=True)
            qualified.extend(p.name for p in pool[:needed])
    return qualified[:targetQualified]

def generate_knockout_matches_logic(qualified_player_names: List[str]) -> List[KnockoutMatch]:
    num = len(qualified_player_names)
    if num == 0: return []
    shuffled = random.sample(qualified_player_names, num)
    total_rounds = math.ceil(math.log2(num)) if num > 0 else 0
    matches = []
    first_round_matches = num // 2
    round_idx = 0 
    for i in range(first_round_matches):
        matches.append(KnockoutMatch(id=f"match_{uuid.uuid4()}", round=round_idx, matchIndex=i, player1=shuffled[i*2], player2=shuffled[i*2+1]))
    matches_in_round = first_round_matches // 2
    while matches_in_round >= 1:
        round_idx += 1
        for i in range(matches_in_round):
             matches.append(KnockoutMatch(id=f"match_{uuid.uuid4()}", round=round_idx, matchIndex=i))
        matches_in_round //= 2
    if num >= 4:
        matches.append(KnockoutMatch(id=f"match_third_place_{uuid.uuid4()}", round=total_rounds-1, matchIndex=1, player1=None, player2=None))
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
    
    t_dict = new_tournament.model_dump(by_alias=True)
    t_dict["createdAt"] = new_tournament.createdAt; t_dict["updatedAt"] = new_tournament.updatedAt
    res = await tournaments_collection.insert_one(t_dict)
    created = await tournaments_collection.find_one({"_id": res.inserted_id})
    if created: created["_id"] = str(created["_id"])
    return Tournament(**created)

# --- NOUVELLE ROUTE DE SUPPRESSION ---
@api_router.delete("/tournament/{tournament_id}", status_code=204)
async def delete_tournament(
    tournament_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Supprime un tournoi.
    Seul le propriétaire (owner_username) peut le supprimer.
    """
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    
    # Vérification de propriété
    if tournament_data.get("owner_username") != current_user.username:
        raise HTTPException(status_code=403, detail="Vous n'avez pas la permission de supprimer ce tournoi.")
    
    # Suppression
    await tournaments_collection.delete_one({"_id": tournament_id})
    logging.info(f"Tournoi {tournament_id} supprimé par {current_user.username}")
    return # Renvoie 204 No Content

# --- FIN NOUVELLE ROUTE ---

@api_router.get("/tournaments/public", response_model=List[Tournament])
async def get_public_tournaments():
    tournaments = await tournaments_collection.find(
        {}, 
        sort=[("createdAt", -1)]
    ).limit(20).to_list(20)
    for t in tournaments:
        t["_id"] = str(t["_id"])
    return tournaments

@api_router.get("/tournaments/my-tournaments", response_model=List[Tournament])
async def get_my_tournaments(current_user: UserInDB = Depends(get_current_user)):
    tournaments = await tournaments_collection.find(
        {"owner_username": current_user.username},
        sort=[("createdAt", -1)]
    ).to_list(1000)
    for t in tournaments:
        t["_id"] = str(t["_id"])
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
                else:
                     qualif = tournament.get("qualifiedPlayers", [])
                     total_rounds = math.ceil(math.log2(len(qualif))) if qualif else 0
                     if total_rounds == 0: 
                         all_rounds = [m["round"] for m in tournament["knockoutMatches"] if not m["id"].startswith("match_third_place_")]
                         if all_rounds: total_rounds = max(all_rounds) + 1
                     final_round = total_rounds - 1
                     is_final_or_third = match["id"].startswith("match_third_place_") or (match["round"] == final_round and final_round >= 0)
                     if is_final_or_third: raise HTTPException(status_code=400, detail="Match nul interdit en phase finale")
                     else: raise HTTPException(status_code=400, detail="Match nul interdit")
                
                match["winner"] = winner
                match_found = True
                
                current_round = match["round"]
                current_idx = match["matchIndex"]
                qualif = tournament.get("qualifiedPlayers", [])
                total_rounds = math.ceil(math.log2(len(qualif))) if qualif else 0
                if total_rounds == 0:
                     all_rounds = [m["round"] for m in tournament["knockoutMatches"] if not m["id"].startswith("match_third_place_")]
                     if all_rounds: total_rounds = max(all_rounds) + 1
                
                semi_final = total_rounds - 2 if total_rounds > 0 else -1
                final_round = total_rounds - 1 if total_rounds > 0 else -1

                if match["id"].startswith("match_third_place_"):
                    tournament["thirdPlace"] = winner
                elif current_round == semi_final and len(qualif) >= 4:
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
                elif current_round == final_round and final_round != -1:
                    tournament["winner"] = winner
                    tournament["currentStep"] = "finished"
                elif final_round != -1:
                    next_round = current_round + 1
                    next_idx = current_idx // 2
                    next_m = next((m for m in tournament["knockoutMatches"] if m["round"] == next_round and m["matchIndex"] == next_idx), None)
                    if next_m:
                        if current_idx % 2 == 0: next_m["player1"] = winner
                        else: next_m["player2"] = winner
                break

    if not match_found: raise HTTPException(status_code=404, detail=f"Match '{match_id}' non trouvé")
    
    tournament["updatedAt"] = datetime.now(timezone.utc)
    await tournaments_collection.update_one({"_id": tournament_id}, {"$set": tournament})
    res = await tournaments_collection.find_one({"_id": tournament_id})
    res["_id"] = str(res["_id"])
    return Tournament(**res)

@api_router.post("/tournament/{tournament_id}/complete_groups", response_model=Tournament)
async def complete_groups_and_draw_knockout(tournament_id: str):
    t = await tournaments_collection.find_one({"_id": tournament_id})
    if not t: raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = Tournament(**t)
    if not all(m.played for g in tournament.groups for m in g.matches):
        raise HTTPException(status_code=400, detail="Tous les matchs de poule ne sont pas encore joués")
    if tournament.currentStep != "groups":
         raise HTTPException(status_code=400, detail="Action invalide")
    
    qualif = determine_qualifiers_logic(tournament.groups, len(tournament.players))
    tournament.qualifiedPlayers = qualif
    tournament.currentStep = "qualified"
    tournament.knockoutMatches = generate_knockout_matches_logic(qualif)
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

@api_router.post("/tournament/{tournament_id}/redraw_knockout", response_model=Tournament)
async def redraw_knockout_bracket(tournament_id: str):
    t = await tournaments_collection.find_one({"_id": tournament_id})
    if not t: raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    tournament = Tournament(**t)
    if tournament.currentStep not in ["knockout", "finished"]:
         raise HTTPException(status_code=400, detail="Tableau final non généré.")
    if any(m.played for m in tournament.knockoutMatches):
        raise HTTPException(status_code=400, detail="Impossible: matchs déjà joués.")
    
    new_km = generate_knockout_matches_logic(tournament.qualifiedPlayers)
    tournament.knockoutMatches = new_km
    tournament.updatedAt = datetime.now(timezone.utc)
    update_data = {"$set": {"knockoutMatches": [m.model_dump() for m in new_km], "updatedAt": tournament.updatedAt}}
    await tournaments_collection.update_one({"_id": tournament_id}, update_data)
    res = await tournaments_collection.find_one({"_id": tournament_id})
    res["_id"] = str(res["_id"])
    return Tournament(**res)

# --- Status ---
@api_router.get("/status")
async def get_status_checks(): return {"status": "ok"}

# --- CORS ---
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