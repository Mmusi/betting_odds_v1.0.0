// defensive_ui/src/components/ServerStatus.jsx
// ✅ Updated for new header design
import React, { useEffect, useState } from "react";
import { trackerGet } from "../api/engine";
import { useBankroll } from "../context/BankrollContext";

export default function ServerStatus() {
  const [status, setStatus] = useState("checking");
  const { bankroll, isLoading } = useBankroll();

  async function checkServer() {
    try {
      await trackerGet();
      setStatus("online");
    } catch {
      setStatus("offline");
    }
  }

  useEffect(() => {
    checkServer();
    const id = setInterval(checkServer, 4000);
    return () => clearInterval(id);
  }, []);

  const displayBankroll = bankroll != null ? bankroll.toFixed(2) : "...";

  return (
    <div className="flex items-center gap-4">
      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            status === "online"
              ? "bg-green-400 animate-pulse"
              : status === "offline"
              ? "bg-red-400"
              : "bg-yellow-400"
          }`}
        ></div>
        <span className="text-xs font-medium hidden lg:inline">
          {status === "online" ? "Live" : status === "offline" ? "Offline" : "Checking"}
        </span>
      </div>

      {/* Bankroll Display */}
      {status === "online" && (
        <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/20 shadow-inner">
          <div className="text-xs text-indigo-200 font-medium">Bankroll</div>
          <div className="text-lg font-bold tracking-wide">
            {isLoading ? (
              <span className="text-indigo-200 animate-pulse">...</span>
            ) : (
              <span className="text-white">{displayBankroll}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}