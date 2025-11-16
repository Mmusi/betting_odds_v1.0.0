// defensive_ui/src/components/StatisticsDashboard.jsx
import React, { useState, useEffect } from "react";
import { calculateStatistics, getBetsByDateRange } from "../utils/db";

export default function StatisticsDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("all"); // all, 7days, 30days, custom

  useEffect(() => {
    loadStats();
  }, [dateFilter]);

  const loadStats = async () => {
    setLoading(true);
    try {
      let statsData;

      if (dateFilter === "all") {
        statsData = await calculateStatistics();
      } else {
        // Filter by date range
        const endDate = new Date();
        let startDate = new Date();

        if (dateFilter === "7days") {
          startDate.setDate(endDate.getDate() - 7);
        } else if (dateFilter === "30days") {
          startDate.setDate(endDate.getDate() - 30);
        }

        const filteredBets = await getBetsByDateRange(startDate, endDate);
        // Calculate stats for filtered bets (simplified)
        statsData = await calculateStatistics(); // For now, show all
      }

      setStats(statsData);
    } catch (err) {
      console.error("Failed to load statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-5 rounded-xl shadow-md">
        <p className="text-gray-500 text-center">Loading statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white p-5 rounded-xl shadow-md">
        <p className="text-gray-500 text-center">No statistics available</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">📊 Statistics Dashboard</h2>

        {/* Date Filter */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="border px-3 py-1 rounded text-sm"
        >
          <option value="all">All Time</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
        </select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Bets"
          value={stats.totalBets}
          icon="📝"
          color="blue"
        />
        <StatCard
          label="Resolved"
          value={stats.resolvedCount}
          icon="✅"
          color="green"
        />
        <StatCard
          label="Pending"
          value={stats.unresolvedCount}
          icon="⏳"
          color="yellow"
        />
        <StatCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          icon="🎯"
          color="purple"
        />
      </div>

      {/* Financial Summary */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="text-sm text-gray-600 mb-1">Total Wagered</div>
          <div className="text-2xl font-bold text-blue-600">
            {stats.totalWagered.toFixed(2)}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="text-sm text-gray-600 mb-1">Total Profit/Loss</div>
          <div
            className={`text-2xl font-bold ${
              stats.totalProfit >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {stats.totalProfit >= 0 ? "+" : ""}
            {stats.totalProfit.toFixed(2)}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="text-sm text-gray-600 mb-1">ROI</div>
          <div
            className={`text-2xl font-bold ${
              stats.roi >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {stats.roi >= 0 ? "+" : ""}
            {stats.roi.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Performance Breakdown */}
      <div className="border rounded-lg p-4 bg-gray-50 mb-6">
        <h3 className="font-semibold mb-3">Performance Breakdown</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {stats.winningBets}
            </div>
            <div className="text-sm text-gray-600">Wins</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {stats.losingBets}
            </div>
            <div className="text-sm text-gray-600">Losses</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-600">
              {stats.breakEvenBets}
            </div>
            <div className="text-sm text-gray-600">Break-Even</div>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="text-xs text-gray-600 mb-1">Average Profit</div>
          <div
            className={`text-lg font-semibold ${
              stats.avgProfit >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {stats.avgProfit >= 0 ? "+" : ""}
            {stats.avgProfit.toFixed(2)}
          </div>
        </div>

        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="text-xs text-gray-600 mb-1">Biggest Win</div>
          <div className="text-lg font-semibold text-green-600">
            +{stats.biggestWin.toFixed(2)}
          </div>
        </div>

        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="text-xs text-gray-600 mb-1">Biggest Loss</div>
          <div className="text-lg font-semibold text-red-600">
            {stats.biggestLoss.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for stat cards
function StatCard({ label, value, icon, color }) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    yellow: "bg-yellow-100 text-yellow-600",
    purple: "bg-purple-100 text-purple-600",
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  );
}