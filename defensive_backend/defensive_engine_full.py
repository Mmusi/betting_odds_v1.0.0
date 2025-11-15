"""
defensive_engine_full.py

Unified master engine containing:
 - single- and multi-fixture MIP solver (pulp integer units)
 - market evaluation (implied probabilities / overround)
 - portfolio risk metrics
 - live cash-out / recalibration functions (liability-based)
 - post-result hedge recommender
 - progressive hedging smoothing helper
 - bankroll tracker/log with R_before/R_after and scenario
 - live simulation loops for single and multi fixtures
 - optional matplotlib visualization for bankroll

Dependencies:
  pip install pulp numpy pandas
  (matplotlib optional for plotting)
"""

from typing import List, Dict, Tuple, Optional
import itertools
import math
import time
import random
import numpy as np
import pulp
import pandas as pd

# optional plotting
try:
    import matplotlib.pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except Exception:
    MATPLOTLIB_AVAILABLE = False


# ----------------------------
# Data model
# ----------------------------
class Bet:
    def __init__(self, id: str, match_index: int, covered_results: Tuple[str, ...], odds: float, min_stake: float = 1.0):
        self.id = id
        self.match_index = int(match_index)
        self.covered_results = tuple(covered_results)
        self.odds = float(odds)
        self.min_stake = float(min_stake)

    def __repr__(self):
        return f"Bet({self.id}, m{self.match_index}, {self.covered_results}, O={self.odds}, min={self.min_stake})"


RESULTS = ['H', 'D', 'A']


def build_omega(k: int) -> List[Tuple[str, ...]]:
    """Cartesian product of results for k matches."""
    return list(itertools.product(RESULTS, repeat=k))


def build_incidence(bets: List[Bet], omega: List[Tuple[str, ...]]) -> np.ndarray:
    """Incidence matrix I[i, w] = 1 if bet i wins under elementary outcome w."""
    I = np.zeros((len(bets), len(omega)), dtype=int)
    for i, b in enumerate(bets):
        for j, w in enumerate(omega):
            if w[b.match_index] in b.covered_results:
                I[i, j] = 1
    return I


# ----------------------------
# Market evaluation / expected value
# ----------------------------
def evaluate_market_efficiency(bets: List[Bet]) -> Dict:
    implied_probs = {b.id: 1.0 / b.odds for b in bets if b.odds > 0}
    overround = sum(implied_probs.values()) - 1.0
    bias_flag = "fair" if abs(overround) < 0.03 else ("tight" if overround > 0 else "value")
    return {"implied_probs": implied_probs, "overround": overround, "market_bias": bias_flag}


# ----------------------------
# Portfolio risk metrics
# ----------------------------
def compute_portfolio_variance(nets: List[float]) -> Dict:
    if not nets:
        return {"mean_net": 0.0, "var_net": 0.0, "std_net": 0.0}
    mean_net = float(np.mean(nets))
    var_net = float(np.var(nets))
    std_net = float(math.sqrt(var_net))
    return {"mean_net": mean_net, "var_net": var_net, "std_net": std_net}


