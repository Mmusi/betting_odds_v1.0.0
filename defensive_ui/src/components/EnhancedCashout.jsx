// defensive_ui/src/components/EnhancedCashout.jsx
// ✅ Strategic cashout with multiple scenarios (updated safely)
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

  // =============================
  // TOTAL STAKE (Acca or Singles)
  // =============================
  const totalStake =
    bet.strategy === "accumulator"
      ? Number(bet.stakes?.ACCA || 0)
      : Object.values(bet.stakes || {}).reduce((s, v) => s + Number(v || 0), 0);

  // =============================
  // PARSE INDIVIDUAL STAKES
  // =============================
  const individualStakes = Object.entries(bet.stakes || {}).flatMap(
    ([betId, stake]) => {
      if (bet.strategy === "accumulator" && betId === "ACCA") return []; // handled separately

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
    }
  );

  // =============================
  // SCENARIOS
  // =============================
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

  // =============================
  // CASHOUT VALUE ESTIMATOR
  // =============================
  const calculateScenarioValue = (scenario) => {
    if (scenario.custom) return null;

    // PARTIAL CASHOUT
    if (scenario.partial) {
      const liveValue = individualStakes.reduce(
        (sum, s) => sum + s.stake * s.odds * 0.7,
        0
      );
      return liveValue * scenario.partial;
    }

    // STRATEGIC CASHOUT
    let value = 0;
    individualStakes.forEach((stake) => {
      if (scenario.cashoutBets.includes(stake.betType)) {
        value += stake.stake * stake.odds * 0.7;
      }
    });
    return value;
  };

  // =============================
  // HANDLE SCENARIO SELECT
  // =============================
  const handleScenarioSelect = (scenario) => {
    setCashoutScenario(scenario);

    if (scenario.custom) {
      setSelectedBets([]);
      return;
    }

    if (scenario.partial) {
      setSelectedBets(individualStakes.map((s) => s.betId));
      return;
    }

    // Strategic: select only target bets
    setSelectedBets(
      individualStakes
        .filter((s) => scenario.cashoutBets.includes(s.betType))
        .map((s) => s.betId)
    );
  };

  // =============================
  // EXECUTE CASHOUT
  // =============================
  const executeCashout = async () => {
    if (!cashoutScenario) return toast.error("Select a scenario first");

    if (cashoutScenario.custom && selectedBets.length === 0)
      return toast.error("Select at least one bet");

    let cashoutAmount;

    if (cashoutScenario.partial) {
      // custom input amount
      cashoutAmount = parseFloat(customAmount);
      if (!cashoutAmount || cashoutAmount <= 0)
        return toast.error("Enter a valid cashout amount");
    } else {
      // computed from selected stakes
      cashoutAmount = selectedBets.reduce((sum, betId) => {
        const s = individualStakes.find((x) => x.betId === betId);
        return sum + (s ? s.stake * s.odds * 0.7 : 0);
      }, 0);
    }

    if (
      !confirm(
        `Confirm cashout?\n\n` +
          `Cashout: ${cashoutAmount.toFixed(2)}\n` +
          `Original stake: ${totalStake.toFixed(2)}\n` +
          `Net: ${(cashoutAmount - totalStake).toFixed(2)}\n\n` +
          `Keeping: ${
            individualStakes.length - selectedBets.length
          } bet(s)`
      )
    )
      return;

    setProcessing(true);

    try {
      const net = await cashoutBet(bet.id, cashoutAmount);

      if (net > 0) toast.success(`💰 +${net.toFixed(2)} cashed out`);
      else if (net < 0) toast.warning(`${net.toFixed(2)} loss`);
      else toast.info("Break-even cashout");

      if (net !== 0) await addWinnings(net);

      onComplete();
    } catch (err) {
      console.error(err);
      toast.error("Cashout failed");
    } finally {
      setProcessing(false);
    }
  };

  // =============================
  // RENDER
  // =============================
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-gray-50 p-3 rounded border">
        <h4 className="font-semibold mb-2">Current Position</h4>
        <div className="grid grid-cols-2 text-sm">
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

      {/* SCENARIO LIST */}
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
                className={`w-full text-left p-3 rounded-lg border-2 ${
                  isSelected
                    ? `border-${scenario.color}-500 bg-${scenario.color}-50`
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{scenario.name}</span>
                  {value ? (
                    <span className="text-sm font-bold text-green-600">
                      ~{value.toFixed(2)}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-gray-600">{scenario.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CUSTOM SELECTION */}
      {cashoutScenario?.custom && (
        <div>
          <h4 className="font-semibold mb-2">Select Bets to Cash Out</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {individualStakes.map((s) => (
              <label
                key={s.betId}
                className="flex items-center p-2 rounded border hover:bg-gray-50"
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
                <div>
                  <div className="font-medium text-sm">
                    {s.matchName}: {s.label}
                  </div>
                  <div className="text-xs text-gray-600">
                    Stake {s.stake.toFixed(2)} @ {s.odds.toFixed(2)}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* PARTIAL CASHOUT AMOUNT */}
      {cashoutScenario?.partial && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Cashout Amount
          </label>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-full border p-3 rounded"
          />
          <div className="text-xs text-gray-500 mt-1">
            Suggested:{" "}
            {calculateScenarioValue(cashoutScenario)?.toFixed(2) || "—"}
          </div>
        </div>
      )}

      {/* Preview (strategic only) */}
      {cashoutScenario &&
        !cashoutScenario.custom &&
        !cashoutScenario.partial && (
          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            <div className="text-sm font-medium mb-1">Preview</div>
            <div className="text-xs space-y-1">
              <div>
                <span className="text-green-700 font-semibold">Keeping:</span>{" "}
                {individualStakes
                  .filter((s) => !selectedBets.includes(s.betId))
                  .map((s) => s.label)
                  .join(", ")}
              </div>
              <div>
                <span className="text-red-700 font-semibold">Cashing:</span>{" "}
                {individualStakes
                  .filter((s) => selectedBets.includes(s.betId))
                  .map((s) => s.label)
                  .join(", ")}
              </div>
            </div>
          </div>
        )}

      {/* EXECUTE */}
      <button
        onClick={executeCashout}
        disabled={processing || !cashoutScenario}
        className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg disabled:bg-gray-400 font-medium"
      >
        {processing ? "Processing..." : "💰 Execute Cashout"}
      </button>
    </div>
  );
}

// =============================
// HELPERS
// =============================
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
