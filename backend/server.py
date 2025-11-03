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
    # Dans un vrai cas, on pourrait vouloir arrêter l'app ici
    # raise ValueError("MONGO_URL not set")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]
tournaments_collection = db["tournaments"] # Collection pour stocker les tournois

# --- FastAPI App et Router ---
app = FastAPI(title="Tournament API")
api_router = APIRouter(prefix="/api")

# --- Modèles Pydantic (Structures de données) ---

# Ajout pour éviter les erreurs avec les _id de MongoDB
def to_string_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    return v

class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            # Permet aussi les UUID générés par Pydantic
            if isinstance(v, str) and len(v) == 36: # Typique UUID4
                 return v
            raise ValueError("Invalid ObjectId or UUID")
        return str(v) # Toujours stocker comme string

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")


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
    groupPosition: Optional[int] = None # Position dans le groupe après tri

class GroupMatch(BaseModel):
    id: str = Field(default_factory=lambda: f"match_{uuid.uuid4()}")
    player1: str
    player2: str
    score1: Optional[int] = None
    score2: Optional[int] = None
    played: bool = False

class Group(BaseModel):
    name: str # ex: "A", "B"
    players: List[PlayerStats] # Les joueurs/stats de cette poule
    matches: List[GroupMatch]

class KnockoutMatch(BaseModel):
    id: str = Field(default_factory=lambda: f"match_{uuid.uuid4()}")
    round: int # 0=16èmes, 1=8èmes, 2=Quarts, 3=Demi, 4=Finale
    matchIndex: int # Index dans le tour (0, 1, 2...)
    player1: Optional[str] = None
    player2: Optional[str] = None
    score1: Optional[int] = None
    score2: Optional[int] = None
    winner: Optional[str] = None
    played: bool = False

class Tournament(BaseModel):
    # Utilise PyObjectId pour l'ID si on veut le récupérer de MongoDB,
    # sinon default_factory pour en créer un nouveau.
    # Pour la simplicité, on va juste utiliser un UUID string.
    id: str = Field(default_factory=lambda: f"tournoi_{uuid.uuid4()}", alias="_id")
    name: str = "Tournoi EA FC" # Nom par défaut ou à définir
    players: List[str] # Noms initiaux des joueurs
    groups: List[Group] = []
    knockoutMatches: List[KnockoutMatch] = []
    qualifiedPlayers: List[str] = [] # Noms des joueurs qualifiés
    winner: Optional[str] = None
    thirdPlace : Optional[str] = None
    currentStep: str = "config" # config, groups, qualified, knockout, finished
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True, # Permet d'utiliser alias="_id"
        arbitrary_types_allowed=True, # Nécessaire pour ObjectId si utilisé
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()}
    )


# Modèles pour les requêtes entrantes
class TournamentCreateRequest(BaseModel):
    playerNames: List[str]
    tournamentName: Optional[str] = "Tournoi EA FC"

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

def calculate_optimal_group_distribution(totalPlayers):
    # (Copie de la logique du frontend, à adapter si besoin)
    if totalPlayers < 3: return [totalPlayers]
    if totalPlayers == 3: return [3]
    if totalPlayers == 4: return [4]
    if totalPlayers == 5: return [5]
    if totalPlayers == 6: return [3, 3]
    if totalPlayers == 7: return [4, 3]
    if totalPlayers == 8: return [4, 4]
    if totalPlayers == 9: return [3, 3, 3]
    if totalPlayers == 10: return [5, 5]
    if totalPlayers == 11: return [4, 4, 3] # Ou [5, 3, 3] ou [4, 3, 4]? Reste simple.
    if totalPlayers == 12: return [4, 4, 4]
    if totalPlayers == 13: return [5, 4, 4]
    if totalPlayers == 14: return [5, 5, 4]
    if totalPlayers == 15: return [5, 5, 5]
    # Pour 16+, viser des groupes de 4
    num_groups_4 = math.floor(totalPlayers / 4)
    remainder = totalPlayers % 4
    if remainder == 0: return [4] * num_groups_4
    if remainder == 1: return [5] + [4] * (num_groups_4 - 1) if num_groups_4 > 0 else [5]
    if remainder == 2: return [5, 5] + [4] * (num_groups_4 - 2) if num_groups_4 > 1 else [3, 3] # Préfère 5,5 si possible
    if remainder == 3: return [3] + [4] * num_groups_4
    return [4] # Fallback


