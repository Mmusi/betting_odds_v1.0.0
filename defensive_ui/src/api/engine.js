const BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001/api";

async function postJSON(path, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const solve = (bets, budget, increment = 1.0, k = null) =>
  postJSON("solve", { bets, budget, increment, k });

export const liveRecalc = (bets, stakes, budget, updated_odds, increment = 1.0) =>
  postJSON("live_recalc", { bets, stakes, budget, updated_odds, increment });

export const settle = (bets, stakes, initial_bankroll, results, increment = 1.0) =>
  postJSON("settle", { bets, stakes, initial_bankroll, results, increment });

export const trackerGet = async () => {
  const res = await fetch(`${BASE}/tracker`);
  return res.json();
};
