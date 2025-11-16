// defensive_ui/src/components/SmartPredictions.jsx
import React, { useState, useEffect } from "react";
import { useToast } from "./Toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001/api";

export default function SmartPredictions({ matches, onApplyRecommendation }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRec, setSelectedRec] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (matches && matches.length > 0) {
      analyzeMatches();
    }
  }, [matches]);

  const analyzeMatches = async () => {
    setLoading(true);
    try {
      // Get recommendations
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
          budget: 100, // Default, can be passed as prop
          risk_tolerance: "medium",
        }),
      });

      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error("Failed to get recommendations:", err);
      toast.error("Failed to analyze matches");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRecommendation = (rec) => {
    setSelectedRec(rec);
    if (onApplyRecommendation) {
      onApplyRecommendation(rec);
    }
    toast.success(`Applied: ${rec.strategy}`);
  };

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-white p-5 rounded-xl shadow-md">
        <p className="text-gray-500 text-center">
          Enter match odds to get smart predictions
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white p-5 rounded-xl shadow-md">
        <p className="text-gray-500 text-center">
          🤖 Analyzing matches...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-xl shadow-md">
      <h2 className="text-lg font-semibold mb-4">🤖 AI Predictions</h2>

      {recommendations.length === 0 ? (
        <p className="text-gray-500 text-center">
          No special recommendations for these matches
        </p>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-4 transition ${
                selectedRec === rec
                  ? "bg-blue-50 border-blue-500"
                  : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    {rec.strategy}
                  </h3>
                  <p className="text-sm text-gray-600">{rec.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">EV Rating</div>
                  <div className="text-lg font-bold text-green-600">
                    {rec.expected_value_rating}/10
                  </div>
                </div>
              </div>

              {/* Accumulator Details */}
              {rec.accumulator && (
                <div className="mt-3 bg-white rounded p-3 border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Accumulator</span>
                    <span className="text-lg font-bold text-indigo-600">
                      {rec.accumulator.total_odds}x
                    </span>
                  </div>

                  <div className="space-y-1 text-sm">
                    {rec.accumulator.legs.map((leg, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-gray-600">
                          {leg.match}: {leg.selection}
                        </span>
                        <span className="font-medium">{leg.odds}x</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 pt-2 border-t text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Win Probability:</span>
                      <span>{rec.accumulator.win_probability}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Risk Level:</span>
                      <span
                        className={
                          rec.accumulator.risk_level === "Low"
                            ? "text-green-600"
                            : rec.accumulator.risk_level === "Medium"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }
                      >
                        {rec.accumulator.risk_level}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Targets (for Value Hunting strategy) */}
              {rec.targets && (
                <div className="mt-3 space-y-2">
                  {rec.targets.map((target, i) => (
                    <div key={i} className="bg-white rounded p-2 border text-sm">
                      <div className="font-medium">{target.match}</div>
                      <div className="text-gray-600">{target.recommendation}</div>
                      <div className="text-xs text-green-600">{target.reason}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bet Type (for Singles) */}
              {rec.bet_type && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">Bet: </span>
                  <span className="text-indigo-600">{rec.bet_type}</span>
                </div>
              )}

              {/* Suggested Stake */}
              <div className="mt-3 flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  Suggested Stake: {rec.suggested_stake?.toFixed(2)}
                </span>
                <button
                  onClick={() => handleApplyRecommendation(rec)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition text-sm"
                >
                  Apply This
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Match Analysis Summary */}
      <div className="mt-6 pt-4 border-t">
        <h3 className="font-semibold mb-2 text-sm">Match Analysis</h3>
        <div className="space-y-2">
          {matches.map((match, idx) => (
            <MatchAnalysis key={idx} match={match} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Helper component for individual match analysis
function MatchAnalysis({ match, index }) {
  const [analysis, setAnalysis] = useState(null);
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001/api";

  useEffect(() => {
    analyzeMatch();
  }, [match]);

  const analyzeMatch = async () => {
    try {
      const response = await fetch(`${API_BASE}/analyze_odds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: parseFloat(match.home) || 0,
          draw: parseFloat(match.draw) || 0,
          away: parseFloat(match.away) || 0,
        }),
      });

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      console.error("Failed to analyze match:", err);
    }
  };

  if (!analysis) return null;

  return (
    <div className="bg-gray-50 rounded p-2 text-xs">
      <div className="font-medium mb-1">
        {match.name || `Match ${index + 1}`}
      </div>

      {analysis.is_uncertain && (
        <div className="text-orange-600 mb-1">
          ⚠️ High uncertainty detected - 2-outcome bets recommended
        </div>
      )}

      <div className="text-gray-600">
        Bookmaker margin: {analysis.overround}%
        {analysis.overround < 5 && (
          <span className="text-green-600 ml-2">✓ Good value</span>
        )}
      </div>

      {analysis.suggestions?.length > 0 && (
        <div className="mt-1">
          {analysis.suggestions[0].recommended_bets?.map((bet, i) => (
            <div key={i} className="text-indigo-600">
              💡 {bet.bet}: {bet.reasoning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}