# ----------------------------
# Defensive MIP solver (max-min guaranteed net)
# ----------------------------
def solve_defensive_mip_generic(
    bets: List[Bet],
    S: float,
    k: Optional[int] = None,
    increment: float = 1.0,
    enforce_exact_budget: bool = True,
    allow_leftover_if_not_exact: bool = True,
    time_limit: Optional[int] = None
) -> Dict:
    """
    Integer-unit LP:
      maximize R
      s.t. for each outcome omega: sum_i s_i * O_i * I[i,omega] - S >= R
      sum_i s_i == S (or <= S depending on enforce_exact_budget)
      s_i = z_i * increment, z_i integer, z_i >= ceil(min_stake / increment)
    Returns dict with stakes, R, payouts, nets, risk_metrics, market eval.
    """
    if k is None:
        k = max((b.match_index for b in bets), default=-1) + 1
    omega = build_omega(k)
    I = build_incidence(bets, omega)

    # check minimums
    total_min_units = sum(math.ceil(b.min_stake / increment) for b in bets)
    total_min_required = total_min_units * increment
    if total_min_required > S:
        return {"status": "InsufficientBankrollForMinimums", "total_min_required": total_min_required, "S": S}

    prob = pulp.LpProblem("Defensive_Generic", pulp.LpMaximize)

    z_vars = {b.id: pulp.LpVariable(f"z_{b.id}", lowBound=math.ceil(b.min_stake / increment), cat='Integer') for b in bets}
    R = pulp.LpVariable("R", lowBound=None, cat='Continuous')
    prob += R

    # Outcome constraints
    for w_idx in range(len(omega)):
        expr = pulp.lpSum([z_vars[b.id] * increment * b.odds * I[i, w_idx] for i, b in enumerate(bets)])
        prob += expr - S >= R, f"Outcome_{w_idx}"

    # Budget constraint with tolerance and integer-unit handling
    sum_units_expr = pulp.lpSum([z_vars[b.id] * increment for b in bets])
    tol = 1e-6
    if enforce_exact_budget:
        if allow_leftover_if_not_exact:
            S_adj = math.floor(S / increment) * increment
            prob += sum_units_expr == S_adj
        else:
            # pulp doesn't support absolute easily; model with two inequalities
            prob += sum_units_expr <= S + tol
            prob += sum_units_expr >= S - tol
    else:
        prob += sum_units_expr <= S + tol

    solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=time_limit)
    prob.solve(solver)

    status = pulp.LpStatus.get(prob.status, pulp.LpStatus[prob.status]) if isinstance(pulp.LpStatus, dict) else pulp.LpStatus[prob.status]
    # pulp compatibility: sometimes mapping differs across versions
    if status not in ("Optimal", "Integer Feasible"):
        return {"status": status}

    # Extract results
    z_vals = {b.id: int(round(pulp.value(z_vars[b.id]) or 0)) for b in bets}
    stakes = {b.id: z_vals[b.id] * increment for b in bets}
    total_stakes = sum(stakes.values())
    R_val = float(pulp.value(R)) if pulp.value(R) is not None else None

    payouts = []
    nets = []
    for w_idx in range(len(omega)):
        payout = sum(stakes[b.id] * b.odds * I[i, w_idx] for i, b in enumerate(bets))
        payouts.append(float(payout))
        nets.append(float(payout - total_stakes))

    return {
        "status": "Optimal",
        "stakes": stakes,
        "z_units": z_vals,
        "total_stakes": total_stakes,
        "R": R_val,
        "omega": omega,
        "payouts": payouts,
        "nets": nets,
        "risk_metrics": compute_portfolio_variance(nets),
        "market": evaluate_market_efficiency(bets)
    }


# ----------------------------
# Live recalibration
# ----------------------------
def live_recalibrate(bets: List[Bet], current_stakes: Dict[str, float], S_current: float, updated_odds: Dict[str, float],
                     increment: float = 1.0, enforce_exact_budget: bool = True) -> Dict:
    """
    Evaluate current worst-case net under updated_odds and compute recommended reallocation.
    Returns current_R and recommended_reallocation (solve_defensive_mip_generic with updated odds).
    """
    k = max((b.match_index for b in bets), default=-1) + 1
    omega = build_omega(k)
    I = build_incidence(bets, omega)
    total_stake = sum(current_stakes.values())

    current_payouts = []
    current_nets = []
    for w_idx in range(len(omega)):
        payout = 0.0
        for i, b in enumerate(bets):
            o = updated_odds.get(b.id, b.odds)
            if I[i, w_idx]:
                payout += current_stakes.get(b.id, 0.0) * o
        current_payouts.append(float(payout))
        current_nets.append(float(payout - total_stake))

    current_R = float(min(current_nets)) if current_nets else 0.0

    # Build updated bet objects for solver
    new_bets = [Bet(b.id, b.match_index, b.covered_results, updated_odds.get(b.id, b.odds), b.min_stake) for b in bets]
    new_solution = solve_defensive_mip_generic(new_bets, S_current, k=k, increment=increment, enforce_exact_budget=enforce_exact_budget)

    return {"current_R": current_R, "current_payouts": current_payouts, "current_nets": current_nets, "recommended_reallocation": new_solution}