def create_groups_logic(players: List[str]) -> List[Group]:
    shuffled = random.sample(players, len(players))
    groupSizes = calculate_optimal_group_distribution(len(shuffled))
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
            name=chr(65 + i), # Equivalent JS: chr(65 + i) en Python
            players=group_players_stats,
            matches=matches
        ))
    return groups

def update_group_standings_logic(group: Group) -> List[PlayerStats]:
    # Réinitialiser les stats avant recalcul
    for p_stat in group.players:
        p_stat.played = 0
        p_stat.won = 0
        p_stat.drawn = 0
        p_stat.lost = 0
        p_stat.goalsFor = 0
        p_stat.goalsAgainst = 0
        p_stat.goalDiff = 0
        p_stat.points = 0

    # Recalculer basé sur les matchs joués
    for match in group.matches:
        if match.played:
            p1_stat = next((p for p in group.players if p.name == match.player1), None)
            p2_stat = next((p for p in group.players if p.name == match.player2), None)
            if not p1_stat or not p2_stat: continue # Sécurité

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

    # Calculer Diff et trier
    for p_stat in group.players:
        p_stat.goalDiff = p_stat.goalsFor - p_stat.goalsAgainst

    sorted_players = sorted(
        group.players,
        key=lambda p: (p.points, p.goalDiff, p.goalsFor),
        reverse=True
    )
    # Assigner la position
    for i, player in enumerate(sorted_players):
        player.groupPosition = i + 1

    return sorted_players


# Fichier: backend/server.py

# ... (imports, etc.)

# (Cette fonction est vers la ligne 246)
def determine_qualifiers_logic(groups: List[Group], total_players: int) -> List[str]:
    # La logique pour déterminer la CIBLE de qualifiés est correcte
    if total_players <= 8: 
         targetQualified = 4
    elif total_players <= 16: 
         targetQualified = 8
    else: 
         targetQualified = 16 if total_players >= 24 else 8 

    qualified = []
    third_placed = [] 
    
    num_groups = len(groups)

    # --- NOUVELLE LOGIQUE DE VÉRIFICATION ---
    # Vérifions si la méthode "Top 2 + Meilleurs 3èmes" est viable
    
    qualifiers_top_2 = num_groups * 2
    
    # Nombre de 3èmes places disponibles (poules de 3+)
    available_third_places = sum(1 for g in groups if len(g.players) > 2)
    
    # Combien de 3èmes il nous faudrait
    needed_if_top_2 = targetQualified - qualifiers_top_2
    
    # Si on a besoin de 3èmes (needed > 0) ET qu'on n'en a pas assez (available < needed)
    if needed_if_top_2 > 0 and available_third_places < needed_if_top_2:
        
        # --- CAS SPÉCIAL (ex: 10 joueurs, 2 poules) ---
        # On passe en mode "Top X par poule"
        
        # Calcule combien de joueurs prendre par poule (arrondi au supérieur)
        qualifiers_per_group = math.ceil(targetQualified / num_groups) 
        
        logging.info(f"Cas spécial détecté: {total_players} joueurs, {num_groups} poules. Passage en mode Top {qualifiers_per_group} par poule.")
        
        all_players_sorted = []
        for group in groups:
            # Met à jour le classement de la poule
            sorted_players_in_group = update_group_standings_logic(group)
            group.players = sorted_players_in_group
            # Ajoute les X premiers
            qualified.extend(p.name for i, p in enumerate(sorted_players_in_group) if i < qualifiers_per_group)

    else:
        # --- LOGIQUE NORMALE (ex: 9, 11, 12, ... joueurs) ---
        logging.info(f"Cas standard: {total_players} joueurs, {num_groups} poules. Mode Top 2 + Meilleurs 3èmes.")
        
        for group in groups:
            # Met à jour le classement de la poule
            sorted_players_in_group = update_group_standings_logic(group)
            group.players = sorted_players_in_group 

            qualified.extend(p.name for i, p in enumerate(sorted_players_in_group) if i < 2) # Prend les 2 premiers
            if len(sorted_players_in_group) > 2:
                third_placed.append(sorted_players_in_group[2]) # Garde le 3ème

        # Calcule le besoin restant
        needed = targetQualified - len(qualified)

        if needed > 0 and third_placed:
            # Trie les 3èmes et prend les meilleurs
            third_placed.sort(key=lambda p: (p.points, p.goalDiff, p.goalsFor), reverse=True)
            qualified.extend(p.name for p in third_placed[:needed])
    
    # S'assurer qu'on ne dépasse pas la cible (au cas où "ceil" en prendrait trop)
    return qualified[:targetQualified]

