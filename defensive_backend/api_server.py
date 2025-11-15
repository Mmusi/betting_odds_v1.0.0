from flask import Flask, request, jsonify
from defensive_engine_full import (
    Bet, solve_defensive_mip_generic, live_recalibrate,
    post_result_hedge, BankrollTracker
)
import json
from flask_cors import CORS


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

if __name__ == "__main__":
    app.run(port=5001, debug=False)
