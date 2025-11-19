// defensive_ui/src/components/MatchResultsEntry.jsx
// ⭐ UPDATED: Full integration with EnhancedCashout + safer accumulator handling

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

  const toast = useToast();
  const { addWinnings } = useBankroll();

  // ⭐ NEW: toggle between manual cashout & strategic cashout
  const [strategicCashout, setStrategicCashout] = useState(false);

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
    setStrategicCashout(false);

    const initialResults = {};
    bet.matches?.forEach((_, i) => (initialResults[i] = null));
    setResults(initialResults);
  };

  const handleResultChange = (idx, result) => {
    setResults((prev) => ({
      ...prev,
      [idx]: result,
    }));
  };

  // =====================================================
  // ⭐ UPDATED: Accumulator net calculation (more robust)
  // =====================================================
  const handleSubmitResults = async () => {
    if (!selectedBet) return;

    const allSelected = Object.values(results).every((r) => r !== null);
    if (!allSelected) {
      toast.warning("Please select results for every match");
      return;
    }

    setSubmitting(true);
    try {
      let net;

      if (selectedBet.strategy === "accumulator" && selectedBet.accumulatorData) {
        net = calculateAccumulatorNet(selectedBet, results);
      } else {
        net = await recordMatchResults(selectedBet.id, results);
      }

      if (net > 0) {
        await addWinnings(net);
        toast.success(`🎉 Win! +${net.toFixed(2)} added to bankroll`);
      } else if (net < 0) {
        toast.error(`Loss: ${net.toFixed(2)}`);
      } else {
        toast.info("Break even");
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

  const calculateAccumulatorNet = (bet, matchResults) => {
    const { selections } = bet.accumulatorData;
    const stakeAmount = bet.stakes?.ACCA || 0;

    let allWon = true;
    for (const [idx, sel] of Object.entries(selections)) {
      const actual = matchResults[idx];
      if (!checkLegWon(sel, actual)) {
        allWon = false;
        break;
      }
    }

    if (allWon) {
      const payout = stakeAmount * bet.accumulatorData.totalOdds;
      return payout - stakeAmount;
    } else {
      return -stakeAmount;
    }
  };

  const checkLegWon = (sel, result) => {
    if (!result) return false;
    if (sel === "H") return result === "H";
    if (sel === "D") return result === "D";
    if (sel === "A") return result === "A";
    if (sel === "HD") return result === "H" || result === "D";
    if (sel === "AD") return result === "A" || result === "D";
    if (sel === "HA") return result === "H" || result === "A";
    return false;
  };

  // =====================================================
  // ⭐ UPDATED: fully replaced manual cashout with EnhancedCashout
  // =====================================================
  const handleStrategicCashoutComplete = async () => {
    await loadUnresolvedBets();
    setSelectedBet(null);
    setStrategicCashout(false);
    toast.info("Cashout processed.");
  };

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
          {/* LEFT - BET LIST */}
          <div className="border rounded-lg p-3 bg-gray-50 max-h-96 overflow-y-auto">
            <h3 className="font-medium mb-3">
              Pending Bets ({unresolvedBets.length})
            </h3>

            <div className="space-y-2">
              {unresolvedBets.map((bet) => {
                const totalStake =
                  bet.strategy === "accumulator"
                    ? bet.stakes?.ACCA || 0
                    : Object.values(bet.stakes || {}).reduce(
                        (sum, x) => sum + x,
                        0
                      );

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

                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          bet.strategy === "accumulator"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {bet.strategy === "accumulator"
                          ? "🎲 ACCA"
                          : "📊 Singles"}
                      </span>
                    </div>

                    <div className="text-sm font-medium mb-1">
                      {bet.matches?.map((m) => m.name || m.id).join(" • ")}
                    </div>

                    {bet.strategy === "accumulator" &&
                      bet.accumulatorData && (
                        <div className="text-xs text-purple-600 mb-1">
                          {bet.accumulatorData.legs?.length} legs @{" "}
                          {bet.accumulatorData.totalOdds}x
                        </div>
                      )}

                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Stake: {totalStake.toFixed(2)}</span>
                      {bet.strategy === "accumulator" ? (
                        <span>
                          Win:{" "}
                          {(
                            totalStake * bet.accumulatorData?.totalOdds
                          ).toFixed(2)}
                        </span>
                      ) : (
                        <span>R: {bet.R?.toFixed(3)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="border rounded-lg p-3 bg-gray-50">
            {!selectedBet ? (
              <p className="text-gray-500 text-center py-12">
                ← Select a bet to continue
              </p>
            ) : (
              <div>
                {/* HEADER */}
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium">
                    {strategicCashout
                      ? "💰 Strategic Cashout"
                      : cashoutMode
                      ? "💰 Cashout"
                      : "📝 Enter Results"}
                  </h3>

                  <div className="flex gap-2">
                    {/* Strategic toggle */}
                    <button
                      onClick={() =>
                        setStrategicCashout((x) => !x)
                      }
                      className={`text-sm px-3 py-1 rounded transition ${
                        strategicCashout
                          ? "bg-blue-200 text-blue-700"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      }`}
                    >
                      🧠 Strategic
                    </button>

                    {/* Basic cashout toggle */}
                    <button
                      onClick={() => setCashoutMode((x) => !x)}
                      className={`text-sm px-3 py-1 rounded transition ${
                        cashoutMode
                          ? "bg-gray-300 text-gray-700"
                          : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                      }`}
                    >
                      {cashoutMode ? "📋 Results" : "💰 Cashout"}
                    </button>
                  </div>
                </div>

                {/* ⭐ NEW: Strategic Cashout Panel */}
                {strategicCashout ? (
                  <EnhancedCashout
                    bet={selectedBet}
                    onComplete={handleStrategicCashoutComplete}
                  />
                ) : cashoutMode ? (
                  // ========================
                  // BASIC CASHOUT MODE
                  // ========================
                  <div>
                    <input
                      type="number"
                      value={cashoutAmount}
                      onChange={(e) => setCashoutAmount(e.target.value)}
                      placeholder="Cashout amount"
                      className="w-full border p-3 rounded mb-3"
                    />

                    <button
                      onClick={handleCashout}
                      disabled={submitting || !cashoutAmount}
                      className="w-full px-4 py-3 bg-orange-600 text-white rounded hover:bg-orange-700 transition disabled:bg-gray-400"
                    >
                      {submitting ? "Processing..." : "💰 Confirm Cashout"}
                    </button>
                  </div>
                ) : (
                  // ========================
                  // RESULTS ENTRY MODE
                  // ========================
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
                                onClick={() =>
                                  handleResultChange(idx, value)
                                }
                                className={`px-3 py-2 rounded text-sm transition ${
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
                      className="w-full px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:bg-gray-400"
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
