import sqlite3

conn = sqlite3.connect("data.db")
c = conn.cursor()

# bankroll table
c.execute("""
CREATE TABLE IF NOT EXISTS bankroll (
    id INTEGER PRIMARY KEY,
    balance REAL NOT NULL
);
""")

# insert default bankroll if empty
c.execute("SELECT * FROM bankroll")
if not c.fetchone():
    c.execute("INSERT INTO bankroll (balance) VALUES (100)")

# matches table
c.execute("""
CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT,
    home_team TEXT,
    away_team TEXT,
    home REAL,
    draw REAL,
    away REAL,
    hd REAL,
    ad REAL,
    ha REAL,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

# bets table
c.execute("""
CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT,
    bet_type TEXT,
    odds REAL,
    stake REAL,
    outcome TEXT,
    result_win INTEGER,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

conn.commit()
conn.close()
print("Database setup complete.")