# ... (Reste du fichier server.py inchangé) ...


def generate_knockout_matches_logic(qualified_player_names: List[str]) -> List[KnockoutMatch]:
    num_players = len(qualified_player_names)
    if num_players not in [4, 8, 16]:
        # Gérer ce cas ? Pour l'instant, erreur ou ajustement simple.
        # Idéalement, la logique de qualif assure 4, 8 ou 16.
        logging.warning(f"Nombre de qualifiés inattendu: {num_players}. Le tableau pourrait être déséquilibré.")

    shuffled = random.sample(qualified_player_names, num_players)
    total_rounds = math.ceil(math.log2(num_players))
    matches = []
    match_id_counter = 0

    # 1er tour (peut être 8èmes, Quarts, ou Demi selon num_players)
    first_round_matches = num_players // 2
    round_index = 0 # 0 = 1er tour joué (ex: 8èmes si 16 joueurs)

    for i in range(first_round_matches):
        matches.append(KnockoutMatch(
            id=f"match_{uuid.uuid4()}",
            round=round_index,
            matchIndex=i,
            player1=shuffled[i*2],
            player2=shuffled[i*2+1],
        ))

    # Tours suivants (vides)
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
            id=f"match_third_place_{uuid.uuid4()}", # ID spécifique
            round=final_round_index,  # Même round que la finale
            matchIndex=1,             # Index différent de la finale (qui sera 0)
            player1=None,             # Sera rempli plus tard
            player2=None,             # Sera rempli plus tard
        ))
    return matches

# --- Routes API ---

@api_router.post("/tournament", response_model=Tournament, status_code=201)
async def create_tournament(request: TournamentCreateRequest):
    """
    Crée un nouveau tournoi avec la liste des joueurs.
    Génère les poules initiales mais ne les sauvegarde pas encore finalisées.
    """
    player_names = request.playerNames
    if len(set(player_names)) != len(player_names):
        raise HTTPException(status_code=400, detail="Les noms des joueurs doivent être uniques")

    # Crée la structure initiale du tournoi
    new_tournament = Tournament(
        name=request.tournamentName or f"Tournoi du {datetime.now(timezone.utc).strftime('%d/%m/%Y')}",
        players=player_names,
        currentStep="groups", # On passe directement à l'étape des groupes
    )

    # Génère les groupes logiquement mais ne les assigne pas tout de suite
    # Le frontend appellera une autre route pour "tirer au sort"
    # Ici on pourrait juste pré-calculer la structure si besoin

    # Sauvegarde dans MongoDB
    tournament_dict = new_tournament.model_dump(by_alias=True) # Utilise _id
    # Assure que les dates sont bien stockées comme dates
    tournament_dict["createdAt"] = new_tournament.createdAt
    tournament_dict["updatedAt"] = new_tournament.updatedAt

    inserted_result = await tournaments_collection.insert_one(tournament_dict)
    created_tournament = await tournaments_collection.find_one({"_id": inserted_result.inserted_id})

    # Convertir _id en string pour la réponse Pydantic
    if created_tournament and "_id" in created_tournament:
        created_tournament["id"] = str(created_tournament["_id"])

    return Tournament(**created_tournament)

