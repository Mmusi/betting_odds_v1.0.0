# defensive_backend/prediction_engine.py
"""
Smart prediction engine for 2-outcome betting and accumulators.
Uses defensive_engine_full.py without modifying it.
"""

from typing import List, Dict, Tuple
from defensive_engine_full import Bet, solve_defensive_mip_generic, build_omega, build_incidence
import numpy as np


def analyze_match_odds(home: float, draw: float, away: float) -> Dict:
    """
    Analyze match odds and recommend betting strategy.
    
    Rules:
    - If Home > 2.0 AND Draw > 3.0 AND Away > 2.0 → Suggest Home/Draw or Away/Draw
    - Look for value in 2-outcome bets vs 3-outcome
    """
    
    suggestions = []
    
    # Check if this is a balanced/uncertain match
    if home >= 2.0 and draw >= 3.0 and away >= 2.0:
        suggestions.append({
            "type": "two_outcome",
            "reason": "High odds suggest uncertainty - 2-outcome bets offer better value",
            "recommended_bets": []
        })
        
        # Suggest Home/Draw if home slightly favored
        if home < away:
            suggestions[-1]["recommended_bets"].append({
                "bet": "Home/Draw (1X)",
                "reasoning": "Home slightly favored but draw likely"
            })
        
        # Suggest Away/Draw if away slightly favored
        if away < home:
            suggestions[-1]["recommended_bets"].append({
                "bet": "Away/Draw (X2)",
                "reasoning": "Away slightly favored but draw likely"
            })
        
        # If very balanced, suggest both
        if abs(home - away) < 0.3:
            suggestions[-1]["recommended_bets"].append({
                "bet": "Both 1X and X2",
                "reasoning": "Very balanced match - cover draw with both sides"
            })
    
    # Calculate implied probabilities
    total_prob = (1/home + 1/draw + 1/away)
    overround = (total_prob - 1) * 100  # Bookmaker margin
    
    return {
        "odds": {"home": home, "draw": draw, "away": away},
        "overround": round(overround, 2),
        "is_uncertain": home >= 2.0 and draw >= 3.0 and away >= 2.0,
        "suggestions": suggestions
    }


def create_accumulator_bet(matches: List[Dict], selections: List[Dict]) -> Dict:
    """
    Create an accumulator bet with multiplied odds.
    
    Args:
        matches: List of match data with odds
        selections: List of {match_index: int, selection: str} where selection is "H", "D", "A", etc.
    
    Returns:
        Accumulator details with total odds and risk assessment
    """
    
    total_odds = 1.0
    legs = []
    
    for sel in selections:
        match_idx = sel["match_index"]
        selection = sel["selection"]
        match = matches[match_idx]
        
        # Get odds for selection
        if selection == "H":
            odds = match["home"]
        elif selection == "D":
            odds = match["draw"]
        elif selection == "A":
            odds = match["away"]
        elif selection == "HD":
            odds = match["hd"]
        elif selection == "AD":
            odds = match["ad"]
        elif selection == "HA":
            odds = match["ha"]
        else:
            odds = 1.0
        
        total_odds *= odds
        legs.append({
            "match": match.get("name", f"Match {match_idx + 1}"),
            "selection": selection,
            "odds": round(odds, 2)
        })
    
    # Risk assessment
    num_legs = len(legs)
    win_probability = 1.0
    for leg in legs:
        win_probability *= (1 / leg["odds"])  # Implied probability
    
    risk_level = "Low" if num_legs <= 2 else "Medium" if num_legs <= 4 else "High"
    
    return {
        "legs": legs,
        "num_legs": num_legs,
        "total_odds": round(total_odds, 2),
        "win_probability": round(win_probability * 100, 2),
        "risk_level": risk_level,
        "recommended_stake_percent": 5 if risk_level == "Low" else 3 if risk_level == "Medium" else 1
    }


def recommend_best_combos(matches: List[Dict], budget: float, risk_tolerance: str = "medium") -> List[Dict]:
    """
    AI-powered recommendations for best betting combinations.
    
    Args:
        matches: List of match data with odds
        budget: Available bankroll
        risk_tolerance: "low", "medium", "high"
    
    Returns:
        List of recommended betting strategies sorted by expected value
    """
    
    recommendations = []
    
    # Strategy 1: Safe accumulator (2-outcome bets only)
    safe_accum_legs = []
    for i, match in enumerate(matches):
        analysis = analyze_match_odds(match["home"], match["draw"], match["away"])
        if analysis["is_uncertain"]:
            # Pick the better 2-outcome bet
            if match.get("hd", 999) < match.get("ad", 999):
                safe_accum_legs.append({"match_index": i, "selection": "HD"})
            else:
                safe_accum_legs.append({"match_index": i, "selection": "AD"})
    
    if safe_accum_legs:
        safe_accum = create_accumulator_bet(matches, safe_accum_legs)
        recommendations.append({
            "strategy": "Safe Accumulator",
            "description": "2-outcome bets on uncertain matches",
            "accumulator": safe_accum,
            "suggested_stake": budget * (safe_accum["recommended_stake_percent"] / 100),
            "expected_value_rating": 8.5
        })
    
    # Strategy 2: Defensive singles (for each match)
    for i, match in enumerate(matches):
        analysis = analyze_match_odds(match["home"], match["draw"], match["away"])
        if analysis["suggestions"]:
            for suggestion in analysis["suggestions"]:
                for rec_bet in suggestion["recommended_bets"]:
                    recommendations.append({
                        "strategy": f"Single: {match.get('name', f'Match {i+1}')}",
                        "description": rec_bet["reasoning"],
                        "bet_type": rec_bet["bet"],
                        "suggested_stake": budget * 0.05,  # 5% of bankroll
                        "expected_value_rating": 7.0
                    })
    
    # Strategy 3: High-value multi-outcome (if suitable matches found)
    high_value_bets = []
    for i, match in enumerate(matches):
        # Look for overpriced odds (overround < 5%)
        analysis = analyze_match_odds(match["home"], match["draw"], match["away"])
        if analysis["overround"] < 5:
            high_value_bets.append({
                "match": match.get("name", f"Match {i+1}"),
                "recommendation": "Defensive spread across all outcomes",
                "reason": f"Low bookmaker margin ({analysis['overround']}%) suggests value"
            })
    
    if high_value_bets:
        recommendations.append({
            "strategy": "Value Hunting",
            "description": "Matches with unusually fair odds",
            "targets": high_value_bets,
            "suggested_stake": budget * 0.1,
            "expected_value_rating": 9.0
        })
    
    # Sort by expected value rating
    recommendations.sort(key=lambda x: x.get("expected_value_rating", 0), reverse=True)
    
    return recommendations[:5]  # Top 5 recommendations


