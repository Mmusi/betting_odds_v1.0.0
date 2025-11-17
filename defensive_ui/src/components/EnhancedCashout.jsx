// defensive_ui/src/components/EnhancedCashout.jsx
// ✅ Strategic cashout with multiple scenarios
import React, { useState } from "react";
import { useToast } from "./Toast";
import { useBankroll } from "../context/BankrollContext";
import { cashoutBet } from "../utils/db";

export default function EnhancedCashout({ bet, onComplete }) {
  const [cashoutScenario, setCashoutScenario] = useState(null);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedBets, setSelectedBets] = useState([]);
  const [processing, setProcessing] = useState(false);

  const toast = useToast();
  const { addWinnings } = useBankroll();

  if (!bet) return null;

  // Get total stake
  const totalStake = bet.strategy === "accumulator"
    ? (bet.stakes?.ACCA || 0)
    : Object.values(bet.stakes || {}).reduce((sum, s) => sum + s, 0);

  // Parse individual stakes
  const individualStakes = Object.entries(bet.stakes || {}).map(([betId, stake]) => {
    const parts = betId.split("_");
    const matchIdx = parseInt(parts[0].replace("M", "")) - 1;
    const betType = parts[1];
    const match = bet.matches?.[matchIdx];

    return {
      betId,
      stake,
      matchIdx,
      betType,
      matchName: match?.name || `Match ${matchIdx + 1}`,
      odds: getOddsForBet(match, betType),
      label: getBetLabel(betType),
    };
  });

  // ============================================
  // STRATEGIC CASHOUT SCENARIOS
  // ============================================
  const scenarios = [
    {
      id: "expecting_draw",
      name: "🎯 Expecting Draw",
      description: "Keep Draw, HD (1X), AD (X2). Cash out H, A, HA",
      keepBets: ["D", "HD", "AD"],
      cashoutBets: ["H", "A", "HA"],
      color: "blue",
    },
    {
      id: "expecting_home",
      name: "🏠 Expecting Home Win",
      description: "Keep Home, HD (1X), HA (12). Cash out D, A, AD",
      keepBets: ["H", "HD", "HA"],
      cashoutBets: ["D", "A", "AD"],
      color: "green",
    },
    {
      id: "expecting_away",
      name: "✈️ Expecting Away Win",
      description: "Keep Away, AD (X2), HA (12). Cash out H, D, HD",
      keepBets: ["A", "AD", "HA"],
      cashoutBets: ["H", "D", "HD"],
      color: "red",
    },
    {
      id: "no_draw",
      name: "🚫 Draw Unlikely",
      description: "Keep Home, Away, HA (12). Cash out D, HD, AD",
      keepBets: ["H", "A", "HA"],
      cashoutBets: ["D", "HD", "AD"],
      color: "purple",
    },
    {
      id: "safe_exit",
      name: "💰 Safe Exit (50%)",
      description: "Cash out 50% of all positions to secure profit",
      partial: 0.5,
      color: "yellow",
    },
    {
      id: "full_cashout",
      name: "🛑 Full Cashout",
      description: "Exit all positions immediately",
      partial: 1.0,
      color: "orange",
    },
    {
      id: "custom",
      name: "⚙️ Custom Selection",
      description: "Manually select which bets to cash out",
      custom: true,
      color: "gray",
    },
  ];

  // ============================================
  // CALCULATE SCENARIO VALUE
  // ============================================
  const calculateScenarioValue = (scenario) => {
    if (scenario.custom) return null;

    if (scenario.partial) {
      // Partial cashout - estimate current value
      const estimatedCurrentValue = totalStake * 1.3; // Assume 30% profit in-play
      return estimatedCurrentValue * scenario.partial;
    }

    // Strategic cashout - sum of cashed out stakes
    let cashoutValue = 0;
    individualStakes.forEach((stake) => {
      if (scenario.cashoutBets?.includes(stake.betType)) {
        // Estimate cashout at 70% of potential payout
        cashoutValue += stake.stake * stake.odds * 0.7;
      }
    });

    return cashoutValue;
  };

  // ============================================
  // HANDLE SCENARIO SELECTION
  // ============================================
  const handleScenarioSelect = (scenario) => {
    if (scenario.custom) {
      setCashoutScenario(scenario);
      setSelectedBets([]);
      return;
    }

    setCashoutScenario(scenario);

    if (scenario.cashoutBets) {
      // Select specific bets to cash out
      const toSelect = individualStakes
        .filter((s) => scenario.cashoutBets.includes(s.betType))
        .map((s) => s.betId);
      setSelectedBets(toSelect);
    } else if (scenario.partial) {
      // Select all bets for partial cashout
      setSelectedBets(individualStakes.map((s) => s.betId));
    }
  };

  // ============================================
  // EXECUTE CASHOUT
  // ============================================
  const executeCashout = async () => {
    if (!cashoutScenario) {
      toast.error("Select a cashout scenario");
      return;
    }

    if (cashoutScenario.custom && selectedBets.length === 0) {
      toast.error("Select at least one bet to cash out");
      return;
    }

    let cashoutAmount;

    if (cashoutScenario.partial) {
      // Use custom amount for partial/full cashout
      cashoutAmount = parseFloat(customAmount);
      if (isNaN(cashoutAmount) || cashoutAmount <= 0) {
        toast.error("Enter valid cashout amount");
        return;
      }
    } else {
      // Calculate from selected bets
      cashoutAmount = selectedBets.reduce((sum, betId) => {
        const stake = individualStakes.find((s) => s.betId === betId);
        return sum + (stake ? stake.stake * stake.odds * 0.7 : 0);
      }, 0);
    }

    if (!confirm(
      `Confirm cashout?\n\n` +
      `Cashout: ${cashoutAmount.toFixed(2)}\n` +
      `Original stake: ${totalStake.toFixed(2)}\n` +
      `Net: ${(cashoutAmount - totalStake).toFixed(2)}\n\n` +
      `Keeping: ${individualStakes.length - selectedBets.length} bet(s)`
    )) {
      return;
    }

    setProcessing(true);
    try {
      const netFromCashout = await cashoutBet(bet.id, cashoutAmount);

      if (netFromCashout > 0) {
        await addWinnings(netFromCashout);
        toast.success(`💰 Cashed out! +${netFromCashout.toFixed(2)}`);
      } else if (netFromCashout < 0) {
        toast.warning(`Cashed out at loss: ${netFromCashout.toFixed(2)}`);
      } else {
        toast.info("Cashed out break-even");
      }

      onComplete();
    } catch (err) {
      console.error("Cashout failed:", err);
      toast.error("Cashout failed: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Bet Summary */}
      <div className="bg-gray-50 rounded-lg p-3 border">
        <h4 className="font-semibold mb-2">Current Position</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
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
        <h4 className="font-semibold mb-2">Choose Cashout Strategy</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {scenarios.map((scenario) => {
            const value = calculateScenarioValue(scenario);
            const isSelected = cashoutScenario?.id === scenario.id;

            return (
              <button
                key={scenario.id}
                onClick={() => handleScenarioSelect(scenario)}
                className={`w-full text-left p-3 rounded-lg border-2 transition ${
                  isSelected
                    ? `border-${scenario.color}-500 bg-${scenario.color}-50`
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-medium">{scenario.name}</div>
                  {value && (
                    <div className="text-sm font-bold text-green-600">
                      ~{value.toFixed(2)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-600">{scenario.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Selection */}
      {cashoutScenario?.custom && (
        <div>
          <h4 className="font-semibold mb-2">Select Bets to Cash Out</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {individualStakes.map((stake) => (
              <label
                key={stake.betId}
                className="flex items-center p-2 rounded border hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedBets.includes(stake.betId)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedBets([...selectedBets, stake.betId]);
                    } else {
                      setSelectedBets(selectedBets.filter((id) => id !== stake.betId));
                    }
                  }}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {stake.matchName}: {stake.label}
                  </div>
                  <div className="text-xs text-gray-600">
                    Stake: {stake.stake.toFixed(2)} @ {stake.odds.toFixed(2)}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Amount Input for Partial/Full Cashout */}
      {cashoutScenario?.partial && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Cashout Amount
          </label>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Enter amount"
            className="w-full border p-3 rounded"
            min="0"
            step="0.01"
          />
          <div className="text-xs text-gray-500 mt-1">
            Suggested: {calculateScenarioValue(cashoutScenario)?.toFixed(2) || "N/A"}
          </div>
        </div>
      )}

      {/* Preview */}
      {cashoutScenario && !cashoutScenario.custom && !cashoutScenario.partial && (
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="text-sm font-medium mb-2">Preview</div>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-green-600 font-medium">Keeping:</span>{" "}
              {individualStakes
                .filter((s) => !selectedBets.includes(s.betId))
                .map((s) => s.label)
                .join(", ")}
            </div>
            <div>
              <span className="text-red-600 font-medium">Cashing out:</span>{" "}
              {individualStakes
                .filter((s) => selectedBets.includes(s.betId))
                .map((s) => s.label)
                .join(", ")}
            </div>
          </div>
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={executeCashout}
        disabled={processing || !cashoutScenario}
        className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
      >
        {processing ? "Processing..." : "💰 Execute Cashout"}
      </button>
    </div>
  );
}

// Helper functions
function getOddsForBet(match, betType) {
  if (!match) return 1.0;
  const oddsMap = {
    H: match.home,
    D: match.draw,
    A: match.away,
    HD: match.hd,
    AD: match.ad,
    HA: match.ha,
  };
  return parseFloat(oddsMap[betType]) || 1.0;
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