// defensive_ui/src/components/SolverForm.jsx
import React, { useState, useEffect, useRef } from "react";
import { solve } from "../api/engine";
import { useBankroll } from "../context/BankrollContext";
import { saveBetRecord } from "../utils/db";

export default function SolverForm({ onSolved }) {
  const { bankroll, isLoading: bankrollLoading, deductStake } = useBankroll();

  const [budget, setBudget] = useState(10);
  const [matches, setMatches] = useState([
    { id: "M1", name: "", home: "", draw: "", away: "", hd: "", ad: "", ha: "" },
  ]);
  const [loading, setLoading] = useState(false);

  const lastFocused = useRef({ matchIndex: 0, field: "home" });
  const [flashField, setFlashField] = useState(null);

  // ============================================
  // RECEIVE ODDS FROM POPUP
  // ============================================
  useEffect(() => {
    const handleMsg = (event) => {
      const data = event.data;
      if (!data) return;
      const { type } = data;
      if (type !== "betwayOdd" && type !== "betwayOddsBatch") return;

      const { matchIndex } = lastFocused.current;

      setMatches((prev) => {
        const updated = [...prev];
        if (!updated[matchIndex]) return prev;

        if (type === "betwayOdd") {
          const field = lastFocused.current.field;
          updated[matchIndex] = {
            ...updated[matchIndex],
            [field]: data.value,
          };
          setFlashField(`${matchIndex}-${field}`);
          setTimeout(() => setFlashField(null), 800);
          return updated;
        }

        if (type === "betwayOddsBatch") {
          const batch = data.odds || {};
          Object.entries(batch).forEach(([key, val]) => {
            if (val !== "" && val != null) {
              updated[matchIndex][key] = val;
            }
          });
          setFlashField(`batch-${matchIndex}`);
          setTimeout(() => setFlashField(null), 800);
          return updated;
        }

        return prev;
      });
    };

    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, []);

  const handleFocus = (matchIndex, field) => {
    lastFocused.current = { matchIndex, field };
  };

  // ============================================
  // MATCH MANAGEMENT
  // ============================================
  const addMatch = () => {
    setMatches((prev) => [
      ...prev,
      {
        id: `M${prev.length + 1}`,
        name: "",
        home: "",
        draw: "",
        away: "",
        hd: "",
        ad: "",
        ha: "",
      },
    ]);
  };

  const removeMatch = (index) => {
    setMatches((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMatch = (i, field, val) => {
    setMatches((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [field]: val } : m))
    );
  };

  // ============================================
  // VALIDATE INPUTS
  // ============================================
  const validateInputs = () => {
    const budgetNum = parseFloat(budget);

    if (isNaN(budgetNum) || budgetNum <= 0) {
      alert("❌ Budget must be greater than 0");
      return false;
    }

    // ✅ NULL SAFETY: Check if bankroll is loaded
    if (bankroll != null && budgetNum > bankroll) {
      alert(`❌ Budget (${budgetNum}) exceeds available bankroll (${bankroll.toFixed(2)})`);
      return false;
    }

    for (const match of matches) {
      const odds = [match.home, match.draw, match.away, match.hd, match.ad, match.ha];
      const hasAnyOdds = odds.some(o => o && parseFloat(o) > 0);
      
      if (!hasAnyOdds) {
        alert(`❌ Match "${match.name || match.id}" has no odds entered`);
        return false;
      }

      for (const odd of odds) {
        if (odd && (parseFloat(odd) < 1.01 || parseFloat(odd) > 1000)) {
          alert(`❌ Invalid odds value: ${odd} (must be between 1.01 and 1000)`);
          return false;
        }
      }
    }

    return true;
  };

  // ============================================
  // SOLVE & DEDUCT STAKE (ONCE)
  // ============================================
  const handleSolve = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    try {
      // Build bet array
      const bets = [];
      matches.forEach((m, i) => {
        if (m.home) bets.push({ id: `${m.id}_H`, match_index: i, covered_results: ["H"], odds: parseFloat(m.home), min_stake: 1.0 });
        if (m.draw) bets.push({ id: `${m.id}_D`, match_index: i, covered_results: ["D"], odds: parseFloat(m.draw), min_stake: 1.0 });
        if (m.away) bets.push({ id: `${m.id}_A`, match_index: i, covered_results: ["A"], odds: parseFloat(m.away), min_stake: 1.0 });
        if (m.hd) bets.push({ id: `${m.id}_HD`, match_index: i, covered_results: ["H","D"], odds: parseFloat(m.hd), min_stake: 1.0 });
        if (m.ad) bets.push({ id: `${m.id}_AD`, match_index: i, covered_results: ["A","D"], odds: parseFloat(m.ad), min_stake: 1.0 });
        if (m.ha) bets.push({ id: `${m.id}_HA`, match_index: i, covered_results: ["H","A"], odds: parseFloat(m.ha), min_stake: 1.0 });
      });

      // Call solver
      const res = await solve(bets, parseFloat(budget), 1.0, matches.length);

      // ============================================
      // ✅ FIX: DEDUCT STAKE ONLY ONCE (HERE)
      // ============================================
      if (res?.stakes && typeof res.stakes === "object") {
        const totalStake = Object.values(res.stakes).reduce((sum, v) => sum + v, 0);

        if (totalStake > 0) {
          await deductStake(totalStake);
          console.log("💸 Deducted from bankroll:", totalStake);
        }
      }

      // Save bet record (unapplied)
      try {
        await saveBetRecord({
          matches: matches.map(m => ({ ...m })),
          stakes: res.stakes || {},
          outcomes: res.omega || [],
          nets: res.nets || [],
          R: res.R,
          applied: false,
        });
      } catch (err) {
        console.error("Failed to save bet record:", err);
      }

      // Pass solution to parent (ResultsPanel)
      onSolved(res, bets);

    } catch (err) {
      alert("❌ Error: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  if (bankrollLoading) {
    return (
      <div className="bg-white p-5 rounded-xl shadow-md mb-6 text-center">
        <p className="text-gray-500">Loading bankroll...</p>
      </div>
    );
  }

  // ✅ NULL SAFETY: Default to 0 if bankroll still null
  const safeBankroll = bankroll ?? 0;
  const displayBankroll = safeBankroll.toFixed(2);

  return (
    <div className="bg-white p-5 rounded-xl shadow-md mb-6">
      <h2 className="text-lg font-semibold mb-4">⚙️ Betting Solver</h2>

      {/* Budget & Actions */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="font-medium">💰 Stake:</label>
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="border px-3 py-2 rounded w-32"
          min="1"
          max={safeBankroll}
        />
        <span className="text-sm text-gray-500">
          (Available: {displayBankroll})
        </span>

        <button
          onClick={addMatch}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-md transition"
        >
          ➕ Add Match
        </button>

        <button
          onClick={handleSolve}
          disabled={loading || parseFloat(budget) > safeBankroll}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded shadow-md transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? "Calculating..." : "⚡ Compute Stakes"}
        </button>
      </div>

      {/* Match Inputs */}
      <div className="space-y-5">
        {matches.map((m, i) => (
          <div key={i} className="border p-4 rounded-lg bg-gray-50 relative">
            {matches.length > 1 && (
              <button
                onClick={() => removeMatch(i)}
                className="absolute top-2 right-2 text-xs text-red-600 hover:text-red-800"
              >
                ✖ Remove
              </button>
            )}

            <h3 className="font-medium mb-3">
              {m.name || `Match ${i + 1}`}
            </h3>

            {/* Team Name Input */}
            <input
              placeholder="Team names (e.g., Arsenal vs Chelsea)"
              value={m.name}
              onChange={(e) => updateMatch(i, "name", e.target.value)}
              className="w-full border p-2 rounded mb-3 text-sm"
            />

            {/* Odds Grid */}
            <div className="grid grid-cols-6 gap-2 text-sm">
              {[
                ["home", "Home (1)"],
                ["draw", "Draw (X)"],
                ["away", "Away (2)"],
                ["hd", "1X (Home/Draw)"],
                ["ad", "X2 (Away/Draw)"],
                ["ha", "12 (Home/Away)"],
              ].map(([field, label]) => (
                <input
                  key={field}
                  placeholder={label}
                  value={m[field]}
                  onChange={(e) => updateMatch(i, field, e.target.value)}
                  onFocus={() => handleFocus(i, field)}
                  type="number"
                  step="0.01"
                  min="1.01"
                  className={`border p-2 rounded transition-all ${
                    flashField === `${i}-${field}` || flashField === `batch-${i}`
                      ? "bg-yellow-200 border-yellow-400"
                      : "bg-white"
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}