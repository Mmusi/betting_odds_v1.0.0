import React, { useState, useEffect, useRef } from "react";
import { solve } from "../api/engine";
import { useBankroll } from "../context/BankrollContext";   // GLOBAL BANKROLL

export default function SolverForm({ onSolved }) {
  const { adjustBankroll } = useBankroll();   // access global bankroll

  const [budget, setBudget] = useState(10);
  const [matches, setMatches] = useState([
    { id: "M1", home: "", draw: "", away: "", hd: "", ad: "", ha: "" },
  ]);
  const [loading, setLoading] = useState(false);

  const lastFocused = useRef({ matchIndex: 0, field: "home" });
  const [flashField, setFlashField] = useState(null);

  // ===========================================
  // RECEIVE ODDS FROM POPUP
  // ===========================================
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

  // ===========================================
  // ADD MATCH
  // ===========================================
  const addMatch = () => {
    setMatches((prev) => [
      ...prev,
      {
        id: `M${prev.length + 1}`,
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

  // ===========================================
  // COMPUTE & DEDUCT BANKROLL
  // ===========================================
  const handleSolve = async () => {
    setLoading(true);
    try {
      const bets = [];

      matches.forEach((m, i) => {
        if (m.home && m.away && m.hd && m.ad && m.ha) {
          bets.push({ id: `${m.id}_H`, match_index: i, covered_results: ["H"], odds: parseFloat(m.home) });
          bets.push({ id: `${m.id}_D`, match_index: i, covered_results: ["D"], odds: parseFloat(m.draw) });
          bets.push({ id: `${m.id}_A`, match_index: i, covered_results: ["A"], odds: parseFloat(m.away) });
          bets.push({ id: `${m.id}_HD`, match_index: i, covered_results: ["H","D"], odds: parseFloat(m.hd) });
          bets.push({ id: `${m.id}_AD`, match_index: i, covered_results: ["A","D"], odds: parseFloat(m.ad) });
          bets.push({ id: `${m.id}_HA`, match_index: i, covered_results: ["H","A"], odds: parseFloat(m.ha) });
        }
      });

      const res = await solve(bets, parseFloat(budget), 1.0, matches.length);

      // ⚡ Pass to Results component before bankroll change
      onSolved(res, bets);

      // ===========================================
      // 🔥 Correct bankroll deduction using actual stake plan
      // ===========================================
      if (res?.stakes && typeof res.stakes === "object") {
        const totalStake = Object.values(res.stakes).reduce(
          (sum, v) => sum + v,
          0
        );

        if (totalStake > 0) {
          adjustBankroll(-totalStake);
          console.log("💸 Deducted from bankroll:", totalStake);
        }
      }

    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===========================================
  // RENDER
  // ===========================================
  return (
    <div className="bg-white p-5 rounded-xl shadow-md mb-6">
      <h2 className="text-lg font-semibold mb-4">⚙️ Betting Solver</h2>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="font-medium">💰 Stake:</label>
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="border px-3 py-2 rounded w-32"
        />

        <button
          onClick={addMatch}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-md transition"
        >
          ➕ Add Match
        </button>

        <button
          onClick={handleSolve}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded shadow-md transition"
        >
          {loading ? "Calculating..." : "⚡ Compute Stakes"}
        </button>
      </div>

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

            <h3 className="font-medium mb-3">Match {i + 1}</h3>

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
                  className={`border p-2 rounded transition-all ${
                    flashField === `${i}-${field}` ||
                    flashField === `batch-${i}`
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
