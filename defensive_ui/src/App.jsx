// defensive_ui/src/App.jsx
// ✅ Updated with new header and full-screen responsive layout
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
  const [currentStep, setCurrentStep] = useState(1);
  const [solverData, setSolverData] = useState(null);
  const [betPlan, setBetPlan] = useState(null);
  const [activeTab, setActiveTab] = useState("solver");

  // ============================================
  // STEP 1: Solver completed
  // ============================================
  const handleSolved = (solution, bets, matches, budget) => {
    setSolverData({ solution, bets, matches, budget });
    setCurrentStep(2);
  };

  // ============================================
  // STEP 2: AI Advisor - Place individual bets
  // ============================================
  const handlePlaceBets = (plan) => {
    setBetPlan(plan);
    setCurrentStep(3);
  };

  // ============================================
  // STEP 2: AI Advisor - Build accumulator
  // ============================================
  const handleBuildAccumulator = (data) => {
    setActiveTab("accumulator");
    setCurrentStep(1);
  };

  // ============================================
  // STEP 3: Placement complete
  // ============================================
  const handlePlacementComplete = () => {
    setSolverData(null);
    setBetPlan(null);
    setCurrentStep(1);
    setActiveTab("results");
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
      {/* ============================================ */}
      {/* UPDATED HEADER - Sticky with Gradient */}
      {/* ============================================ */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-indigo-700 to-indigo-900 
        text-white px-6 py-4 shadow-xl flex justify-between items-center 
        border-b border-indigo-500/40 backdrop-blur-lg">
        
        <div className="flex items-center gap-3">
          <div className="bg-white/10 px-3 py-1 rounded-lg text-sm font-semibold shadow-inner 
            border border-white/20">
            ProfitShield
          </div>
          <h1 className="text-lg font-semibold tracking-wide drop-shadow-sm">
            Betting Intelligence Suite
          </h1>
        </div>
        <ServerStatus />
      </header>

      {/* ============================================ */}
      {/* MAIN LAYOUT - Full Screen */}
      {/* ============================================ */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Panel - Main Content */}
        <div className="w-full md:w-[60%] flex flex-col overflow-hidden">
          {/* Tab Navigation - Sticky */}
          <div className="flex-shrink-0 bg-white border-b shadow-sm">
            <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setCurrentStep(1);
                    setSolverData(null);
                    setBetPlan(null);
                  }}
                  className={`px-4 py-3 text-sm font-medium transition whitespace-nowrap relative ${
                    activeTab === tab.id
                      ? "text-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* ============================================ */}
            {/* SOLVER TAB - 3-STEP WORKFLOW */}
            {/* ============================================ */}
            {activeTab === "solver" && (
              <>
                {/* Progress Indicator */}
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="flex items-center justify-between">
                    {[
                      { num: 1, label: "Calculate", active: currentStep === 1 },
                      { num: 2, label: "Analyze", active: currentStep === 2 },
                      { num: 3, label: "Place", active: currentStep === 3 },
                    ].map((step, idx) => (
                      <React.Fragment key={step.num}>
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                              step.active
                                ? "bg-indigo-600 text-white shadow-lg scale-110"
                                : currentStep > step.num
                                ? "bg-green-500 text-white"
                                : "bg-gray-300 text-gray-600"
                            }`}
                          >
                            {currentStep > step.num ? "✓" : step.num}
                          </div>
                          <div className="text-xs mt-1 font-medium">{step.label}</div>
                        </div>
                        {idx < 2 && (
                          <div
                            className={`flex-1 h-1 mx-2 rounded transition-all ${
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
        </div>

        {/* Right Panel - Betway (Hidden on mobile) */}
        <div className="hidden md:flex md:w-[40%] flex-col bg-white border-l border-gray-200 overflow-hidden">
          <BetwayPanel />
        </div>
      </div>
    </div>
  );
}