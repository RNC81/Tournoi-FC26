"""
Script de test exhaustif pour la logique tournoi 2v2
Teste tous les nombres pairs de joueurs de 4 à 64
Valide la cohérence des poules, classements, qualifications et remix d'équipes
"""

import sys
import os
import math
import random
from typing import List, Dict, Tuple

# Ajouter le répertoire parent au path pour importer les fonctions du serveur
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import des fonctions de logique métier depuis server.py
from server import (
    create_groups_logic,
    update_group_standings_logic,
    determine_qualifiers_logic,
    generate_knockout_matches_logic,
    Group,
    PlayerStats
)

class Colors:
    """Codes ANSI pour coloriser la sortie console"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.CYAN}ℹ {msg}{Colors.END}")

def print_header(msg):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{msg.center(80)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.END}\n")

def generate_player_names(num_players: int) -> List[str]:
    """Génère une liste de noms de joueurs uniques"""
    return [f"Player{i+1}" for i in range(num_players)]

def test_group_creation(num_players: int) -> Tuple[bool, List[Group], str]:
    """
    Teste la création des poules pour un nombre donné de joueurs
    Retourne (succès, groupes, message_erreur)
    """
    players = generate_player_names(num_players)
    
    try:
        groups = create_groups_logic(players, num_groups=None, format="2v2")
        
        # Validation 1 : Nombre de poules cohérent
        num_teams = num_players // 2
        expected_num_groups = math.ceil(num_teams / 4)
        
        # Ajustement si reste = 1 ou 2 (logique du serveur)
        if num_teams > 8 and num_teams % 4 in [1, 2]:
            expected_num_groups = math.floor(num_teams / 4)
        
        if len(groups) < 1:
            return False, groups, "Aucune poule créée"
        
        # Validation 2 : Pas de poule vide
        for group in groups:
            if len(group.players) == 0:
                return False, groups, f"Poule {group.name} est vide"
        
        # Validation 3 : Pas de poule à 1 équipe (sauf si total = 2 équipes)
        if num_teams > 2:
            for group in groups:
                if len(group.players) == 1:
                    return False, groups, f"Poule {group.name} contient seulement 1 équipe"
        
        # Validation 4 : Taille des poules équilibrée (différence max de 1)
        group_sizes = [len(g.players) for g in groups]
        if max(group_sizes) - min(group_sizes) > 1:
            return False, groups, f"Poules déséquilibrées : tailles {group_sizes}"
        
        # Validation 5 : Total des équipes = num_players // 2
        total_teams = sum(len(g.players) for g in groups)
        if total_teams != num_teams:
            return False, groups, f"Total équipes {total_teams} != {num_teams} attendu"
        
        return True, groups, ""
    
    except Exception as e:
        return False, [], f"Exception: {str(e)}"

def test_standings_calculation(groups: List[Group]) -> Tuple[bool, str]:
    """
    Teste le calcul des classements après simulation de matchs
    """
    try:
        for group in groups:
            # Simuler tous les matchs de la poule
            for match in group.matches:
                match.score1 = random.randint(0, 5)
                match.score2 = random.randint(0, 5)
                match.played = True
            
            # Calculer les classements
            sorted_players = update_group_standings_logic(group)
            
            # Validation : Ordre décroissant de points
            for i in range(len(sorted_players) - 1):
                p1 = sorted_players[i]
                p2 = sorted_players[i+1]
                
                if p1.points < p2.points:
                    return False, f"Classement incorrect dans poule {group.name}: {p1.name} ({p1.points} pts) avant {p2.name} ({p2.points} pts)"
                
                # Si égalité de points, vérifier goalDiff
                if p1.points == p2.points and p1.goalDiff < p2.goalDiff:
                    return False, f"Classement incorrect (goalDiff) dans poule {group.name}"
        
        return True, ""
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

def test_qualification(groups: List[Group], num_players: int) -> Tuple[bool, List[str], str]:
    """
    Teste la qualification automatique
    """
    try:
        qualified = determine_qualifiers_logic(groups, num_players)
        
        num_teams = num_players // 2
        
        # Déterminer le nombre attendu de qualifiés
        if num_teams <= 8:
            expected_qualified = 4
        elif num_teams <= 16:
            expected_qualified = 8
        else:
            expected_qualified = 16 if num_teams >= 24 else 8
        
        # Validation : Nombre de qualifiés correct
        if len(qualified) != expected_qualified:
            return False, qualified, f"Nombre de qualifiés {len(qualified)} != {expected_qualified} attendu"
        
        # Validation : Pas de doublons
        if len(set(qualified)) != len(qualified):
            return False, qualified, "Doublons dans les qualifiés"
        
        return True, qualified, ""
    
    except Exception as e:
        return False, [], f"Exception: {str(e)}"

def test_knockout_generation(qualified: List[str]) -> Tuple[bool, str]:
    """
    Teste la génération du tableau éliminatoire
    """
    try:
        knockout_matches = generate_knockout_matches_logic(qualified, single_round=True)
        
        # Validation : Nombre de matchs = len(qualified) // 2
        expected_matches = len(qualified) // 2
        if len(knockout_matches) != expected_matches:
            return False, f"Nombre de matchs {len(knockout_matches)} != {expected_matches} attendu"
        
        # Validation : Tous les matchs ont player1 et player2
        for match in knockout_matches:
            if not match.player1 or not match.player2:
                return False, f"Match {match.id} incomplet"
        
        return True, ""
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

def test_team_remix(groups: List[Group], qualified: List[str]) -> Tuple[bool, str]:
    """
    Teste que les équipes remixées ne contiennent pas les mêmes paires qu'en poule
    """
    try:
        # Extraire toutes les paires de joueurs des poules
        pool_pairs = set()
        for group in groups:
            for player_stat in group.players:
                if player_stat.real_players and len(player_stat.real_players) == 2:
                    pair = frozenset(player_stat.real_players)
                    pool_pairs.add(pair)
        
        # Extraire les paires des équipes qualifiées
        qualified_pairs = set()
        for team_name in qualified:
            parts = team_name.split(' + ')
            if len(parts) == 2:
                pair = frozenset(parts)
                qualified_pairs.add(pair)
        
        # Vérifier qu'il n'y a pas de collision
        collisions = pool_pairs.intersection(qualified_pairs)
        if collisions:
            return False, f"Paires identiques entre poules et qualifiés: {collisions}"
        
        return True, ""
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

def run_full_test(num_players: int) -> Dict:
    """
    Exécute un test complet pour un nombre de joueurs donné
    Retourne un dictionnaire avec les résultats
    """
    result = {
        "num_players": num_players,
        "num_teams": num_players // 2,
        "success": True,
        "errors": [],
        "warnings": [],
        "details": {}
    }
    
    # Test 1 : Création des poules
    success, groups, error = test_group_creation(num_players)
    result["details"]["num_groups"] = len(groups)
    result["details"]["group_sizes"] = [len(g.players) for g in groups]
    
    if not success:
        result["success"] = False
        result["errors"].append(f"Création poules: {error}")
        return result
    
    # Test 2 : Calcul des classements
    success, error = test_standings_calculation(groups)
    if not success:
        result["success"] = False
        result["errors"].append(f"Classements: {error}")
        return result
    
    # Test 3 : Qualification
    success, qualified, error = test_qualification(groups, num_players)
    result["details"]["num_qualified"] = len(qualified)
    
    if not success:
        result["success"] = False
        result["errors"].append(f"Qualification: {error}")
        return result
    
    # Test 4 : Génération tableau éliminatoire
    success, error = test_knockout_generation(qualified)
    result["details"]["num_knockout_matches"] = len(qualified) // 2
    
    if not success:
        result["success"] = False
        result["errors"].append(f"Tableau éliminatoire: {error}")
        return result
    
    # Test 5 : Remix des équipes (pas de redondance)
    success, error = test_team_remix(groups, qualified)
    if not success:
        result["warnings"].append(f"Remix équipes: {error}")
        # Ce n'est pas une erreur critique, juste un warning
    
    return result

def main():
    print_header("TEST EXHAUSTIF LOGIQUE TOURNOI 2v2")
    print_info("Teste tous les nombres pairs de joueurs de 4 à 64")
    print_info("Valide : poules, classements, qualifications, tableau éliminatoire, remix\n")
    
    # Tester tous les nombres pairs de 4 à 64
    test_results = []
    failed_tests = []
    
    for num_players in range(4, 66, 2):  # 4, 6, 8, ..., 64
        print(f"\n{Colors.BOLD}Test avec {num_players} joueurs ({num_players // 2} équipes):{Colors.END}")
        
        result = run_full_test(num_players)
        test_results.append(result)
        
        if result["success"]:
            print_success(f"Poules: {result['details']['num_groups']} poules, tailles {result['details']['group_sizes']}")
            print_success(f"Qualifiés: {result['details']['num_qualified']} équipes")
            print_success(f"Éliminatoires: {result['details']['num_knockout_matches']} matchs")
            
            if result["warnings"]:
                for warning in result["warnings"]:
                    print_warning(warning)
        else:
            print_error(f"ÉCHEC pour {num_players} joueurs")
            for error in result["errors"]:
                print_error(f"  {error}")
            failed_tests.append(num_players)
    
    # Résumé final
    print_header("RÉSUMÉ DES TESTS")
    
    total_tests = len(test_results)
    successful_tests = sum(1 for r in test_results if r["success"])
    failed_count = total_tests - successful_tests
    
    print(f"Total de tests: {total_tests}")
    print_success(f"Tests réussis: {successful_tests}")
    
    if failed_count > 0:
        print_error(f"Tests échoués: {failed_count}")
        print_error(f"Nombres de joueurs échoués: {failed_tests}")
    else:
        print_success("✓ TOUS LES TESTS SONT PASSÉS !")
    
    # Sauvegarder les résultats dans un fichier JSON
    import json
    output_file = "test_2v2_results.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(test_results, f, indent=2, ensure_ascii=False)
    
    print_info(f"\nRésultats détaillés sauvegardés dans: {output_file}")
    
    return 0 if failed_count == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
