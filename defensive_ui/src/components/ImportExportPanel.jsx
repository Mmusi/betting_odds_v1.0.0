// defensive_ui/src/components/ImportExportPanel.jsx
import React, { useState } from "react";
import { exportData, importData, clearAllData } from "../utils/db";
import { useToast } from "./Toast";
import { useBankroll } from "../context/BankrollContext";

export default function ImportExportPanel() {
  const [importing, setImporting] = useState(false);
  const toast = useToast();
  const { setBalance } = useBankroll();

  // ============================================
  // EXPORT DATA
  // ============================================
  const handleExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `betting-data-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully!");
    } catch (err) {
      toast.error("Export failed: " + err.message);
    }
  };

  // ============================================
  // IMPORT DATA
  // ============================================
  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      if (!data.bankroll && !data.betHistory) {
        throw new Error("Invalid data format");
      }

      // Confirm overwrite
      if (
        !confirm(
          "⚠️ This will OVERWRITE existing data. Continue?"
        )
      ) {
        setImporting(false);
        return;
      }

      await importData(data);

      // Update bankroll context
      if (data.bankroll?.balance) {
        setBalance(data.bankroll.balance);
      }

      toast.success("Data imported successfully!");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error("Import failed: " + err.message);
    } finally {
      setImporting(false);
      event.target.value = ""; // Reset input
    }
  };

  // ============================================
  // CLEAR ALL DATA
  // ============================================
  const handleClearAll = async () => {
    if (
      !confirm(
        "⚠️ This will DELETE ALL data including bankroll, bet history, and settings. This CANNOT be undone!\n\nAre you absolutely sure?"
      )
    ) {
      return;
    }

    // Double confirmation
    const typed = prompt('Type "DELETE" to confirm:');
    if (typed !== "DELETE") {
      toast.warning("Clear cancelled");
      return;
    }

    try {
      await clearAllData();
      toast.success("All data cleared. Reloading...");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error("Clear failed: " + err.message);
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-md">
      <h2 className="text-lg font-semibold mb-4">💾 Data Management</h2>

      <div className="space-y-4">
        {/* Export */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-medium mb-2">📤 Export Data</h3>
          <p className="text-sm text-gray-600 mb-3">
            Download a backup of all your betting data including bankroll,
            bet history, and settings.
          </p>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            💾 Export to JSON
          </button>
        </div>

        {/* Import */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-medium mb-2">📥 Import Data</h3>
          <p className="text-sm text-gray-600 mb-3">
            Restore data from a previously exported JSON file. This will
            overwrite your current data.
          </p>
          <label className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition cursor-pointer inline-block">
            {importing ? "Importing..." : "📂 Choose File"}
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
            />
          </label>
        </div>

        {/* Clear All */}
        <div className="border rounded-lg p-4 bg-red-50 border-red-200">
          <h3 className="font-medium mb-2 text-red-700">🗑️ Clear All Data</h3>
          <p className="text-sm text-gray-700 mb-3">
            Permanently delete all data. This action cannot be undone. Make
            sure to export a backup first!
          </p>
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            🗑️ Clear Everything
          </button>
        </div>

        {/* Info Box */}
        <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
          <h3 className="font-medium mb-2 text-blue-700">ℹ️ Data Storage</h3>
          <p className="text-sm text-gray-700">
            All data is stored locally in your browser using IndexedDB. No data
            is sent to external servers. Regular backups are recommended.
          </p>
        </div>
      </div>
    </div>
  );
}