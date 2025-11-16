// defensive_ui/src/components/AccumulatorBuilder.jsx
import React, { useState, useEffect } from "react";
import { useToast } from "./Toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001/api";

export default function AccumulatorBuilder({ matches }) {
  const [selections, setSelections] = useState({});
  const [accumulator, setAccumulator] = useState(null);
  const [stake, setStake] = useState(10);
  const toast = useToast();

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
      const updated = { ...prev };
      if (updated[matchIndex] === selection) {
        delete updated[matchIndex]; // Deselect
      } else {
        updated[matchIndex] = selection;
      }
      return updated;
    });
  };

  const clearSelections = () => {
    setSelections({});
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

      {/* Match Selections */}
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

      {/* Accumulator Summary */}
      {accumulator && (
        <div className="border-t pt-4">
          <div className="bg-indigo-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Accumulator Slip</h3>
              <div className="text-right">
                <div className="text-xs text-gray-600">Total Odds</div>
                <div className="text-2xl font-bold text-indigo-600">
                  {accumulator.total_odds}x
                </div>
              </div>
            </div>

            {/* Legs */}
            <div className="space-y-2 mb-4">
              {accumulator.legs.map((leg, i) => (
                <div
                  key={i}
                  className="flex justify-between bg-white rounded p-2 text-sm"
                >
                  <span className="text-gray-700">
                    {leg.match}: <b>{leg.selection}</b>
                  </span>
                  <span className="font-medium text-indigo-600">
                    {leg.odds}x
                  </span>
                </div>
              ))}
            </div>

            {/* Risk Analysis */}
            <div className="grid grid-cols-3 gap-3 text-center text-sm mb-4">
              <div className="bg-white rounded p-2">
                <div className="text-xs text-gray-600">Legs</div>
                <div className="font-bold">{accumulator.num_legs}</div>
              </div>
              <div className="bg-white rounded p-2">
                <div className="text-xs text-gray-600">Win %</div>
                <div className="font-bold text-green-600">
                  {accumulator.win_probability}%
                </div>
              </div>
              <div className="bg-white rounded p-2">
                <div className="text-xs text-gray-600">Risk</div>
                <div
                  className={`font-bold ${
                    accumulator.risk_level === "Low"
                      ? "text-green-600"
                      : accumulator.risk_level === "Medium"
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {accumulator.risk_level}
                </div>
              </div>
            </div>

            {/* Stake Input */}
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm font-medium">Stake:</label>
              <input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="border px-3 py-2 rounded w-24"
                min="1"
              />
              <span className="text-sm text-gray-600">
                → Potential Win:{" "}
                <b className="text-green-600">
                  {(stake * accumulator.total_odds).toFixed(2)}
                </b>
              </span>
            </div>

            {/* Recommendation */}
            <div className="bg-white rounded p-3 border text-sm">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <div>
                  <div className="font-medium mb-1">AI Recommendation</div>
                  <div className="text-gray-600">
                    Suggested stake: {accumulator.recommended_stake_percent}% of
                    bankroll
                  </div>
                  {accumulator.risk_level === "High" && (
                    <div className="text-orange-600 mt-1">
                      ⚠️ High risk accumulator - consider reducing stake or
                      removing legs
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition font-medium"
              onClick={() => toast.success("Accumulator saved to slip!")}
            >
              Add to Slip
            </button>
            <button
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              onClick={clearSelections}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {Object.keys(selections).length === 0 && (
        <div className="text-center text-gray-500 text-sm py-8">
          Click on odds to build your accumulator slip
        </div>
      )}
    </div>
  );
}