# ----------------------------
# Dynamic cash-out (liability-based + GUI JSON)
# ----------------------------
def dynamic_cashout(stakes: Dict[str, float], bets: List[Bet], bankroll_tracker,
                    updated_odds: Optional[Dict[str, float]] = None, enforce_exact_budget: bool = True,
                    dry_run: bool = False) -> Dict:
    """
    Liability-based cashout; for each bet, compute the value of removing that leg (marginal R)
    by re-solving the LP without it. Use the delta to construct a fair offer.

    Returns structured GUI-friendly dict:
      { "offers": [...], "accepted": {bet_id: amount}, "total_cashout": float, "remaining_stakes": {...}, "base_R": float }
    """
    if updated_odds is None:
        updated_odds = {b.id: b.odds * random.uniform(0.94, 1.08) for b in bets}

    rec = live_recalibrate(bets, stakes, sum(stakes.values()), updated_odds, increment=1.0, enforce_exact_budget=enforce_exact_budget)
    base_R = rec.get("recommended_reallocation", {}).get("R", rec.get("current_R", 0.0))

    offers = []
    accepted = {}
    remaining_stakes = stakes.copy()
    total_cashout = 0.0

    total_staked = sum(stakes.values()) if stakes else 0.0
    for i, b in enumerate(bets):
        s = stakes.get(b.id, 0.0)
        if s <= 0:
            continue
        o = updated_odds.get(b.id, b.odds)  # safe lookup

        # Liability-based marginal test: solve without this bet
        reduced_bets = [x for x in bets if x.id != b.id]
        reduced_stakes_sum = sum(v for k, v in stakes.items() if k != b.id)
        sol_wo = solve_defensive_mip_generic(reduced_bets, reduced_stakes_sum, k=None, increment=1.0, enforce_exact_budget=enforce_exact_budget)
        R_wo = sol_wo.get("R", 0.0)

        delta_R = base_R - R_wo

        # Fair valuation heuristic using delta_R
        # scale between 35% and 95% of gross payout, weighted by marginal importance
        gross = s * o
        importance = max(0.0, min(1.0, (delta_R / (abs(base_R) + 1e-9)) * 0.5 + 0.5))  # normalized factor
        fair_val = gross * (0.35 + 0.60 * importance)
        offer = round(max(min(fair_val, gross * 0.95), gross * 0.35), 3)
        offer_ratio = round(offer / gross if gross > 0 else 0.0, 3)
        profitable = offer > s

        offers.append({
            "bet_id": b.id,
            "stake": s,
            "odds": round(o, 4),
            "offer": offer,
            "offer_ratio": offer_ratio,
            "delta_R": round(delta_R, 6),
            "status": "profitable" if profitable else "at_loss"
        })

        # auto-accept profitable offers if not dry_run
        if profitable and not dry_run:
            accepted[b.id] = offer
            remaining_stakes[b.id] = 0.0
            total_cashout += offer

    if accepted and not dry_run:
        bankroll_tracker.update_bankroll(total_cashout, "cashout", note=f"{len(accepted)} bets cashed out")

    return {
        "offers": offers,
        "accepted": accepted,
        "total_cashout": round(total_cashout, 3),
        "remaining_stakes": remaining_stakes,
        "base_R": round(base_R, 6),
        "updated_odds": updated_odds
    }


# ----------------------------
# Progressive hedging (smoothing)
# ----------------------------
def solve_progressive_hedge(bets: List[Bet], S: float, prev_stakes: Dict[str, float], lam: float = 0.2, **kwargs) -> Dict:
    """
    Solve then smooth stakes towards previous allocation:
      stakes_smoothed = (1-lam)*prev + lam*new
    """
    sol = solve_defensive_mip_generic(bets, S, **kwargs)
    if sol.get("status") != "Optimal":
        return sol
    new_stakes = sol.get("stakes", {})
    smoothed = {}
    for b in bets:
        s_old = prev_stakes.get(b.id, 0.0)
        s_new = new_stakes.get(b.id, 0.0)
        smoothed[b.id] = round((1 - lam) * s_old + lam * s_new, 8)
    sol["stakes_smoothed"] = smoothed
    return sol


# ----------------------------
# Post-result hedge recommender
# ----------------------------
def post_result_hedge(bets: List[Bet], placed_stakes: Dict[str, float], S_initial: float, finished_results: Dict[int, str],
                      increment: float = 1.0, enforce_exact_budget: bool = True) -> Dict:
    """
    After some matches settle, compute realized bankroll and propose a new allocation for unresolved bets.
    """
    realized = 0.0
    unresolved = []
    for b in bets:
        s = placed_stakes.get(b.id, 0.0)
        if b.match_index in finished_results:
            result = finished_results[b.match_index]
            win = 1 if result in b.covered_results else 0
            payout = s * b.odds if win else 0.0
            realized += payout
        else:
            unresolved.append(Bet(b.id, b.match_index, b.covered_results, b.odds, b.min_stake))

    total_placed = sum(placed_stakes.values())
    bankroll_after = S_initial - total_placed + realized

    if not unresolved:
        return {"status": "AllSettled", "realized": realized, "bankroll": bankroll_after}

    solution = solve_defensive_mip_generic(unresolved, bankroll_after, k=None, increment=increment, enforce_exact_budget=enforce_exact_budget)
    return {"status": "HedgeSuggested", "realized": realized, "bankroll_after": bankroll_after, "remaining_solution": solution}


