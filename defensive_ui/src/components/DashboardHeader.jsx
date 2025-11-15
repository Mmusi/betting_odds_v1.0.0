import React, { useEffect, useState } from "react";
import { trackerGet } from "../api/engine";

export default function DashboardHeader() {
  const [status, setStatus] = useState("checking");
  const [bankroll, setBankroll] = useState(0);

  async function checkServer() {
    try {
      const res = await trackerGet();
      setStatus("online");
      setBankroll(res.bankroll);
    } catch {
      setStatus("offline");
    }
  }

  useEffect(() => {
    checkServer();
    const id = setInterval(checkServer, 4000);
    return () => clearInterval(id);
  }, []);

  const color = status === "online" ? "bg-green-500" : "bg-red-500";

  return (
    <div className="flex justify-between items-center bg-gray-900 text-white p-4 rounded-xl mb-4 shadow">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${color}`}></div>
        <span className="font-medium text-sm">
          {status === "online" ? "Backend Online" : "Backend Offline"}
        </span>
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold">💰 Bankroll: {bankroll.toFixed(2)}</div>
      </div>
    </div>
  );
}
