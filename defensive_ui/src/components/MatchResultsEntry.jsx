// defensive_ui/src/components/MatchResultsEntry.jsx
import React, { useState, useEffect } from "react";
import {
  getPlacedUnresolvedBets,
  recordMatchResults,
  cashoutBet,
} from "../utils/db";
import { useToast } from "./Toast";
import { useBankroll } from "../context/BankrollContext";

export default function MatchResultsEntry() {
  const [unresolvedBets, setUnresolvedBets] = useState([]);
  const [selectedBet, setSelectedBet] = useState(null);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cashoutMode, setCashoutMode] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState("");

  const toast = useToast();
  const { adjustBankroll } = useBankroll();

  // Load unresolved bet records
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

  // ----------------------------------------------
  // SUBMIT MATCH RESULTS
  // ----------------------------------------------
  const handleSubmitResults = async () => {
    if (!selectedBet) return;

    const allSelected = Object.values(results).every((r) => r !== null);
    if (!allSelected) {
      toast.warning("Please select results for every match");
      return;
    }

    setSubmitting(true);
    try {
      const actualNet = await recordMatchResults(selectedBet.id, results);

      await adjustBankroll(actualNet);

      toast.success(
        `Results recorded! Net: ${actualNet >= 0 ? "+" : ""}${actualNet.toFixed(
          2
        )}`
      );

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

  // ----------------------------------------------
  // CASHOUT
  // ----------------------------------------------
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

    if (
      !confirm(
        `Cashout bet for ${amount.toFixed(
          2
        )}?\n\nThis will close the bet and update your bankroll.`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const netFromCashout = await cashoutBet(selectedBet.id, amount);

      await adjustBankroll(netFromCashout);

      toast.success(
        `Bet cashed out! Net: ${
          netFromCashout >= 0 ? "+" : ""
        }${netFromCashout.toFixed(2)}`
      );

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

  // ----------------------------------------------
  // UI RENDER
  // ----------------------------------------------
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
        <p className="text-gray-500 text-center py-8">
          No pending bets. All resolved! 🎉
        </p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left column – Bets list */}
          <div className="border rounded-lg p-3 bg-gray-50 max-h-96 overflow-y-auto">
            <h3 className="font-medium mb-3">
              Pending Bets ({unresolvedBets.length})
            </h3>

            <div className="space-y-2">
              {unresolvedBets.map((bet) => (
                <div
                  key={bet.id}
                  onClick={() => handleBetSelect(bet)}
                  className={`border rounded p-3 cursor-pointer transition ${
                    selectedBet?.id === bet.id
                      ? "bg-blue-100 border-blue-500"
                      : "bg-white hover:bg-gray-100"
                  }`}
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {new Date(bet.timestamp).toLocaleString()}
                  </div>

                  <div className="text-sm font-medium">
                    {bet.matches?.map((m) => m.name || m.id).join(" • ")}
                  </div>

                  <div className="text-xs text-gray-600 mt-1">
                    Total stake:{" "}
                    {Object.values(bet.stakes || {})
                      .reduce((s, x) => s + x, 0)
                      .toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column – Results or Cashout */}
          <div className="border rounded-lg p-3 bg-gray-50">
            {!selectedBet ? (
              <p className="text-gray-500 text-center py-12">
                ← Select a bet to continue
              </p>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium">
                    {cashoutMode ? "Cashout Bet" : "Enter Results"}
                  </h3>

                  <button
                    onClick={() => setCashoutMode(!cashoutMode)}
                    className={`text-sm px-3 py-1 rounded ${
                      cashoutMode
                        ? "bg-gray-200 text-gray-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {cashoutMode ? "📋 Results" : "💰 Cashout"}
                  </button>
                </div>

                {cashoutMode ? (
                  /////////////////////////////////////
                  // CASHOUT MODE
                  /////////////////////////////////////
                  <div>
                    <p className="text-sm text-gray-600 mb-3">
                      Enter the bookmaker cashout amount:
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
                      Total stake:{" "}
                      {Object.values(selectedBet.stakes || {})
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
                  /////////////////////////////////////
                  // RESULTS MODE
                  /////////////////////////////////////
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
