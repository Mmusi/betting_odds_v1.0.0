// defensive_ui/src/components/AIAdvisorStep.jsx
// ✅ PHASE 2: AI Advisory - Analyze outcomes and recommend betting strategy
import React, { useState, useEffect } from "react";
import { useToast } from "./Toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001/api";

export default function AIAdvisorStep({ 
  solution, 
  matches, 
  bets, 
  budget,
  onPlaceBets,
  onBuildAccumulator 
}) {
  const [selectedOutcomes, setSelectedOutcomes] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const toast = useToast();

  // Auto-analyze on mount
  useEffect(() => {
    if (solution && matches) {
      analyzeOutcomes();
    }
  }, [solution, matches]);

  const analyzeOutcomes = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE}/recommend_combos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matches: matches.map(m => ({
            name: m.name || m.id,
            home: parseFloat(m.home) || 0,
            draw: parseFloat(m.draw) || 0,
            away: parseFloat(m.away) || 0,
            hd: parseFloat(m.hd) || 0,
            ad: parseFloat(m.ad) || 0,
            ha: parseFloat(m.ha) || 0,
          })),
          budget,
          risk_tolerance: "medium",
        }),
      });

      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error("Analysis failed:", err);
      toast.error("Failed to analyze outcomes");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleOutcome = (index) => {
    setSelectedOutcomes(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const selectBestOutcomes = () => {
    // Auto-select 3 best outcomes based on net profit
    if (!solution.omega || !solution.nets) {
      toast.error("No outcomes available");
      return;
    }
    
    const sorted = solution.omega
      .map((outcome, idx) => ({ idx, net: solution.nets[idx] }))
      .sort((a, b) => b.net - a.net)
      .slice(0, 3)
      .map(o => o.idx);
    
    setSelectedOutcomes(sorted);
    toast.success("Selected 3 best outcomes");
  };

  const handlePlaceIndividualBets = () => {
    if (selectedOutcomes.length === 0) {
      toast.warning("Select at least 1 outcome for analysis");
      return;
    }

    onPlaceBets({
      solution,
      matches,
      bets,
      budget,
      selectedOutcomes,
      strategy: "single"
    });
  };

  const handleBuildAccumulator = () => {
    if (selectedOutcomes.length === 0) {
      toast.warning("Select outcomes to build accumulator");
      return;
    }

    onBuildAccumulator({
      solution,
      matches,
      selectedOutcomes,
      budget
    });
  };

  if (!solution) return null;

  const isGood = solution.R > 0;

  return (
    <div className="bg-white p-5 rounded-xl shadow-md mb-6">
      <h2 className="text-lg font-semibold mb-4">🤖 Step 2: AI Betting Advisor</h2>

      {/* Analysis Summary */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="text-sm text-gray-600 mb-1">Guaranteed Return</div>
          <div className={`text-2xl font-bold ${isGood ? "text-green-600" : "text-red-600"}`}>
            {solution.R?.toFixed(3)}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="text-sm text-gray-600 mb-1">Possible Outcomes</div>
          <div className="text-2xl font-bold text-blue-600">
            {solution.omega?.length || 0}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="text-sm text-gray-600 mb-1">Budget</div>
          <div className="text-2xl font-bold text-indigo-600">
            {budget.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm">
        <b>📋 Instructions:</b>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>Select 1-3 outcomes you want to analyze</li>
          <li>Review AI recommendations below</li>
          <li>Choose: Place individual bets OR Build accumulator</li>
        </ol>
      </div>

      {/* Outcome Selection Grid */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Select Outcomes to Analyze</h3>
          <button
            onClick={selectBestOutcomes}
            className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            ⭐ Select 3 Best
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
          {solution.omega.map((outcome, i) => (
            <button
              key={i}
              onClick={() => toggleOutcome(i)}
              className={`border rounded-lg p-3 text-left transition ${
                selectedOutcomes.includes(i)
                  ? "bg-blue-100 border-blue-500"
                  : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div className="text-xs font-medium text-gray-600 mb-1">
                Outcome {i + 1}
              </div>
              
              <div className="text-sm mb-2">
                {outcome.map((r, j) => (
                  <span key={j} className="mr-2">
                    M{j + 1}: <b>{r === "H" ? "1" : r === "D" ? "X" : "2"}</b>
                  </span>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Net:</span>
                <span className={`text-sm font-bold ${
                  solution.nets[i] >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {solution.nets[i] >= 0 ? "+" : ""}{solution.nets[i].toFixed(2)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* AI Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="border-t pt-6 mb-6">
          <h3 className="font-semibold mb-3">🎯 AI Recommendations</h3>
          
          <div className="space-y-3">
            {recommendations.slice(0, 3).map((rec, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-gradient-to-r from-indigo-50 to-blue-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-800">{rec.strategy}</h4>
                    <p className="text-sm text-gray-600">{rec.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">EV Rating</div>
                    <div className="text-lg font-bold text-green-600">
                      {rec.expected_value_rating}/10
                    </div>
                  </div>
                </div>

                {rec.accumulator && (
                  <div className="text-sm text-indigo-700 mt-2">
                    💡 Accumulator: {rec.accumulator.total_odds}x odds, {rec.accumulator.win_probability}% win chance
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy Selection */}
      <div className="border-t pt-6">
        <h3 className="font-semibold mb-3">Choose Your Strategy</h3>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Single Bets */}
          <button
            onClick={handlePlaceIndividualBets}
            disabled={selectedOutcomes.length === 0}
            className="border-2 rounded-lg p-6 text-left transition hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
          >
            <div className="text-3xl mb-2">📊</div>
            <h4 className="font-bold mb-2">Place Individual Bets</h4>
            <p className="text-sm text-gray-600 mb-3">
              Place separate bets on each market with calculated stakes
            </p>
            <div className="text-sm font-medium text-blue-600">
              {selectedOutcomes.length} outcome{selectedOutcomes.length !== 1 ? "s" : ""} selected
            </div>
          </button>

          {/* Accumulator */}
          <button
            onClick={handleBuildAccumulator}
            disabled={selectedOutcomes.length === 0}
            className="border-2 rounded-lg p-6 text-left transition hover:border-purple-500 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
          >
            <div className="text-3xl mb-2">🎲</div>
            <h4 className="font-bold mb-2">Build Accumulator</h4>
            <p className="text-sm text-gray-600 mb-3">
              Combine selections into a single accumulator bet
            </p>
            <div className="text-sm font-medium text-purple-600">
              Higher risk, higher reward
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}