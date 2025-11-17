// defensive_ui/src/components/SolverForm.jsx
// ✅ ENHANCED: Better validation and error handling for insufficient stakes
import React, { useState, useEffect, useRef } from "react";
import { solve } from "../api/engine";
import { useBankroll } from "../context/BankrollContext";
import { useToast } from "./Toast";

export default function SolverForm({ onSolved }) {
  const { bankroll, isLoading: bankrollLoading } = useBankroll();
  const toast = useToast();

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
  // ✅ ENHANCED VALIDATION - FIXED FOR SINGLE MATCH
  // ============================================
  const validateInputs = () => {
    const budgetNum = parseFloat(budget);

    if (isNaN(budgetNum) || budgetNum <= 0) {
      toast.error("❌ Budget must be greater than 0");
      return false;
    }

    if (bankroll != null && budgetNum > bankroll) {
      toast.error(`❌ Budget (${budgetNum}) exceeds available bankroll (${bankroll.toFixed(2)})`);
      return false;
    }

    // ✅ Count total number of bets that will be created
    let totalBets = 0;
    for (const match of matches) {
      const odds = [match.home, match.draw, match.away, match.hd, match.ad, match.ha];
      const validOdds = odds.filter(o => o && parseFloat(o) > 0);
      
      if (validOdds.length === 0) {
        toast.error(`❌ Match "${match.name || match.id}" has no odds entered`);
        return false;
      }

      totalBets += validOdds.length;

      // Validate odds range
      for (const odd of validOdds) {
        const oddValue = parseFloat(odd);
        if (oddValue < 1.01 || oddValue > 1000) {
          toast.error(`❌ Invalid odds value: ${odd} (must be between 1.01 and 1000)`);
          return false;
        }
      }
    }

    // ✅ FIXED: Different minimum requirements based on number of matches
    if (matches.length === 1) {
      // Single match: Just need enough for each bet (can be less than 1.0 per bet)
      // Allow any stake >= 1.0 (solver will distribute optimally)
      if (budgetNum < 1.0) {
        toast.error(`❌ Minimum stake for single match: 1.00`);
        return false;
      }
    } else {
      // Multiple matches: Need at least 1.0 per bet to avoid solver failures
      const minimumRequired = totalBets * 1.0;
      if (budgetNum < minimumRequired) {
        toast.error(
          `❌ Insufficient stake! You have ${totalBets} bets requiring minimum ${minimumRequired.toFixed(2)}. ` +
          `Please increase your stake to at least ${Math.ceil(minimumRequired)}.00`
        );
        return false;
      }
    }

    return true;
  };

  // ============================================
  // ✅ SOLVE WITH ERROR HANDLING
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

      // ✅ CHECK SOLVER RESPONSE
      if (res.status === "InsufficientBankrollForMinimums") {
        toast.error(
          `❌ Solver failed: Need at least ${res.total_min_required?.toFixed(2)} for minimum stakes. ` +
          `Please increase your stake to at least ${Math.ceil(res.total_min_required || 12)}.00`
        );
        setLoading(false);
        return;
      }

      if (res.status !== "Optimal") {
        toast.error(`❌ Solver failed with status: ${res.status}`);
        setLoading(false);
        return;
      }

      // ✅ Success - pass to AI Advisor
      toast.success("✅ Stakes calculated successfully!");
      onSolved(res, bets, matches, parseFloat(budget));

    } catch (err) {
      console.error("Solve error:", err);
      toast.error("❌ Error: " + err.message);
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

  const safeBankroll = bankroll ?? 0;
  const displayBankroll = safeBankroll.toFixed(2);

  // ✅ Calculate recommended minimum stake
  const totalBets = matches.reduce((sum, match) => {
    const validOdds = [match.home, match.draw, match.away, match.hd, match.ad, match.ha]
      .filter(o => o && parseFloat(o) > 0);
    return sum + validOdds.length;
  }, 0);
  const recommendedMinimum = Math.max(totalBets * 1.0, 12);

  return (
    <div className="bg-white p-5 rounded-xl shadow-md mb-6">
      <h2 className="text-lg font-semibold mb-4">⚙️ Step 1: Calculate Stakes</h2>
      
      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-800">
        💡 <b>Calculate stakes first</b> — bankroll is only deducted when you place bets
      </div>

      {/* ✅ MINIMUM STAKE WARNING */}
      {totalBets > 0 && matches.length > 1 && (
        <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-4 text-sm text-orange-800">
          ⚠️ <b>Minimum stake required:</b> {recommendedMinimum.toFixed(2)} 
          ({totalBets} bets × 1.00 each)
        </div>
      )}

      {totalBets > 0 && matches.length === 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-800">
          💡 <b>Single match:</b> Minimum {totalBets.toFixed(2)} required ({totalBets} bets)
        </div>
      )}

      {/* Budget & Actions */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="font-medium">💰 Stake:</label>
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="border px-3 py-2 rounded w-32"
          min={recommendedMinimum}
          max={safeBankroll}
        />
        <span className="text-sm text-gray-500">
          (Available: {displayBankroll})
        </span>

        {/* ✅ Quick Set Minimum Button */}
        {totalBets > 0 && parseFloat(budget) < recommendedMinimum && matches.length > 1 && (
          <button
            onClick={() => setBudget(recommendedMinimum.toString())}
            className="text-sm px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
          >
            Set Minimum ({recommendedMinimum.toFixed(2)})
          </button>
        )}

        <button
          onClick={addMatch}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-md transition"
        >
          ➕ Add Match
        </button>

        <button
          onClick={handleSolve}
          disabled={loading || parseFloat(budget) > safeBankroll || (matches.length > 1 && parseFloat(budget) < recommendedMinimum) || (matches.length === 1 && parseFloat(budget) < totalBets)}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded shadow-md transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? "Calculating..." : "⚡ Calculate Stakes"}
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