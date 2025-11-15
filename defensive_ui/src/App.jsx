// defensive_ui/src/App.jsx
import React, { useState } from "react";
import SolverForm from "./components/SolverForm";
import ResultsPanel from "./components/ResultsPanel";
import ServerStatus from "./components/ServerStatus";
import BetwayPanel from "./components/BetwayPanel";
import BetHistoryPanel from "./components/BetHistoryPanel";

export default function App() {
  const [sol, setSol] = useState(null);
  const [activeTab, setActiveTab] = useState("solver"); // solver, history

  const handleSolved = (solution) => {
    setSol(solution);
  };

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
          <div className="flex gap-2 mb-4 border-b bg-white rounded-t-xl px-4">
            <button
              onClick={() => setActiveTab("solver")}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === "solver"
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              ⚡ Solver
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === "history"
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              📜 History
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "solver" ? (
            <>
              <SolverForm onSolved={handleSolved} />
              <ResultsPanel sol={sol} />
            </>
          ) : (
            <BetHistoryPanel />
          )}
        </div>

        {/* Right Panel - Betway */}
        <div className="hidden md:block w-[40%]">
          <BetwayPanel />
        </div>
      </div>
    </div>
  );
}