# ----------------------------
# Bankroll tracker / logger
# ----------------------------
class BankrollTracker:
    def __init__(self, initial: float = 100.0):
        self.initial = float(initial)
        self.bankroll = float(initial)
        self.log = pd.DataFrame(columns=["time", "action", "amount", "note"])

    def update_bankroll(self, delta: float, action: str, note: str = "") -> float:
        """Adjust bankroll and append to log."""
        self.bankroll += float(delta)
        self.log.loc[len(self.log)] = [time.time(), action, float(delta), note]
        return self.bankroll

    def export_log(self, path: str = "bankroll_log.csv") -> str:
        self.log.to_csv(path, index=False)
        return path


# ----------------------------
# Single-fixture wrapper & live simulation
# ----------------------------
def run_single_fixture_round(bets: List[Bet], tracker: BankrollTracker, stake: float,
                             updated_odds: Optional[Dict[str, float]] = None, dry_run_cashout: bool = False) -> Dict:
    """
    Run one defensive round on a single fixture (k=1). Returns solution, cashout_summary.
    This function charges the tracker (deduct stake) and then evaluates cashout using updated_odds.
    """
    sol = solve_defensive_mip_generic(bets, stake, k=1)
    if sol.get("status") != "Optimal":
        return {"status": sol.get("status")}

    # place bets (deduct stake)
    tracker.update_bankroll(-stake, "place_bets", note="single_fixture_placement")

    # evaluate cashout offers
    cashout_summary = dynamic_cashout(sol["stakes"], bets, tracker, updated_odds, dry_run=dry_run_cashout)
    return {"solution": sol, "cashout": cashout_summary, "tracker_bankroll": tracker.bankroll}


def simulate_live_single(bets: List[Bet], tracker: BankrollTracker, stake: float,
                         refresh_interval: int = 3, iterations: int = 10, plot: bool = False):
    """
    Live simulation for a single match: places initial stake then loops, updating odds
    and applying cashouts when profitable. Optionally plot bankroll evolution.
    """
    sol = solve_defensive_mip_generic(bets, stake, k=1)
    if sol.get("status") != "Optimal":
        raise RuntimeError(f"Solver returned {sol.get('status')}")
    stakes = sol["stakes"]
    tracker.update_bankroll(-stake, "place_bets", note="single_live_initial")

    # prepare plotting if requested and available
    bankroll_history = [tracker.bankroll]
    ticks = [0]
    if plot and MATPLOTLIB_AVAILABLE:
        plt.ion()
        fig, ax = plt.subplots()
        ax.set_title("Single Fixture — Live Bankroll")
        ax.set_xlabel("Tick")
        ax.set_ylabel("Bankroll")

    for t in range(iterations):
        updated_odds = {b.id: max(1.01, round(b.odds * random.uniform(0.9, 1.12), 3)) for b in bets}
        cash_result = dynamic_cashout(stakes, bets, tracker, updated_odds, dry_run=False)

        # apply remaining stakes if any were cashed out
        stakes = cash_result.get("remaining_stakes", stakes)

        bankroll_history.append(tracker.bankroll)
        ticks.append(t + 1)

        # update plot
        if plot and MATPLOTLIB_AVAILABLE:
            ax.clear()
            ax.plot(ticks, bankroll_history, marker="o")
            ax.set_title("Single Fixture — Live Bankroll")
            ax.set_xlabel("Tick")
            ax.set_ylabel("Bankroll")
            ax.grid(True)
            plt.pause(0.01)

        print(f"[Single] Tick {t+1}/{iterations} | Updated odds: {updated_odds} | Cashout: {cash_result['total_cashout']:.2f} | Bankroll: {tracker.bankroll:.2f}")
        time.sleep(refresh_interval)

    if plot and MATPLOTLIB_AVAILABLE:
        plt.ioff()
        plt.show()

    return {"final_bankroll": tracker.bankroll, "history": bankroll_history}


# ----------------------------
# Multi-fixture wrapper & live simulation
# ----------------------------
def run_multi_fixture_round(all_bets: List[Bet], tracker: BankrollTracker, stake: float,
                            updated_odds: Optional[Dict[str, float]] = None, dry_run_cashout: bool = False) -> Dict:
    """
    Single call for multi-fixture optimization and optional cashout evaluation.
    Deducts stake from tracker and returns solution + cashout summary.
    """
    sol = solve_defensive_mip_generic(all_bets, stake, k=None)
    if sol.get("status") != "Optimal":
        return {"status": sol.get("status")}

    tracker.update_bankroll(-stake, "place_bets", note="multi_fixture_placement")
    cashout_summary = dynamic_cashout(sol["stakes"], all_bets, tracker, updated_odds, dry_run=dry_run_cashout)
    return {"solution": sol, "cashout": cashout_summary, "tracker_bankroll": tracker.bankroll}


