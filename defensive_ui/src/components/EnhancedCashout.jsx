// defensive_ui/src/components/EnhancedCashout.jsx
// ⭐ COMPLETE STRATEGIC CASHOUT with in-game scenarios

import React, { useState } from "react";
import { useToast } from "./Toast";
import { useBankroll } from "../context/BankrollContext";
import { cashoutBet } from "../utils/db";

export default function EnhancedCashout({ bet, onComplete }) {
  const [scenario, setScenario] = useState(null);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedBets, setSelectedBets] = useState([]);
  const [processing, setProcessing] = useState(false);

  const toast = useToast();
  const { addWinnings } = useBankroll();

  if (!bet) return null;

  // Calculate total stake
  const totalStake = bet.strategy === "accumulator"
    ? Number(bet.stakes?.ACCA || 0)
    : Object.values(bet.stakes || {}).reduce((s, v) => s + Number(v || 0), 0);

  // Parse individual stakes
  const individualStakes = Object.entries(bet.stakes || {})
    .filter(([betId]) => betId !== "ACCA")
    .map(([betId, stake]) => {
      const parts = betId.split("_");
      const matchIdx = parseInt(parts[0].replace("M", "")) - 1;
      const betType = parts[1];
      const match = bet.matches?.[matchIdx];

      return {
        betId,
        stake: Number(stake),
        matchIdx,
        betType,
        matchName: match?.name || `Match ${matchIdx + 1}`,
        odds: getOddsForBet(match, betType),
        label: getBetLabel(betType),
      };
    });

  // ⭐ ENHANCED SCENARIOS with game-state logic
  const scenarios = [
    {
      id: "expecting_draw",
      name: "🎯 Game Heading to Draw",
      description: "Cash out home/away bets, keep draw options",
      keepBets: ["D", "HD", "AD"],
      cashoutBets: ["H", "A", "HA"],
      color: "blue",
      reasoning: "Match looks even - secure draw coverage"
    },
    {
      id: "expecting_home",
      name: "🏠 Home Team Dominating",
      description: "Cash out away/draw, keep home options",
      keepBets: ["H", "HD", "HA"],
      cashoutBets: ["D", "A", "AD"],
      color: "green",
      reasoning: "Home team in control - maximize home win profit"
    },
    {
      id: "expecting_away",
      name: "✈️ Away Team on Top",
      description: "Cash out home/draw, keep away options",
      keepBets: ["A", "AD", "HA"],
      cashoutBets: ["H", "D", "HD"],
      color: "red",
      reasoning: "Away team dominating - secure away win"
    },
    {
      id: "no_draw_likely",
      name: "🚫 Draw Unlikely (Action Game)",
      description: "Cash out all draw bets, keep H/A",
      keepBets: ["H", "A", "HA"],
      cashoutBets: ["D", "HD", "AD"],
      color: "purple",
      reasoning: "Open game with goals - draw odds dropping"
    },
    {
      id: "safe_exit_75",
      name: "💰 Secure 75% (Defensive)",
      description: "Lock in most value, minimal risk exposure",
      partial: 0.75,
      color: "yellow",
      reasoning: "Guaranteed profit, keep 25% riding"
    },
    {
      id: "safe_exit_50",
      name: "⚖️ Balanced Exit (50%)",
      description: "Take half, let half run",
      partial: 0.5,
      color: "indigo",
      reasoning: "Balance between security and upside"
    },
    {
      id: "full_cashout",
      name: "🛑 Emergency Exit (100%)",
      description: "Close all positions immediately",
      partial: 1.0,
      color: "orange",
      reasoning: "Cut losses or secure all profit NOW"
    },
    {
      id: "custom",
      name: "⚙️ Manual Selection",
      description: "Choose specific bets to cash out",
      custom: true,
      color: "gray",
      reasoning: "Full control over which bets to exit"
    },
  ];

  // ⭐ IMPROVED VALUE CALCULATION
  const calculateScenarioValue = (scenario) => {
    if (scenario.custom) return null;

    if (scenario.partial) {
      // Estimate current live value (70% of potential payout)
      const liveValue = individualStakes.reduce(
        (sum, s) => sum + s.stake * s.odds * 0.70,
        0
      );
      return liveValue * scenario.partial;
    }

    // Strategic: sum of cashed-out positions (70% of full payout)
    let value = 0;
    individualStakes.forEach((s) => {
      if (scenario.cashoutBets.includes(s.betType)) {
        value += s.stake * s.odds * 0.70;
      }
    });

    return value;
  };

  const handleScenarioSelect = (scenario) => {
    setScenario(scenario);

    if (scenario.custom) {
      setSelectedBets([]);
      return;
    }

    if (scenario.partial) {
      setSelectedBets(individualStakes.map((s) => s.betId));
      const suggestedAmount = calculateScenarioValue(scenario);
      setCustomAmount(suggestedAmount.toFixed(2));
      return;
    }

    // Strategic: pre-select target bets
    setSelectedBets(
      individualStakes
        .filter((s) => scenario.cashoutBets.includes(s.betType))
        .map((s) => s.betId)
    );
  };

  const executeCashout = async () => {
    if (!scenario) {
      toast.error("Select a cashout strategy first");
      return;
    }

    if (scenario.custom && selectedBets.length === 0) {
      toast.error("Select at least one bet to cash out");
      return;
    }

    let cashoutAmount;

    if (scenario.partial) {
      cashoutAmount = parseFloat(customAmount);
      if (!cashoutAmount || cashoutAmount <= 0) {
        toast.error("Enter valid cashout amount");
        return;
      }
    } else {
      // Calculate from selected bets
      cashoutAmount = selectedBets.reduce((sum, betId) => {
        const s = individualStakes.find((x) => x.betId === betId);
        return sum + (s ? s.stake * s.odds * 0.70 : 0);
      }, 0);
    }

    // Confirm
    const keepingCount = individualStakes.length - selectedBets.length;
    if (!confirm(
      `💰 Cashout Confirmation\n\n` +
      `Amount: ${cashoutAmount.toFixed(2)}\n` +
      `Original Stake: ${totalStake.toFixed(2)}\n` +
      `Net P/L: ${(cashoutAmount - totalStake).toFixed(2)}\n\n` +
      `Cashing Out: ${selectedBets.length} bet(s)\n` +
      `Keeping: ${keepingCount} bet(s)\n\n` +
      `Reason: ${scenario.reasoning}`
    )) {
      return;
    }

    setProcessing(true);

    try {
      const net = await cashoutBet(bet.id, cashoutAmount);

      if (net > 0) {
        await addWinnings(net);
        toast.success(`✅ Cashed out! Profit: +${net.toFixed(2)}`);
      } else if (net < 0) {
        toast.warning(`⚠️ Loss limited: ${net.toFixed(2)}`);
      } else {
        toast.info("Break-even cashout");
      }

      onComplete();
    } catch (err) {
      console.error(err);
      toast.error("Cashout failed: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Position */}
      <div className="bg-gray-50 rounded border p-3">
        <h4 className="font-semibold mb-2">📊 Current Position</h4>
        <div className="grid grid-cols-2 text-sm gap-2">
          <div>
            <div className="text-gray-600">Total Stake</div>
            <div className="font-bold">{totalStake.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-600">Active Bets</div>
            <div className="font-bold">{individualStakes.length}</div>
          </div>
        </div>
      </div>

      {/* Scenario Selection */}
      <div>
        <h4 className="font-semibold mb-2">🎮 Choose Strategy</h4>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {scenarios.map((s) => {
            const value = calculateScenarioValue(s);
            const isSelected = scenario?.id === s.id;

            return (
              <button
                key={s.id}
                onClick={() => handleScenarioSelect(s)}
                className={`w-full text-left p-3 rounded-lg border-2 transition ${
                  isSelected
                    ? `border-${s.color}-500 bg-${s.color}-50`
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-gray-600">{s.description}</div>
                    <div className="text-xs text-gray-500 mt-1 italic">
                      💡 {s.reasoning}
                    </div>
                  </div>
                  {value && (
                    <div className="text-sm font-bold text-green-600 ml-2">
                      ~{value.toFixed(2)}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Bet Selection */}
      {scenario?.custom && (
        <div>
          <h4 className="font-semibold mb-2">Select Bets to Cash Out</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {individualStakes.map((s) => (
              <label
                key={s.betId}
                className="flex items-center p-2 border rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedBets.includes(s.betId)}
                  onChange={(e) =>
                    setSelectedBets(
                      e.target.checked
                        ? [...selectedBets, s.betId]
                        : selectedBets.filter((id) => id !== s.betId)
                    )
                  }
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {s.matchName}: {s.label}
                  </div>
                  <div className="text-xs text-gray-600">
                    Stake {s.stake.toFixed(2)} @ {s.odds.toFixed(2)}x
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Partial Cashout Amount */}
      {scenario?.partial && (
        <div>
          <label className="block text-sm font-medium mb-2">
            💵 Cashout Amount
          </label>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-full border p-3 rounded"
            placeholder="Enter amount"
          />
          <div className="text-xs text-gray-500 mt-1">
            Suggested: {calculateScenarioValue(scenario)?.toFixed(2)}
          </div>
        </div>
      )}

      {/* Preview */}
      {scenario && !scenario.custom && !scenario.partial && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
          <div className="font-medium mb-2">📋 Preview</div>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-green-700 font-semibold">Keeping:</span>{" "}
              {individualStakes
                .filter((s) => !selectedBets.includes(s.betId))
                .map((s) => s.label)
                .join(", ") || "None"}
            </div>
            <div>
              <span className="text-red-700 font-semibold">Cashing Out:</span>{" "}
              {individualStakes
                .filter((s) => selectedBets.includes(s.betId))
                .map((s) => s.label)
                .join(", ") || "None"}
            </div>
          </div>
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={executeCashout}
        disabled={processing || !scenario}
        className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:bg-gray-400 font-medium shadow-md"
      >
        {processing ? "Processing..." : "💰 Execute Cashout"}
      </button>
    </div>
  );
}

// Helper functions
function getOddsForBet(match, betType) {
  if (!match) return 1.0;
  const map = {
    H: match.home,
    D: match.draw,
    A: match.away,
    HD: match.hd,
    AD: match.ad,
    HA: match.ha,
  };
  return Number(map[betType] || 1.0);
}

function getBetLabel(betType) {
  const labels = {
    H: "Home Win (1)",
    D: "Draw (X)",
    A: "Away Win (2)",
    HD: "Home/Draw (1X)",
    AD: "Away/Draw (X2)",
    HA: "Home/Away (12)",
  };
  return labels[betType] || betType;
}