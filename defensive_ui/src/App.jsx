import React, { useState } from "react";
import SolverForm from "./components/SolverForm";
import ResultsPanel from "./components/ResultsPanel";
import ServerStatus from "./components/ServerStatus";
import BetwayPanel from "./components/BetwayPanel";

export default function App() {
  const [sol, setSol] = useState(null);

  const handleSolved = (solution) => {
    // ❗ Only update UI, no bankroll logic here
    setSol(solution);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="bg-indigo-700 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-xl font-bold">⚙️ Defensive Betting Dashboard</h1>
        <ServerStatus />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-full md:w-[60%] overflow-y-auto p-4 space-y-4">
          <SolverForm onSolved={handleSolved} />
          <ResultsPanel sol={sol} />
        </div>

        <div className="hidden md:block w-[40%]">
          <BetwayPanel />
        </div>
      </div>
    </div>
  );
}
