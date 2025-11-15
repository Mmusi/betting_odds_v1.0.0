from flask import Blueprint, jsonify, request
from db import get_db

bp = Blueprint("bankroll", __name__)

@bp.get("/bankroll")
def get_balance():
    db = get_db()
    row = db.execute("SELECT balance FROM bankroll WHERE id=1").fetchone()
    return jsonify({"bankroll": row["balance"]})

@bp.post("/bankroll/update")
def update_balance():
    data = request.json
    new_balance = float(data["balance"])
    db = get_db()
    db.execute("UPDATE bankroll SET balance=? WHERE id=1", (new_balance,))
    db.commit()
    return jsonify({"status": "ok", "bankroll": new_balance})
