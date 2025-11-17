// defensive_ui/src/components/MatchResultsEntry.jsx
// ✅ ENHANCED: Support for accumulator bets + better UI
import React, { useState, useEffect } from "react";
import {
  getPlacedUnresolvedBets,
  recordMatchResults,
  cashoutBet,
} from "../utils/db";
import { useToast } from "./Toast";
import { useBankroll } from "../context/BankrollContext";
import EnhancedCashout from "./EnhancedCashout";

export default function MatchResultsEntry() {
  const [unresolvedBets, setUnresolvedBets] = useState([]);
  const [selectedBet, setSelectedBet] = useState(null);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cashoutMode, setCashoutMode] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState("");

  const toast = useToast();
  const { addWinnings } = useBankroll();

  useEffect(() => {
    loadUnresolvedBets();
  }, []);

  const loadUnresolvedBets = async () => {
    setLoading(true);
    try {
      const bets = await getPlacedUnresolvedBets();
      setUnresolvedBets(bets);
    } catch (err) {
      console.error("Failed to load unresolved bets:", err);
      toast.error("Failed to load pending bets");
    } finally {
      setLoading(false);
    }
  };

  const handleBetSelect = (bet) => {
    setSelectedBet(bet);
    setCashoutMode(false);
    setCashoutAmount("");

    // Initialize results object
    const initial = {};
    bet.matches?.forEach((_, idx) => (initial[idx] = null));
    setResults(initial);
  };

  const handleResultChange = (idx, result) => {
    setResults((prev) => ({
      ...prev,
      [idx]: result,
    }));
  };

  // ============================================
  // ✅ ENHANCED: Handle accumulator results
  // ============================================
  const handleSubmitResults = async () => {
    if (!selectedBet) return;

    const allSelected = Object.values(results).every((r) => r !== null);
    if (!allSelected) {
      toast.warning("Please select results for every match");
      return;
    }

    setSubmitting(true);
    try {
      let actualNet;

      // ✅ Check if this is an accumulator bet
      if (selectedBet.strategy === "accumulator" && selectedBet.accumulatorData) {
        actualNet = calculateAccumulatorNet(selectedBet, results);
      } else {
        // Regular defensive bet
        actualNet = await recordMatchResults(selectedBet.id, results);
      }

      // Add NET to bankroll (stake already deducted)
      if (actualNet > 0) {
        await addWinnings(actualNet);
        toast.success(`🎉 Win! +${actualNet.toFixed(2)} added to bankroll`);
      } else if (actualNet < 0) {
        toast.error(`😔 Loss: ${actualNet.toFixed(2)}`);
      } else {
        toast.info("Break even - no net change");
      }

      await loadUnresolvedBets();
      setSelectedBet(null);
      setResults({});
    } catch (err) {
      console.error("Failed to record results:", err);
      toast.error("Failed to record results: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Calculate accumulator net
  const calculateAccumulatorNet = (bet, matchResults) => {
    const { selections } = bet.accumulatorData;
    const stakeAmount = bet.stakes?.ACCA || 0;
    
    // Check if ALL legs won
    let allWon = true;
    for (const [matchIdx, selection] of Object.entries(selections)) {
      const actualResult = matchResults[matchIdx];
      
      // Check if this leg won
      const legWon = checkLegWon(selection, actualResult);
      
      if (!legWon) {
        allWon = false;
        break;
      }
    }

    if (allWon) {
      // All legs won - return payout minus stake
      const payout = stakeAmount * bet.accumulatorData.totalOdds;
      return payout - stakeAmount;
    } else {
      // Lost - return negative stake
      return -stakeAmount;
    }
  };

  // Check if accumulator leg won
  const checkLegWon = (selection, actualResult) => {
    if (!actualResult) return false;

    if (selection === "H") return actualResult === "H";
    if (selection === "D") return actualResult === "D";
    if (selection === "A") return actualResult === "A";
    if (selection === "HD") return actualResult === "H" || actualResult === "D";
    if (selection === "AD") return actualResult === "A" || actualResult === "D";
    if (selection === "HA") return actualResult === "H" || actualResult === "A";

    return false;
  };

  // ============================================
  // CASHOUT
  // ============================================
  const handleCashout = async () => {
    if (!selectedBet || !cashoutAmount) {
      toast.warning("Enter cashout amount");
      return;
    }

    const amount = parseFloat(cashoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid cashout amount");
      return;
    }

    const totalStake = selectedBet.strategy === "accumulator" 
      ? (selectedBet.stakes?.ACCA || 0)
      : Object.values(selectedBet.stakes || {}).reduce((sum, s) => sum + s, 0);

    if (
      !confirm(
        `Cashout for ${amount.toFixed(2)}?\n\n` +
        `Original stake: ${totalStake.toFixed(2)}\n` +
        `Net: ${amount >= 0 ? "+" : ""}${(amount - totalStake).toFixed(2)}`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const netFromCashout = await cashoutBet(selectedBet.id, amount);

      if (netFromCashout > 0) {
        await addWinnings(netFromCashout);
        toast.success(`💰 Cashed out! +${netFromCashout.toFixed(2)}`);
      } else if (netFromCashout < 0) {
        toast.warning(`Cashed out at loss: ${netFromCashout.toFixed(2)}`);
      } else {
        toast.info("Cashed out break-even");
      }

      await loadUnresolvedBets();
      setSelectedBet(null);
      setCashoutMode(false);
      setCashoutAmount("");
    } catch (err) {
      console.error("Cashout failed:", err);
      toast.error("Cashout failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  if (loading) {
    return (
      <div className="bg-white p-5 rounded-xl shadow-md">
        <p className="text-gray-500 text-center">Loading pending bets...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-xl shadow-md">
      <h2 className="text-lg font-semibold mb-4">🎯 Record Match Results</h2>

      {unresolvedBets.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <p className="text-xl font-semibold text-gray-700 mb-2">
            All bets resolved!
          </p>
          <p className="text-gray-500">
            No pending bets. Place new bets in the Solver or Accumulator tabs.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left - Bets list */}
          <div className="border rounded-lg p-3 bg-gray-50 max-h-96 overflow-y-auto">
            <h3 className="font-medium mb-3">
              Pending Bets ({unresolvedBets.length})
            </h3>

            <div className="space-y-2">
              {unresolvedBets.map((bet) => {
                const totalStake = bet.strategy === "accumulator"
                  ? (bet.stakes?.ACCA || 0)
                  : Object.values(bet.stakes || {}).reduce((sum, s) => sum + s, 0);

                return (
                  <div
                    key={bet.id}
                    onClick={() => handleBetSelect(bet)}
                    className={`border rounded p-3 cursor-pointer transition ${
                      selectedBet?.id === bet.id
                        ? "bg-blue-100 border-blue-500"
                        : "bg-white hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-gray-500">
                        {new Date(bet.timestamp).toLocaleString()}
                      </div>
                      {/* ✅ Strategy Badge */}
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        bet.strategy === "accumulator" 
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {bet.strategy === "accumulator" ? "🎲 ACCA" : "📊 Singles"}
                      </span>
                    </div>

                    <div className="text-sm font-medium mb-1">
                      {bet.matches?.map((m) => m.name || m.id).join(" • ")}
                    </div>

                    {/* ✅ Show accumulator details */}
                    {bet.strategy === "accumulator" && bet.accumulatorData && (
                      <div className="text-xs text-purple-600 mb-1">
                        {bet.accumulatorData.legs?.length} legs @ {bet.accumulatorData.totalOdds}x
                      </div>
                    )}

                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Stake: {totalStake.toFixed(2)}</span>
                      {bet.strategy === "accumulator" ? (
                        <span>Win: {(totalStake * bet.accumulatorData?.totalOdds).toFixed(2)}</span>
                      ) : (
                        <span>R: {bet.R?.toFixed(3)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right - Results or Cashout */}
          <div className="border rounded-lg p-3 bg-gray-50">
            {!selectedBet ? (
              <p className="text-gray-500 text-center py-12">
                ← Select a bet to continue
              </p>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium">
                    {cashoutMode ? "💰 Cashout" : "📝 Enter Results"}
                  </h3>

                  <button
                    onClick={() => setCashoutMode(!cashoutMode)}
                    className={`text-sm px-3 py-1 rounded transition ${
                      cashoutMode
                        ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                    }`}
                  >
                    {cashoutMode ? "📋 Results" : "💰 Cashout"}
                  </button>
                </div>

                {/* ✅ Show accumulator legs if applicable */}
                {selectedBet.strategy === "accumulator" && selectedBet.accumulatorData && !cashoutMode && (
                  <div className="bg-purple-50 border border-purple-200 rounded p-3 mb-3 text-sm">
                    <div className="font-medium mb-2">🎲 Accumulator Bet</div>
                    <div className="space-y-1">
                      {selectedBet.accumulatorData.legs?.map((leg, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{leg.match}: {leg.selection}</span>
                          <span className="font-medium">{leg.odds}x</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t text-purple-700 font-medium">
                      Total Odds: {selectedBet.accumulatorData.totalOdds}x
                    </div>
                    <div className="text-xs text-purple-600 mt-1">
                      ⚠️ All legs must win for payout
                    </div>
                  </div>
                )}

                {cashoutMode ? (
                  // CASHOUT MODE
                  <div>
                    <p className="text-sm text-gray-600 mb-3">
                      Enter bookmaker cashout offer:
                    </p>

                    <input
                      type="number"
                      value={cashoutAmount}
                      onChange={(e) => setCashoutAmount(e.target.value)}
                      placeholder="Cashout amount"
                      className="w-full border p-3 rounded mb-3"
                      min="0"
                      step="0.01"
                    />

                    <div className="text-xs text-gray-500 mb-4">
                      Original stake:{" "}
                      {selectedBet.strategy === "accumulator"
                        ? (selectedBet.stakes?.ACCA || 0).toFixed(2)
                        : Object.values(selectedBet.stakes || {})
                            .reduce((s, x) => s + x, 0)
                            .toFixed(2)}
                    </div>

                    <button
                      onClick={handleCashout}
                      disabled={submitting || !cashoutAmount}
                      className="w-full px-4 py-3 bg-orange-600 text-white rounded hover:bg-orange-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                    >
                      {submitting ? "Processing..." : "💰 Confirm Cashout"}
                    </button>
                  </div>
                ) : (
                  // RESULTS MODE
                  <div>
                    <div className="space-y-4 mb-6">
                      {selectedBet.matches?.map((match, idx) => (
                        <div
                          key={idx}
                          className="border rounded-lg p-3 bg-white"
                        >
                          <div className="font-medium mb-2">
                            {match.name || `Match ${idx + 1}`}
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: "Home (1)", value: "H" },
                              { label: "Draw (X)", value: "D" },
                              { label: "Away (2)", value: "A" },
                            ].map(({ label, value }) => (
                              <button
                                key={value}
                                onClick={() => handleResultChange(idx, value)}
                                className={`px-3 py-2 rounded text-sm font-medium transition ${
                                  results[idx] === value
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 hover:bg-gray-300"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSubmitResults}
                      disabled={
                        submitting ||
                        !Object.values(results).every((r) => r !== null)
                      }
                      className="w-full px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                    >
                      {submitting ? "Recording..." : "✅ Submit Results"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}