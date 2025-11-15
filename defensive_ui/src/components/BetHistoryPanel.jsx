// defensive_ui/src/components/BetHistoryPanel.jsx
import React, { useState, useEffect } from "react";
import { getAllBets, deleteBetRecord, exportData, clearAllData } from "../utils/db";

export default function BetHistoryPanel() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, applied, unapplied

  // ============================================
  // LOAD HISTORY
  // ============================================
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getAllBets();
      setBets(data);
    } catch (err) {
      console.error("Failed to load bet history:", err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // DELETE BET
  // ============================================
  const handleDelete = async (id) => {
    if (!confirm("Delete this bet record?")) return;

    try {
      await deleteBetRecord(id);
      setBets((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  };

  // ============================================
  // EXPORT DATA
  // ============================================
  const handleExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `betting-data-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Export failed: " + err.message);
    }
  };

  // ============================================
  // CLEAR ALL DATA
  // ============================================
  const handleClearAll = async () => {
    if (!confirm("⚠️ Clear ALL data including bankroll? This cannot be undone!"))
      return;

    try {
      await clearAllData();
      setBets([]);
      window.location.reload(); // Reset app
    } catch (err) {
      alert("Clear failed: " + err.message);
    }
  };

  // ============================================
  // FILTER BETS
  // ============================================
  const filteredBets = bets.filter((b) => {
    if (filter === "applied") return b.applied;
    if (filter === "unapplied") return !b.applied;
    return true;
  });

  // ============================================
  // RENDER
  // ============================================
  if (loading) {
    return (
      <div className="bg-white p-5 rounded-xl shadow-md">
        <p className="text-gray-500 text-center">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">📜 Bet History</h2>

        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            💾 Export
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            🗑️ Clear All
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        {["all", "applied", "unapplied"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium transition ${
              filter === f
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} (
            {
              bets.filter((b) =>
                f === "all" ? true : f === "applied" ? b.applied : !b.applied
              ).length
            }
            )
          </button>
        ))}
      </div>

      {/* Bet Records */}
      {filteredBets.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No bets found</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredBets.map((bet) => (
            <div
              key={bet.id}
              className={`border rounded-lg p-3 ${
                bet.applied ? "bg-green-50" : "bg-gray-50"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-xs text-gray-500">
                    {new Date(bet.timestamp).toLocaleString()}
                  </span>
                  {bet.applied && (
                    <span className="ml-2 text-xs font-semibold text-green-600">
                      ✔ Applied
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(bet.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>

              {/* Match Names */}
              {bet.matches && (
                <div className="text-sm mb-2">
                  <strong>Matches:</strong>{" "}
                  {bet.matches
                    .map((m) => m.name || m.id)
                    .join(" • ")}
                </div>
              )}

              {/* Stakes */}
              <div className="text-sm mb-2">
                <strong>Stakes:</strong>{" "}
                {bet.stakes &&
                  Object.entries(bet.stakes)
                    .map(([id, val]) => `${id}: ${val.toFixed(2)}`)
                    .join(", ")}
              </div>

              {/* Results */}
              {bet.applied && bet.finalNet != null && (
                <div
                  className={`text-sm font-semibold ${
                    bet.finalNet >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  Net Result: {bet.finalNet.toFixed(2)}
                </div>
              )}

              {!bet.applied && (
                <div className="text-sm text-gray-500">
                  R: {bet.R?.toFixed(3)} • {bet.outcomes?.length || 0} possible
                  outcomes
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}