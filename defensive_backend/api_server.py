from flask import Flask, request, jsonify
from defensive_engine_full import (
    Bet, solve_defensive_mip_generic, live_recalibrate,
    post_result_hedge, BankrollTracker
)
import json
from flask_cors import CORS


# Check top of api_server.py has:
from prediction_engine import (
    analyze_match_odds, create_accumulator_bet, recommend_best_combos,
    highlight_winning_bets, solve_with_accumulator
)

# If it fails, check prediction_engine.py is in same folder

app = Flask(__name__)
CORS(app)  # ✅ allows requests from your React frontend

GLOBAL_TRACKER = BankrollTracker(100.0)

def bets_from_payload(bets_payload):
    return [
        Bet(
            b["id"],
            b["match_index"],
            tuple(b["covered_results"]),
            float(b["odds"]),
            float(b.get("min_stake", 1.0))
        )
        for b in bets_payload
    ]

@app.route("/api/solve", methods=["POST"])
def api_solve():
    data = request.json
    bets = bets_from_payload(data["bets"])
    S = float(data["budget"])
    k = data.get("k", None)
    inc = float(data.get("increment", 1.0))
    sol = solve_defensive_mip_generic(bets, S, k=k, increment=inc)
    return jsonify(sol)

@app.route("/api/live_recalc", methods=["POST"])
def api_live_recalc():
    data = request.json
    bets = bets_from_payload(data["bets"])
    stakes = data["stakes"]
    S_current = float(data.get("budget", sum(stakes.values())))
    updated_odds = data.get("updated_odds", {})
    res = live_recalibrate(bets, stakes, S_current, updated_odds, increment=float(data.get("increment", 1.0)))
    return jsonify(res)

@app.route("/api/settle", methods=["POST"])
def api_settle():
    data = request.json
    bets = bets_from_payload(data["bets"])
    placed_stakes = data["stakes"]
    S_initial = float(data["initial_bankroll"])
    results = {int(k): v for k, v in data["results"].items()}
    res = post_result_hedge(bets, placed_stakes, S_initial, results, increment=float(data.get("increment", 1.0)))
    return jsonify(res)

@app.route("/api/tracker", methods=["GET"])
def api_tracker():
    return jsonify({
        "bankroll": GLOBAL_TRACKER.bankroll,
        "log": GLOBAL_TRACKER.log.to_dict(orient="records")
    })

@app.route("/api/analyze_odds", methods=["POST"])
def api_analyze_odds():
    data = request.json
    result = analyze_match_odds(
        float(data["home"]), 
        float(data["draw"]), 
        float(data["away"])
    )
    return jsonify(result)

@app.route("/api/recommend_combos", methods=["POST"])
def api_recommend_combos():
    data = request.json
    recs = recommend_best_combos(
        data["matches"], 
        float(data["budget"]), 
        data.get("risk_tolerance", "medium")
    )
    return jsonify({"recommendations": recs})

@app.route("/api/create_accumulator", methods=["POST"])
def api_create_accumulator():
    data = request.json
    accum = create_accumulator_bet(
        data["matches"], 
        data["selections"]
    )
    return jsonify(accum)

if __name__ == "__main__":
    app.run(port=5001, debug=False)