@api_router.get("/tournament/active", response_model=Tournament)
async def get_active_tournament():
    """ Récupère le dernier tournoi actif (le plus récent). """
    # Trie par date de création descendante et prend le premier
    tournament = await tournaments_collection.find_one(
        {}, # Pas de filtre
        sort=[("createdAt", -1)] # Trie par 'createdAt' descendant
    )
    
    if tournament:
        # Convertir _id en string pour Pydantic
        tournament["id"] = str(tournament["_id"])
        return Tournament(**tournament)
    
    # Si aucun tournoi n'est trouvé
    raise HTTPException(status_code=404, detail="Aucun tournoi actif trouvé")
    
@api_router.get("/tournament/{tournament_id}", response_model=Tournament)
async def get_tournament(tournament_id: str):
    """ Récupère l'état complet d'un tournoi par son ID. """
    tournament = await tournaments_collection.find_one({"_id": tournament_id})
    if tournament:
        # Convertir _id en string pour Pydantic
        tournament["id"] = str(tournament["_id"])
        return Tournament(**tournament)
    raise HTTPException(status_code=404, detail=f"Tournoi '{tournament_id}' non trouvé")


@api_router.post("/tournament/{tournament_id}/draw_groups", response_model=Tournament)
async def draw_groups(tournament_id: str):
    """ Tire au sort et sauvegarde les groupes pour un tournoi existant. """
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")

    tournament = Tournament(**tournament_data) # Charge les données existantes

    if tournament.currentStep != "groups" or tournament.groups:
         raise HTTPException(status_code=400, detail="Les groupes ont déjà été tirés ou étape invalide.")

    # Générer les groupes et les matchs
    generated_groups = create_groups_logic(tournament.players)
    tournament.groups = generated_groups
    tournament.updatedAt = datetime.now(timezone.utc)

    # Mettre à jour dans MongoDB
    update_data = {
        "$set": {
            "groups": [g.model_dump() for g in generated_groups],
            "updatedAt": tournament.updatedAt
        }
    }
    await tournaments_collection.update_one({"_id": tournament_id}, update_data)

    # Recharger pour être sûr
    updated_tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    updated_tournament_data["id"] = str(updated_tournament_data["_id"])
    return Tournament(**updated_tournament_data)


