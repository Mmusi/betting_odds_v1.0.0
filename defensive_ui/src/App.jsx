// defensive_ui/src/App.jsx
import React, { useState } from "react";
import SolverForm from "./components/SolverForm";
import ResultsPanel from "./components/ResultsPanel";
import ServerStatus from "./components/ServerStatus";
import BetwayPanel from "./components/BetwayPanel";
import BetHistoryPanel from "./components/BetHistoryPanel";
import StatisticsDashboard from "./components/StatisticsDashboard";
import ImportExportPanel from "./components/ImportExportPanel";
import MatchResultsEntry from "./components/MatchResultsEntry";
import SmartPredictions from "./components/SmartPredictions";
import AccumulatorBuilder from "./components/AccumulatorBuilder";

export default function App() {
  const [sol, setSol] = useState(null);
  const [currentMatches, setCurrentMatches] = useState([]); // NEW: Track entered matches
  const [activeTab, setActiveTab] = useState("solver");

  const handleSolved = (solution, bets, matches) => {
    console.log("App.jsx handleSolved called with:", { solution, bets, matches }); // DEBUG
    setSol(solution);
    setCurrentMatches(matches); // Store matches for predictions
  };

  const tabs = [
    { id: "solver", label: "⚡ Solver", icon: "⚡" },
    { id: "predictions", label: "🤖 AI", icon: "🤖" },
    { id: "accumulator", label: "🎲 Acca", icon: "🎲" },
    { id: "results", label: "🎯 Results", icon: "🎯" },
    { id: "history", label: "📜 History", icon: "📜" },
    { id: "stats", label: "📊 Stats", icon: "📊" },
    { id: "settings", label: "⚙️ Settings", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-indigo-700 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-xl font-bold">⚙️ Defensive Betting Dashboard</h1>
        <ServerStatus />
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Tabs */}
        <div className="w-full md:w-[60%] overflow-y-auto p-4 space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 border-b bg-white rounded-t-xl px-4 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "solver" && (
            <>
              <SolverForm onSolved={handleSolved} />
              <ResultsPanel sol={sol} />
            </>
          )}

          {activeTab === "predictions" && (
            <SmartPredictions matches={currentMatches} />
          )}

          {activeTab === "accumulator" && (
            <AccumulatorBuilder matches={currentMatches} />
          )}

          {activeTab === "results" && <MatchResultsEntry />}

          {activeTab === "history" && <BetHistoryPanel />}

          {activeTab === "stats" && <StatisticsDashboard />}

          {activeTab === "settings" && <ImportExportPanel />}
        </div>

        {/* Right Panel - Betway */}
        <div className="hidden md:block w-[40%]">
          <BetwayPanel />
        </div>
      </div>
    </div>
  );
}