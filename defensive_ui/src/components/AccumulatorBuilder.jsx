// defensive_ui/src/components/AccumulatorBuilder.jsx
// ⭐ UPDATED: Improved matching, safe stake handling, stable AI loading
import React, { useState, useEffect } from "react";
import { useToast } from "./Toast";
import { useBankroll } from "../context/BankrollContext";
import { saveBetRecord } from "../utils/db";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001/api";

export default function AccumulatorBuilder({ matches, aiPreSelectedLegs = null }) {
  const [selections, setSelections] = useState({});
  const [accumulator, setAccumulator] = useState(null);
  const [stake, setStake] = useState(10);
  const [placing, setPlacing] = useState(false);

  const toast = useToast();
  const { bankroll, deductStake } = useBankroll();

  // Normalizing helper
  const normalize = (v) => (v || "").toString().toLowerCase().trim();

  // ⭐ UPDATED: Robust AI leg-load support
  useEffect(() => {
    if (aiPreSelectedLegs) {
      const cleaned = {};
      Object.entries(aiPreSelectedLegs).forEach(([rawIdx, sel]) => {
        const idx = parseInt(rawIdx);
        if (!isNaN(idx)) cleaned[idx] = sel;
      });

      setSelections(cleaned);
      toast.info("🤖 AI accumulator legs loaded!");
    }
  }, [aiPreSelectedLegs]);

  // Recalculate accumulator
  useEffect(() => {
    if (Object.keys(selections).length > 0) {
      calculateAccumulator();
    } else {
      setAccumulator(null);
    }
  }, [selections]);

  const calculateAccumulator = async () => {
    try {
      const selectionsArray = Object.entries(selections).map(
        ([matchIdx, selection]) => ({
          match_index: parseInt(matchIdx),
          selection,
        })
      );

      const response = await fetch(`${API_BASE}/create_accumulator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matches: matches.map((m) => ({
            name: m.name || m.id,
            home: parseFloat(m.home) || 0,
            draw: parseFloat(m.draw) || 0,
            away: parseFloat(m.away) || 0,
            hd: parseFloat(m.hd) || 0,
            ad: parseFloat(m.ad) || 0,
            ha: parseFloat(m.ha) || 0,
          })),
          selections: selectionsArray,
        }),
      });

      const data = await response.json();
      setAccumulator(data);
    } catch (err) {
      console.error("Failed to create accumulator:", err);
      toast.error("Failed to calculate accumulator");
    }
  };

  const handleSelectionChange = (matchIndex, selection) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[matchIndex] === selection) {
        delete next[matchIndex]; // deselect
      } else {
        next[matchIndex] = selection;
      }
      return next;
    });
  };

  const clearSelections = () => {
    setSelections({});
  };

  // ⭐ UPDATED: Safe stake input
  const handleStakeChange = (e) => {
    const val = e.target.value;
    if (val === "") {
      setStake("");
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) setStake(num);
  };

  // ⭐ UPDATED: Stability, pre-calc, bank deduction sync
  const handlePlaceBet = async () => {
    if (!accumulator || placing) return;

    const numSelections = Object.keys(selections).length;
    if (numSelections < 2) {
      toast.warning("Select at least 2 outcomes to place accumulator");
      return;
    }

    const stakeAmount = parseFloat(stake);
    if (isNaN(stakeAmount) || stakeAmount <= 0) {
      toast.error("Invalid stake amount");
      return;
    }

    if (stakeAmount > bankroll) {
      toast.error(`Insufficient bankroll (${bankroll.toFixed(2)})`);
      return;
    }

    // Confirm placement
    if (
      !confirm(
        `Place accumulator bet?\n\n` +
          `Stake: ${stakeAmount.toFixed(2)}\n` +
          `Total Odds: ${accumulator.total_odds}x\n` +
          `Potential Win: ${(stakeAmount * accumulator.total_odds).toFixed(
            2
          )}\n` +
          `Risk: ${accumulator.risk_level}`
      )
    ) {
      return;
    }

    setPlacing(true);

    try {
      await deductStake(stakeAmount);

      await saveBetRecord({
        matches: matches.map((m) => ({ ...m })),
        stakes: { ACCA: stakeAmount },
        outcomes: [Object.values(selections)],
        nets: [
          -stakeAmount,
          stakeAmount * accumulator.total_odds - stakeAmount,
        ],
        R: -stakeAmount,
        selectedOutcomes: [0],
        strategy: "accumulator",
        budget: stakeAmount,
        status: "placed",
        applied: false,
        resolved: false,
        accumulatorData: {
          legs: accumulator.legs,
          totalOdds: accumulator.total_odds,
          selections: selections,
        },
      });

      toast.success(`✅ Accumulator placed! Stake: ${stakeAmount.toFixed(2)}`);

      clearSelections();
      setStake(10);

      setTimeout(() => {
        toast.info("💡 Record match results in the Results tab");
      }, 1500);
    } catch (err) {
      console.error("Failed to place accumulator:", err);
      toast.error("Failed to place bet: " + err.message);
    } finally {
      setPlacing(false);
    }
  };

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-white p-5 rounded-xl shadow-md">
        <p className="text-gray-500 text-center">
          Enter match odds to build accumulators
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">🎲 Accumulator Builder</h2>
        {Object.keys(selections).length > 0 && (
          <button
            onClick={clearSelections}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Clear All
          </button>
        )}
      </div>

      {Object.keys(selections).length >= 2 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-800">
          💡 <b>Ready to place!</b> Select stake and click "Place Bet" below
        </div>
      )}

      {/* Match selection grid */}
      <div className="space-y-4 mb-6">
        {matches.map((match, idx) => (
          <div key={idx} className="border rounded-lg p-3 bg-gray-50">
            <div className="font-medium mb-2">
              {match.name || `Match ${idx + 1}`}
            </div>

            <div className="grid grid-cols-6 gap-2">
              {[
                { label: "1", value: "H", odds: match.home },
                { label: "X", value: "D", odds: match.draw },
                { label: "2", value: "A", odds: match.away },
                { label: "1X", value: "HD", odds: match.hd },
                { label: "X2", value: "AD", odds: match.ad },
                { label: "12", value: "HA", odds: match.ha },
              ].map(
                ({ label, value, odds }) =>
                  odds && (
                    <button
                      key={value}
                      onClick={() => handleSelectionChange(idx, value)}
                      className={`px-2 py-2 rounded text-sm transition ${
                        selections[idx] === value
                          ? "bg-indigo-600 text-white font-bold"
                          : "bg-white hover:bg-gray-100"
                      }`}
                    >
                      {label}
                      <div className="text-xs">{parseFloat(odds).toFixed(2)}</div>
                    </button>
                  )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {accumulator && (
        <div className="border-t pt-4">
          <div className="bg-indigo-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between mb-3">
              <h3 className="font-semibold">Accumulator Slip</h3>
              <div className="text-right">
                <div className="text-xs text-gray-600">Total Odds</div>
                <div className="text-2xl font-bold text-indigo-600">
                  {accumulator.total_odds}x
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {accumulator.legs.map((leg, i) => (
                <div key={i} className="flex justify-between bg-white rounded p-2 text-sm">
                  <span>{leg.match}: <b>{leg.selection}</b></span>
                  <span className="font-medium text-indigo-600">{leg.odds}x</span>
                </div>
              ))}
            </div>

            {/* Stake */}
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm font-medium">Stake:</label>
              <input
                type="number"
                value={stake}
                onChange={handleStakeChange}
                className="border px-3 py-2 rounded w-24"
                min="1"
                max={bankroll}
              />
              <span className="text-sm text-gray-600">
                → Potential Win:{" "}
                <b className="text-green-600">
                  {(stake * accumulator.total_odds).toFixed(2)}
                </b>
              </span>
            </div>

            <div className="bg-white rounded p-3 border text-sm mb-4">
              <div className="font-medium mb-1">AI Recommendation</div>
              <div className="text-gray-600">
                Suggested stake: {accumulator.recommended_stake_percent}% of bankroll ≈{" "}
                {(
                  (bankroll * accumulator.recommended_stake_percent) /
                  100
                ).toFixed(2)}
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-3 text-sm text-orange-800">
              ⚠️ Bankroll will be deducted when you place this bet
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition font-medium disabled:bg-gray-400"
              onClick={handlePlaceBet}
              disabled={
                placing ||
                parseFloat(stake) > bankroll ||
                parseFloat(stake) <= 0
              }
            >
              {placing ? "Placing Bet..." : "✅ Place Accumulator Bet"}
            </button>

            <button
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              onClick={clearSelections}
            >
              Clear
            </button>
          </div>

          <div className="mt-3 text-xs text-gray-500 text-center">
            Bet will be recorded in Results tab for outcome tracking
          </div>
        </div>
      )}

      {Object.keys(selections).length === 0 && (
        <div className="text-center text-gray-500 text-sm py-8">
          Click on odds to build your accumulator slip
        </div>
      )}

      {Object.keys(selections).length === 1 && (
        <div className="text-center text-orange-500 text-sm py-8">
          ⚠️ Select at least 2 outcomes to create an accumulator
        </div>
      )}
    </div>
  );
}
