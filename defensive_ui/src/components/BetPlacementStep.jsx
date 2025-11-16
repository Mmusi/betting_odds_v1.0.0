// defensive_ui/src/components/BetPlacementStep.jsx
// ✅ PHASE 3: Place bets and DEDUCT bankroll
import React, { useState } from "react";
import { useBankroll } from "../context/BankrollContext";
import { saveBetRecord } from "../utils/db";
import { useToast } from "./Toast";

export default function BetPlacementStep({ betPlan, onComplete }) {
  const { deductStake } = useBankroll();
  const toast = useToast();
  const [placing, setPlacing] = useState(false);

  if (!betPlan) return null;

  const { solution, matches, selectedOutcomes, strategy, budget } = betPlan;

  // Calculate total stake
  const totalStake = Object.values(solution.stakes || {}).reduce(
    (sum, stake) => sum + stake,
    0
  );

  // Group stakes by match
  const groupedStakes = {};
  for (const [betId, stake] of Object.entries(solution.stakes || {})) {
    const matchId = betId.split("_")[0];
    if (!groupedStakes[matchId]) groupedStakes[matchId] = [];
    groupedStakes[matchId].push({ betId, stake });
  }

  const prettyLabel = (betId) => {
    if (betId.includes("_H") && !betId.includes("_HD") && !betId.includes("_HA"))
      return "Home Win (1)";
    if (betId.includes("_D") && !betId.includes("_HD") && !betId.includes("_AD"))
      return "Draw (X)";
    if (betId.includes("_A") && !betId.includes("_AD") && !betId.includes("_HA"))
      return "Away Win (2)";
    if (betId.includes("_HD")) return "Home or Draw (1X)";
    if (betId.includes("_AD")) return "Away or Draw (X2)";
    if (betId.includes("_HA")) return "Home or Away (12)";
    return betId;
  };

  const handlePlaceBets = async () => {
    if (placing) return;

    setPlacing(true);
    try {
      // 1. Deduct bankroll
      await deductStake(totalStake);

      // 2. Save bet record
      await saveBetRecord({
        matches: matches.map(m => ({ ...m })),
        stakes: solution.stakes,
        outcomes: solution.omega,
        nets: solution.nets,
        R: solution.R,
        selectedOutcomes,
        strategy,
        budget,
        status: "placed",
        applied: false,
        resolved: false,
      });

      toast.success("✅ Bets placed successfully!");

      // 3. Clear form and return to start
      setTimeout(() => {
        onComplete();
      }, 1500);

    } catch (err) {
      console.error("Failed to place bets:", err);
      toast.error("Failed to place bets: " + err.message);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-md mb-6">
      <h2 className="text-lg font-semibold mb-4">💳 Step 3: Place Bets</h2>

      {/* Warning Banner */}
      <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-4 text-sm text-orange-800">
        ⚠️ <b>Bankroll will be deducted</b> when you confirm placement
      </div>

      {/* Bet Summary */}
      <div className="border rounded-lg p-4 bg-gray-50 mb-4">
        <h3 className="font-semibold mb-3">Bet Summary</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-600">Total Stake</div>
            <div className="text-2xl font-bold text-blue-600">
              {totalStake.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600">Strategy</div>
            <div className="text-xl font-bold text-indigo-600">
              {strategy === "single" ? "Individual Bets" : "Accumulator"}
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Selected Outcomes: {selectedOutcomes.length} of {solution.omega.length}
        </div>
      </div>

      {/* Detailed Stakes by Match */}
      <div className="space-y-3 mb-6">
        {Object.keys(groupedStakes).map((matchId) => {
          const matchIndex = parseInt(matchId.replace("M", "")) - 1;
          const match = matches[matchIndex];

          return (
            <div key={matchId} className="border rounded-lg p-4 bg-white">
              <h4 className="font-medium mb-2">
                {match?.name || `Match ${matchIndex + 1}`}
              </h4>

              <div className="space-y-1">
                {groupedStakes[matchId].map(({ betId, stake }) => (
                  <div
                    key={betId}
                    className="flex justify-between text-sm py-1 border-b last:border-0"
                  >
                    <span className="text-gray-700">{prettyLabel(betId)}</span>
                    <span className="font-semibold">{stake.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expected Outcomes */}
      <div className="border rounded-lg p-4 bg-indigo-50 mb-6">
        <h4 className="font-semibold mb-2">Expected Outcomes (Selected)</h4>
        <div className="space-y-2">
          {selectedOutcomes.map((idx) => {
            const outcome = solution.omega[idx];
            const net = solution.nets[idx];

            return (
              <div
                key={idx}
                className="flex justify-between text-sm bg-white rounded p-2"
              >
                <span>
                  {outcome.map((r, j) => (
                    <span key={j} className="mr-2">
                      {matches[j]?.name?.split(" vs ")[r === "H" ? 0 : 1]?.split(" ")[0] || 
                        `M${j + 1}`}: <b>{r === "H" ? "1" : r === "D" ? "X" : "2"}</b>
                    </span>
                  ))}
                </span>
                <span
                  className={`font-bold ${
                    net >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {net >= 0 ? "+" : ""}
                  {net.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handlePlaceBets}
          disabled={placing}
          className="flex-1 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg"
        >
          {placing ? "Placing Bets..." : "✅ Confirm & Place Bets"}
        </button>

        <button
          onClick={() => onComplete()}
          className="px-6 py-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
        >
          Cancel
        </button>
      </div>

      {/* Disclaimer */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        By placing bets, you confirm the stakes and understand bankroll will be
        deducted immediately
      </div>
    </div>
  );
}