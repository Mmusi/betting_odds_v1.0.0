// defensive_ui/src/components/ServerStatus.jsx
import React, { useEffect, useState } from "react";
import { trackerGet } from "../api/engine";
import { useBankroll } from "../context/BankrollContext";

export default function ServerStatus() {
  const [status, setStatus] = useState("checking");

  // 🔥 Use GLOBAL bankroll (react state)
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

  let color = "gray";
  if (status === "online") color = "green";
  if (status === "offline") color = "red";

  // ============================================
  // ✅ FIX: HANDLE NULL BANKROLL SAFELY
  // ============================================
  const displayBankroll = bankroll != null ? bankroll.toFixed(2) : "...";

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      ></div>

      {status === "checking" && <span>Checking server...</span>}

      {status === "online" && (
        <span>
          Backend Online 🟢 | Bankroll:{" "}
          {isLoading ? (
            <span className="text-gray-400">Loading...</span>
          ) : (
            <b>{displayBankroll}</b>
          )}
        </span>
      )}

      {status === "offline" && (
        <span>Backend Offline 🔴 (check Flask at port 5001)</span>
      )}
    </div>
  );
}