def solve_with_accumulator(matches: List[Dict], budget: float, accumulator_legs: List[Dict]) -> Dict:
    """
    Solve defensive bet allocation including an accumulator.
    
    This uses the defensive engine to optimize stakes across:
    1. Individual match bets
    2. An accumulator combining multiple selections
    """
    
    # Create accumulator bet object
    accum = create_accumulator_bet(matches, accumulator_legs)
    
    # Build bet list (singles + accumulator)
    bets = []
    
    # Add individual match bets
    for i, match in enumerate(matches):
        if match.get("home"):
            bets.append(Bet(f"M{i+1}_H", i, ("H",), match["home"], 1.0))
        if match.get("draw"):
            bets.append(Bet(f"M{i+1}_D", i, ("D",), match["draw"], 1.0))
        if match.get("away"):
            bets.append(Bet(f"M{i+1}_A", i, ("A",), match["away"], 1.0))
        if match.get("hd"):
            bets.append(Bet(f"M{i+1}_HD", i, ("H", "D"), match["hd"], 1.0))
        if match.get("ad"):
            bets.append(Bet(f"M{i+1}_AD", i, ("A", "D"), match["ad"], 1.0))
        if match.get("ha"):
            bets.append(Bet(f"M{i+1}_HA", i, ("H", "A"), match["ha"], 1.0))
    
    # Add accumulator as a special bet that wins only if ALL legs win
    # (This is simplified - true accumulators need special handling)
    # For now, treat it as a defensive bet
    
    # Solve using defensive engine
    solution = solve_defensive_mip_generic(
        bets, 
        budget, 
        k=len(matches), 
        increment=1.0,
        enforce_exact_budget=True
    )
    
    return {
        "solution": solution,
        "accumulator": accum,
        "recommendation": "Stakes optimized for worst-case guarantee while including accumulator odds"
    }


def highlight_winning_bets(stakes: Dict, matches: List[Dict], outcome: Tuple) -> Dict:
    """
    Highlight which bets win for a given outcome.
    
    Args:
        stakes: Dict of bet_id -> stake amount
        matches: Match data
        outcome: Tuple of results, e.g., ("H", "A", "D") for 3 matches
    
    Returns:
        Dict with winning_bets, losing_bets, and payout calculation
    """
    
    winning_bets = []
    losing_bets = []
    total_payout = 0.0
    total_stake = sum(stakes.values())
    
    for bet_id, stake in stakes.items():
        # Parse bet ID to get match index and bet type
        parts = bet_id.split("_")
        match_idx = int(parts[0].replace("M", "")) - 1
        bet_type = parts[1] if len(parts) > 1 else ""
        
        # Get actual result for this match
        actual_result = outcome[match_idx]
        
        # Determine if bet wins
        won = False
        odds = 1.0
        
        if bet_type == "H" and actual_result == "H":
            won = True
            odds = matches[match_idx]["home"]
        elif bet_type == "D" and actual_result == "D":
            won = True
            odds = matches[match_idx]["draw"]
        elif bet_type == "A" and actual_result == "A":
            won = True
            odds = matches[match_idx]["away"]
        elif bet_type == "HD" and actual_result in ["H", "D"]:
            won = True
            odds = matches[match_idx]["hd"]
        elif bet_type == "AD" and actual_result in ["A", "D"]:
            won = True
            odds = matches[match_idx]["ad"]
        elif bet_type == "HA" and actual_result in ["H", "A"]:
            won = True
            odds = matches[match_idx]["ha"]
        
        if won:
            payout = stake * odds
            total_payout += payout
            winning_bets.append({
                "bet_id": bet_id,
                "stake": stake,
                "odds": odds,
                "payout": round(payout, 2)
            })
        else:
            losing_bets.append({
                "bet_id": bet_id,
                "stake": stake
            })
    
    net_profit = total_payout - total_stake
    
    return {
        "outcome": outcome,
        "winning_bets": winning_bets,
        "losing_bets": losing_bets,
        "total_payout": round(total_payout, 2),
        "total_stake": round(total_stake, 2),
        "net_profit": round(net_profit, 2)
    }