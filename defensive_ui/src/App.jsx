// defensive_ui/src/App.jsx
// ✅ NEW WORKFLOW: Solver → AI Advisor → Place Bets → Results
import React, { useState } from "react";
import SolverForm from "./components/SolverForm";
import AIAdvisorStep from "./components/AIAdvisorStep";
import BetPlacementStep from "./components/BetPlacementStep";
import ServerStatus from "./components/ServerStatus";
import BetwayPanel from "./components/BetwayPanel";
import BetHistoryPanel from "./components/BetHistoryPanel";
import StatisticsDashboard from "./components/StatisticsDashboard";
import ImportExportPanel from "./components/ImportExportPanel";
import MatchResultsEntry from "./components/MatchResultsEntry";
import AccumulatorBuilder from "./components/AccumulatorBuilder";

export default function App() {
  // Workflow state
  const [currentStep, setCurrentStep] = useState(1); // 1=Solver, 2=Advisor, 3=Place, 4=Results
  const [solverData, setSolverData] = useState(null);
  const [betPlan, setBetPlan] = useState(null);
  const [activeTab, setActiveTab] = useState("solver");

  // ============================================
  // STEP 1: Solver completed
  // ============================================
  const handleSolved = (solution, bets, matches, budget) => {
    setSolverData({ solution, bets, matches, budget });
    setCurrentStep(2); // Move to AI Advisor
  };

  // ============================================
  // STEP 2: AI Advisor - Place individual bets
  // ============================================
  const handlePlaceBets = (plan) => {
    setBetPlan(plan);
    setCurrentStep(3); // Move to placement
  };

  // ============================================
  // STEP 2: AI Advisor - Build accumulator
  // ============================================
  const handleBuildAccumulator = (data) => {
    // Navigate to accumulator tab with pre-selected outcomes
    setActiveTab("accumulator");
    setCurrentStep(1); // Reset to allow new calculation
  };

  // ============================================
  // STEP 3: Placement complete
  // ============================================
  const handlePlacementComplete = () => {
    // Reset workflow
    setSolverData(null);
    setBetPlan(null);
    setCurrentStep(1);
    setActiveTab("results"); // Show results tab
  };

  // ============================================
  // TAB NAVIGATION
  // ============================================
  const tabs = [
    { id: "solver", label: "⚡ Solver", icon: "⚡" },
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
        {/* Left Panel - Main Content */}
        <div className="w-full md:w-[60%] overflow-y-auto p-4 space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 border-b bg-white rounded-t-xl px-4 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentStep(1); // Reset workflow when changing tabs
                  setSolverData(null);
                  setBetPlan(null);
                }}
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

          {/* ============================================ */}
          {/* SOLVER TAB - 3-STEP WORKFLOW */}
          {/* ============================================ */}
          {activeTab === "solver" && (
            <>
              {/* Progress Indicator */}
              <div className="bg-white rounded-xl shadow-md p-4 mb-4">
                <div className="flex items-center justify-between">
                  {[
                    { num: 1, label: "Calculate", active: currentStep === 1 },
                    { num: 2, label: "Analyze", active: currentStep === 2 },
                    { num: 3, label: "Place", active: currentStep === 3 },
                  ].map((step, idx) => (
                    <React.Fragment key={step.num}>
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            step.active
                              ? "bg-indigo-600 text-white"
                              : currentStep > step.num
                              ? "bg-green-500 text-white"
                              : "bg-gray-300 text-gray-600"
                          }`}
                        >
                          {currentStep > step.num ? "✓" : step.num}
                        </div>
                        <div className="text-xs mt-1">{step.label}</div>
                      </div>
                      {idx < 2 && (
                        <div
                          className={`flex-1 h-1 mx-2 ${
                            currentStep > step.num
                              ? "bg-green-500"
                              : "bg-gray-300"
                          }`}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Step 1: Solver */}
              {currentStep === 1 && <SolverForm onSolved={handleSolved} />}

              {/* Step 2: AI Advisor */}
              {currentStep === 2 && solverData && (
                <AIAdvisorStep
                  solution={solverData.solution}
                  matches={solverData.matches}
                  bets={solverData.bets}
                  budget={solverData.budget}
                  onPlaceBets={handlePlaceBets}
                  onBuildAccumulator={handleBuildAccumulator}
                />
              )}

              {/* Step 3: Place Bets */}
              {currentStep === 3 && betPlan && (
                <BetPlacementStep
                  betPlan={betPlan}
                  onComplete={handlePlacementComplete}
                />
              )}
            </>
          )}

          {/* ============================================ */}
          {/* OTHER TABS */}
          {/* ============================================ */}
          {activeTab === "accumulator" && (
            <AccumulatorBuilder 
              matches={solverData?.matches || []} 
            />
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