@api_router.post("/tournament/{tournament_id}/match/{match_id}/score", response_model=Tournament)
async def update_match_score(tournament_id: str, match_id: str, scores: ScoreUpdateRequest):
    """ Met à jour le score d'un match (poule ou knockout) et recalcule/avance. """
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")

    # Utiliser un dict pour la manipulation directe est plus simple ici
    tournament = tournament_data # C'est déjà un dict

    match_found = False
    is_knockout = False

    # Chercher dans les groupes
    if tournament.get("groups"):
        for group in tournament["groups"]:
            if group.get("matches"):
                for match in group["matches"]:
                    if match.get("id") == match_id:
                        if match.get("played") and match.get("score1") == scores.score1 and match.get("score2") == scores.score2:
                            # Pas de changement, on renvoie l'état actuel
                            tournament["id"] = str(tournament["_id"])
                            return Tournament(**tournament)

                        match["score1"] = scores.score1
                        match["score2"] = scores.score2
                        match["played"] = True
                        match_found = True
                        # Recalculer les classements du groupe affecté
                        updated_standings = update_group_standings_logic(Group(**group))
                        # Mettre à jour les joueurs dans le dict du tournoi
                        group["players"] = [p.model_dump() for p in updated_standings]
                        break
            if match_found: break

    # Chercher dans le knockout si pas trouvé dans les groupes
    if not match_found and tournament.get("knockoutMatches"):
        is_knockout = True
        for match in tournament["knockoutMatches"]:
             if match.get("id") == match_id:
                if match.get("played") and match.get("score1") == scores.score1 and match.get("score2") == scores.score2:
                     tournament["id"] = str(tournament["_id"])
                     return Tournament(**tournament)
                
                # --- CORRECTION : Logique de nul déplacée ---
                # On ne vérifie le nul que si c'est la finale ou 3e place
                # (On doit calculer les rounds d'abord)

                match["score1"] = scores.score1
                match["score2"] = scores.score2
                match["played"] = True

                # --- CORRECTION : Définir gagnant ET perdant ---
                # Gérer le cas du nul AVANT de définir gagnant/perdant
                
                winner = None
                loser = None

                if scores.score1 > scores.score2:
                    winner = match["player1"]
                    loser = match["player2"]
                elif scores.score2 > scores.score1:
                    winner = match["player2"]
                    loser = match["player1"]
                else:
                    # Le score est nul. On doit vérifier si c'est autorisé.
                    # Calculer total_rounds pour savoir si c'est la finale/3e place
                    qualified_players_list = tournament.get("qualifiedPlayers", [])
                    if not isinstance(qualified_players_list, list): qualified_players_list = []
                    num_qualified = len(qualified_players_list)
                    total_rounds = 0
                    if num_qualified > 0: total_rounds = math.ceil(math.log2(num_qualified))
                    
                    if total_rounds == 0: # Fallback si qualifiés non trouvés
                         all_rounds = [m["round"] for m in tournament["knockoutMatches"] if not m["id"].startswith("match_third_place_")]
                         if all_rounds: total_rounds = max(all_rounds) + 1

                    final_round_index = total_rounds - 1
                    is_final_or_third = match["id"].startswith("match_third_place_") or match["round"] == final_round_index

                    if is_final_or_third:
                         raise HTTPException(status_code=400, detail="Match nul interdit en phase finale (Finale / 3ème place)")
                    else:
                         # Si ce n'est NI la finale NI la 3e place, le nul est aussi interdit
                         # (La logique de l'app frontale l'interdit partout, on suit)
                         raise HTTPException(status_code=400, detail="Match nul interdit en phase finale")


                match["winner"] = winner
                match_found = True

                # --- NOUVELLE LOGIQUE D'AVANCEMENT ---

                current_round = match["round"]
                current_match_index = match["matchIndex"]

                # Recalculer total_rounds (basé sur le nombre de qualifiés)
                qualified_players_list = tournament.get("qualifiedPlayers", [])
                if not isinstance(qualified_players_list, list): qualified_players_list = []
                
                num_qualified = len(qualified_players_list)
                total_rounds = 0
                if num_qualified > 0:
                     total_rounds = math.ceil(math.log2(num_qualified)) # ex: 8 joueurs -> log2(8) = 3 rounds (0, 1, 2)
                
                if total_rounds == 0:
                     all_rounds = [m["round"] for m in tournament["knockoutMatches"] if not m["id"].startswith("match_third_place_")]
                     if all_rounds:
                         total_rounds = max(all_rounds) + 1 

                semi_final_round_index = total_rounds - 2 # ex: 3 rounds (0,1,2) -> 3-2 = round 1.
                final_round_index = total_rounds - 1    # ex: 3 rounds (0,1,2) -> 3-1 = round 2.

                # 1. Si c'est la petite finale qui vient d'être jouée
                if match["id"].startswith("match_third_place_"):
                    tournament["thirdPlace"] = winner
                    # Ne fait avancer personne d'autre

                # 2. Si c'est une demi-finale (et qu'on a un tableau d'au moins 4)
                elif current_round == semi_final_round_index and num_qualified >= 4:
                    # Envoyer le PERDANT à la petite finale
                    petite_finale_match = next((m for m in tournament["knockoutMatches"] if m["id"].startswith("match_third_place_")), None)
                    if petite_finale_match:
                        # Placer le perdant dans le premier slot libre
                        if petite_finale_match.get("player1") is None:
                            petite_finale_match["player1"] = loser
                        elif petite_finale_match.get("player2") is None:
                            petite_finale_match["player2"] = loser
                    
                    # Envoyer le GAGNANT à la finale (logique ci-dessous)
                    next_round_index = current_round + 1 # -> final_round_index
                    next_match_index = current_match_index // 2
                    finale_match = next((m for m in tournament["knockoutMatches"]
                                           if m["round"] == next_round_index and m["matchIndex"] == next_match_index), None)
                    if finale_match:
                        if current_match_index % 2 == 0:
                            finale_match["player1"] = winner
                        else:
                            finale_match["player2"] = winner

                # 3. Si c'est la finale qui vient d'être jouée
                elif current_round == final_round_index:
                    tournament["winner"] = winner
                    tournament["currentStep"] = "finished"
                    # Ne fait avancer personne d'autre

                # 4. Tous les autres matchs (Quarts, 8èmes, etc.)
                else:
                    # Avancer le GAGNANT au tour suivant
                    next_round_index = current_round + 1
                    next_match_index = current_match_index // 2
                    next_match = next((m for m in tournament["knockoutMatches"]
                                       if m["round"] == next_round_index and m["matchIndex"] == next_match_index), None)
                    if next_match:
                        if current_match_index % 2 == 0:
                            next_match["player1"] = winner
                        else:
                            next_match["player2"] = winner
                
                break # Sortir de la boucle 'for match in tournament["knockoutMatches"]'
                # --- FIN DE LA NOUVELLE LOGIQUE ---

    if not match_found:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' non trouvé dans ce tournoi")

    # Mettre à jour la date et sauvegarder tout le tournoi
    tournament["updatedAt"] = datetime.now(timezone.utc)
    await tournaments_collection.update_one({"_id": tournament_id}, {"$set": tournament})

    # Recharger pour la réponse
    updated_tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    updated_tournament_data["id"] = str(updated_tournament_data["_id"])
    return Tournament(**updated_tournament_data)