def simulate_multi_fixture(bets_by_match: Dict[int, List[Bet]], tracker: BankrollTracker, total_stake: float,
                           refresh_interval: int = 3, iterations: int = 10, plot: bool = False):
    """
    Multi-fixture live simulation: collects all bets across matches, places initial combined stake,
    repeatedly updates odds per match and evaluates/apply cashouts.
    """
    all_bets = [b for bets in bets_by_match.values() for b in bets]
    sol = solve_defensive_mip_generic(all_bets, total_stake, k=len(bets_by_match))
    if sol.get("status") != "Optimal":
        raise RuntimeError(f"Solver returned {sol.get('status')}")
    stakes = sol["stakes"]
    tracker.update_bankroll(-total_stake, "place_bets", note="multi_live_initial")

    bankroll_history = [tracker.bankroll]
    ticks = [0]

    if plot and MATPLOTLIB_AVAILABLE:
        plt.ion()
        fig, ax = plt.subplots()
        ax.set_title("Multi Fixture — Live Bankroll")
        ax.set_xlabel("Tick")
        ax.set_ylabel("Bankroll")

    for t in range(iterations):
        updated_odds = {}
        for match_idx, bets in bets_by_match.items():
            for b in bets:
                updated_odds[b.id] = max(1.01, round(b.odds * random.uniform(0.88, 1.12), 3))

        cashout = dynamic_cashout(stakes, all_bets, tracker, updated_odds=updated_odds, dry_run=False)
        stakes = cashout.get("remaining_stakes", stakes)

        bankroll_history.append(tracker.bankroll)
        ticks.append(t + 1)

        if plot and MATPLOTLIB_AVAILABLE:
            ax.clear()
            ax.plot(ticks, bankroll_history, marker="o")
            ax.set_title("Multi Fixture — Live Bankroll")
            ax.set_xlabel("Tick")
            ax.set_ylabel("Bankroll")
            ax.grid(True)
            plt.pause(0.01)

        print(f"[Multi] Tick {t+1}/{iterations} | Updated odds sample: {dict(list(updated_odds.items())[:3])} | Cashout: {cashout['total_cashout']:.2f} | Bankroll: {tracker.bankroll:.2f}")
        time.sleep(refresh_interval)

    if plot and MATPLOTLIB_AVAILABLE:
        plt.ioff()
        plt.show()

    return {"final_bankroll": tracker.bankroll, "history": bankroll_history}


# ----------------------------
# Convenience example (only runs if file executed directly)
# ----------------------------
if __name__ == "__main__":
    # Quick demo: single fixture live simulation with plotting (if matplotlib available)
    demo_bets = [
        Bet("H", 0, ("H",), 1.40, 1.0),
        Bet("A", 0, ("A",), 6.00, 1.0),
        Bet("HD", 0, ("H", "D"), 1.44, 1.0),
        Bet("AD", 0, ("A", "D"), 1.42, 1.0),
        Bet("HA", 0, ("H", "A"), 1.25, 1.0)
    ]

    demo_tracker = BankrollTracker(initial=100.0)

    print("Running a short single-fixture live simulation (no GUI)...")
    simulate_live_single(demo_bets, demo_tracker, stake=6.0, refresh_interval=2, iterations=6, plot=(MATPLOTLIB_AVAILABLE))

    # And a short multi-fixture demo
    demo_bets_by_match = {
        0: [Bet("M1_H", 0, ("H",), 1.40), Bet("M1_A", 0, ("A",), 6.5), Bet("M1_HD", 0, ("H", "D"), 1.44)],
        1: [Bet("M2_H", 1, ("H",), 2.1), Bet("M2_A", 1, ("A",), 3.1), Bet("M2_HD", 1, ("H", "D"), 1.7)]
    }
    demo_tracker2 = BankrollTracker(initial=100.0)
    print("\nRunning a short multi-fixture live simulation (no GUI)...")
    simulate_multi_fixture(demo_bets_by_match, demo_tracker2, total_stake=10.0, refresh_interval=2, iterations=6, plot=(MATPLOTLIB_AVAILABLE))

    print("\nDemo finished. Export logs if needed:")
    print("Single demo log (last rows):")
    print(demo_tracker.log.tail())
    print("Multi demo log (last rows):")
    print(demo_tracker2.log.tail())
