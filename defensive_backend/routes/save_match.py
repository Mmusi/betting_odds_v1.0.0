def save_match_to_db(match):
    db = get_db()
    db.execute("""
        INSERT INTO matches (match_id, home_team, away_team, home, draw, away, hd, ad, ha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        match["id"],
        match["home_team"],
        match["away_team"],
        match["home"],
        match["draw"],
        match["away"],
        match["hd"],
        match["ad"],
        match["ha"]
    ))
    db.commit()