@api_router.post("/tournament/{tournament_id}/complete_groups", response_model=Tournament)
async def complete_groups_and_draw_knockout(tournament_id: str):
    """ Finalise les groupes, détermine les qualifiés et génère le tableau knockout. """
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")

    tournament = Tournament(**tournament_data) # Charge en Pydantic pour utiliser la logique

    # Vérifier si tous les matchs de poule sont joués
    all_played = all(m.played for g in tournament.groups for m in g.matches)
    if not all_played:
        raise HTTPException(status_code=400, detail="Tous les matchs de poule ne sont pas encore joués")

    if tournament.currentStep != "groups":
         raise HTTPException(status_code=400, detail="Action invalide pour l'étape actuelle du tournoi")


    # Déterminer les qualifiés
    qualified_names = determine_qualifiers_logic(tournament.groups, len(tournament.players))
    tournament.qualifiedPlayers = qualified_names
    tournament.currentStep = "qualified" # Marquer comme qualifié avant de générer le tableau

    # Générer le tableau knockout
    knockout_matches = generate_knockout_matches_logic(qualified_names)
    tournament.knockoutMatches = knockout_matches
    tournament.currentStep = "knockout" # Passer à l'étape knockout

    tournament.updatedAt = datetime.now(timezone.utc)

    # Mettre à jour dans MongoDB (en convertissant les objets Pydantic en dicts)
    update_data = {
        "$set": {
            "groups": [g.model_dump() for g in tournament.groups], # Sauvegarder les classements finaux
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


# --- Routes Status (Exemple initial, peut être gardé ou supprimé) ---
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

@api_router.post("/tournament/{tournament_id}/redraw_knockout", response_model=Tournament)
async def redraw_knockout_bracket(tournament_id: str):
    """
    Regénère le tableau final (knockout) en re-mélangeant les qualifiés existants.
    Ne recalcule pas les qualifiés.
    """
    tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")

    tournament = Tournament(**tournament_data) # Charge en Pydantic

    # Vérifications de sécurité
    if tournament.currentStep not in ["knockout", "finished"]:
         raise HTTPException(status_code=400, detail="Le tableau final n'a pas encore été généré.")
         
    if not tournament.qualifiedPlayers:
         raise HTTPException(status_code=400, detail="Aucun joueur qualifié trouvé à mélanger.")

    # Vérifier si des matchs ont déjà été joués
    if any(m.played for m in tournament.knockoutMatches):
        raise HTTPException(status_code=400, detail="Impossible de relancer le tirage, des matchs finaux ont déjà été joués.")

    # --- Logique principale ---
    # On regénère les matchs en utilisant la liste des qualifiés DÉJÀ SAUVEGARDÉE
    logging.info(f"Regénération du tableau pour le tournoi {tournament_id} avec {len(tournament.qualifiedPlayers)} qualifiés.")
    new_knockout_matches = generate_knockout_matches_logic(tournament.qualifiedPlayers)
    
    tournament.knockoutMatches = new_knockout_matches
    tournament.updatedAt = datetime.now(timezone.utc)

    # Mettre à jour dans MongoDB
    update_data = {
        "$set": {
            "knockoutMatches": [m.model_dump() for m in new_knockout_matches],
            "updatedAt": tournament.updatedAt
            # On ne touche ni au vainqueur, ni au currentStep, ni à la 3e place
        }
    }
    await tournaments_collection.update_one({"_id": tournament_id}, update_data)

    updated_tournament_data = await tournaments_collection.find_one({"_id": tournament_id})
    updated_tournament_data["id"] = str(updated_tournament_data["_id"])
    return Tournament(**updated_tournament_data)

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

# Configuration CORS (Très important pour que le frontend puisse appeler l'API)
# Lignes à ajouter (remplacent les lignes 541-546)
origins = [
    "https://tournoi-fc26-1.onrender.com",  # <--- L'URL exacte de VOTRE FRONTEND
    "http://localhost:3000",             # Pour vos tests en local
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Autorise toutes les origines ou celles spécifiées
    allow_credentials=True,
    allow_methods=["*"], # Autorise toutes les méthodes (GET, POST, etc.)
    allow_headers=["*"], # Autorise tous les headers
)

# --- Logging et Shutdown ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db_client():
    # Log simple pour confirmer le démarrage et la connexion
    try:
        # Tenter une opération simple pour vérifier la connexion
        await client.admin.command('ping')
        logger.info(f"Connecté à MongoDB - Base de données: {db_name}")
    except Exception as e:
        logger.error(f"Erreur de connexion à MongoDB: {e}")
        # Potentiellement arrêter l'app si la DB est critique
        # raise HTTPException(status_code=500, detail="Database connection failed")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    logger.info("Connexion MongoDB fermée.")

# --- Point d'entrée pour Uvicorn (si lancé directement) ---
if __name__ == "__main__":
    import uvicorn
    # Utilise le port défini par Render (ou 8000 par défaut)
    port = int(os.environ.get("PORT", 8000))
    # Note: La commande de démarrage de Render ('uvicorn server:app --host 0.0.0.0 --port 10000')
    # prendra le dessus sur ce bloc if __name__ == "__main__".
    # Ce bloc est utile pour le développement local.
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
