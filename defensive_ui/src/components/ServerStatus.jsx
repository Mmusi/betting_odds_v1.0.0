import React, { useEffect, useState } from "react";
import { trackerGet } from "../api/engine";
import { useBankroll } from "../context/BankrollContext";

export default function ServerStatus() {
  const [status, setStatus] = useState("checking");

  // 🔥 Use GLOBAL bankroll (react state)
  const { bankroll } = useBankroll();

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

  return (
    <div className="flex items-center gap-2 text-sm mb-3">
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
          Backend Online 🟢 | Bankroll: <b>{bankroll.toFixed(2)}</b>
        </span>
      )}

      {status === "offline" && (
        <span>Backend Offline 🔴 (check Flask at port 5001)</span>
      )}
    </div>
  );
}
