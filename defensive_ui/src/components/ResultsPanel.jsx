// defensive_ui/src/components/ResultsPanel.jsx
import React, { useState } from "react";
import { useBankroll } from "../context/BankrollContext";

export default function ResultsPanel({ sol }) {
  const { applyOutcome } = useBankroll();
  const [appliedOutcome, setAppliedOutcome] = useState(null);

  // ============================================
  // SAFETY CHECKS
  // ============================================
  if (!sol) return null;

  if (!sol.stakes || typeof sol.stakes !== "object") {
    return (
      <div className="bg-white p-5 rounded-xl shadow-md">
        <h2 className="text-lg font-semibold mb-3">⚠️ Solver Notice</h2>
        <p className="text-red-600 font-medium mb-3">
          Solver status: {sol.status || "Unknown"}
        </p>

        {sol.status === "InsufficientBankrollForMinimums" && (
          <div className="text-sm text-gray-700">
            <p>
              Total minimum required: <b>{sol.total_min_required}</b>
            </p>
            <p>
              Your bankroll: <b>{sol.S}</b>
            </p>

            <h3 className="mt-3 font-medium">Suggested minimal stakes:</h3>
            <ul className="ml-4 list-disc">
              {sol.fallback_single_suggestions?.map((s, i) => (
                <li key={i}>
                  Bet <b>{s.bet_id}</b>: stake {s.stake} (worst net:{" "}
                  <span
                    className={
                      s.worst_net >= 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    {s.worst_net}
                  </span>
                  )
                </li>
              ))}
            </ul>
          </div>
        )}

        {sol.status !== "InsufficientBankrollForMinimums" && (
          <p className="text-gray-500 text-sm">
            No stake plan could be generated. Please adjust bankroll or odds
            and try again.
          </p>
        )}
      </div>
    );
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const isGood = sol.R > 0;

  // Group bets by match
  const grouped = {};
  for (const [id, val] of Object.entries(sol.stakes)) {
    const match = id.split("_")[0];
    if (!grouped[match]) grouped[match] = [];
    grouped[match].push({ id, stake: val });
  }

  // Readable label
  const prettyLabel = (id) => {
    if (id.includes("_H") && !id.includes("_HD") && !id.includes("_HA"))
      return "Home Win (1)";
    if (id.includes("_D") && !id.includes("_HD") && !id.includes("_AD"))
      return "Draw (X)";
    if (id.includes("_A") && !id.includes("_AD") && !id.includes("_HA"))
      return "Away Win (2)";
    if (id.includes("_HD")) return "Home or Draw (1X)";
    if (id.includes("_AD")) return "Away or Draw (X2)";
    if (id.includes("_HA")) return "Home or Away (12)";
    return id;
  };

  // Winning bets for outcome
  const winningBetsForOutcome = (omega) => {
    const wins = [];
    for (const [id] of Object.entries(sol.stakes)) {
      const matchIndex = parseInt(id.split("_")[0].replace("M", "")) - 1;
      const res = omega[matchIndex];
      if (!res) continue;

      if (
        id.includes("_H") &&
        res === "H" &&
        !id.includes("_HD") &&
        !id.includes("_HA")
      )
        wins.push(id);
      else if (
        id.includes("_D") &&
        res === "D" &&
        !id.includes("_HD") &&
        !id.includes("_AD")
      )
        wins.push(id);
      else if (
        id.includes("_A") &&
        res === "A" &&
        !id.includes("_AD") &&
        !id.includes("_HA")
      )
        wins.push(id);
      else if (id.includes("_HD") && (res === "H" || res === "D"))
        wins.push(id);
      else if (id.includes("_AD") && (res === "A" || res === "D"))
        wins.push(id);
      else if (id.includes("_HA") && (res === "H" || res === "A"))
        wins.push(id);
    }
    return wins;
  };

  // ============================================
  // ✅ FIX: APPLY OUTCOME (NO STAKE DEDUCTION)
  // ============================================
  const handleApplyOutcome = async (index) => {
    if (appliedOutcome === index) {
      // Allow re-clicking same outcome (no-op)
      return;
    }

    const net = sol.nets[index];
    const outcome = sol.omega[index];

    // Create bet record for history
    const betRecord = {
      outcome,
      net,
      stakes: sol.stakes,
      R: sol.R,
    };

    // ✅ Net already includes stake deduction, so we just ADD it to bankroll
    await applyOutcome(net, betRecord);

    setAppliedOutcome(index);
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white p-5 rounded-xl shadow-md">
      <h2 className="text-lg font-semibold mb-3">
        📊 Betting Plan & Outcomes
      </h2>

      <p
        className={`font-medium ${
          isGood ? "text-green-600" : "text-red-600"
        } mb-4`}
      >
        Guaranteed Return (R): {sol.R?.toFixed(3)}
      </p>

      {/* Stake Summary */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {Object.keys(grouped).map((m) => (
          <div key={m} className="border rounded-lg p-3 bg-gray-50">
            <h3 className="font-semibold mb-2 text-gray-700">
              {m.replace("M", "Match ")} Bets
            </h3>
            <ul className="text-sm space-y-1">
              {grouped[m].map((b) => (
                <li key={b.id} className="flex justify-between">
                  <span>{prettyLabel(b.id)}</span>
                  <span className="font-semibold">{b.stake.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Outcome Simulation */}
      <div>
        <h3 className="font-semibold mb-2 text-gray-700">
          Outcome Simulation (click to apply to bankroll)
        </h3>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sol.omega.map((w, i) => {
            const winBets = winningBetsForOutcome(w);
            const applied = appliedOutcome === i;

            return (
              <div
                key={i}
                onClick={() => handleApplyOutcome(i)}
                className={`border rounded-lg p-3 text-sm shadow-sm cursor-pointer transition ${
                  applied
                    ? "bg-green-100 border-green-500"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                {/* Outcome Label */}
                <div className="font-semibold text-gray-800 mb-1">
                  <span className="text-blue-600">
                    {w
                      .map(
                        (r, j) =>
                          `M${j + 1}: ${
                            r === "H"
                              ? "Home (1)"
                              : r === "D"
                              ? "Draw (X)"
                              : "Away (2)"
                          }`
                      )
                      .join(" | ")}
                  </span>
                </div>

                {/* Applied Badge */}
                {applied && (
                  <div className="text-green-700 font-bold text-xs mb-1">
                    ✔ Applied to Bankroll
                  </div>
                )}

                {/* Winning Bets */}
                <div className="mt-1">
                  <span className="font-medium text-green-700">
                    Winning Bets:
                  </span>
                  <ul className="ml-4 list-disc">
                    {winBets.length > 0 ? (
                      winBets.map((id) => (
                        <li key={id} className="text-green-700">
                          {prettyLabel(id)}
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-400">None</li>
                    )}
                  </ul>
                </div>

                {/* Losing Bets */}
                <div className="mt-1">
                  <span className="font-medium text-red-700">Losing Bets:</span>
                  <ul className="ml-4 list-disc">
                    {Object.keys(sol.stakes)
                      .filter((id) => !winBets.includes(id))
                      .map((id) => (
                        <li key={id} className="text-red-500">
                          {prettyLabel(id)}
                        </li>
                      ))}
                  </ul>
                </div>

                {/* Payout & Net */}
                <div className="mt-2 border-t pt-1">
                  <div>Payout: {sol.payouts[i].toFixed(2)}</div>
                  <div
                    className={`font-semibold ${
                      sol.nets[i] >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    Net: {sol.nets[i].toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}