// defensive_ui/src/utils/db.js
// IndexedDB wrapper for persistent storage

const DB_NAME = "DefensiveBettingDB";
const DB_VERSION = 2; // ⬆️ Incremented for schema changes

// ============================================
// INITIALIZATION
// ============================================
export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Bankroll store
      if (!db.objectStoreNames.contains("bankroll")) {
        db.createObjectStore("bankroll", { keyPath: "id" });
      }

      // Bet history store with auto-increment ID + NEW INDEXES
      if (!db.objectStoreNames.contains("betHistory")) {
        const betStore = db.createObjectStore("betHistory", {
          keyPath: "id",
          autoIncrement: true,
        });
        betStore.createIndex("timestamp", "timestamp", { unique: false });
        betStore.createIndex("applied", "applied", { unique: false });
        betStore.createIndex("resolved", "resolved", { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }

      // Statistics store
      if (!db.objectStoreNames.contains("statistics")) {
        db.createObjectStore("statistics", { keyPath: "id" });
      }
    };
  });
};

// ============================================
// GENERIC OPERATIONS (EXPORTED)
// ============================================
export const getFromStore = async (storeName, key) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const putToStore = async (storeName, data) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteFromStore = async (storeName, key) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

export const getAllFromStore = async (storeName) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// ============================================
// BANKROLL API
// ============================================
export const getBankroll = async () => {
  const data = await getFromStore("bankroll", 1);
  return data ? data.balance : 100; // Default 100
};

export const saveBankroll = async (balance) => {
  await putToStore("bankroll", {
    id: 1,
    balance: parseFloat(balance),
    lastUpdated: new Date().toISOString(),
  });
};

// ============================================
// BET HISTORY API
// ============================================
export const saveBetRecord = async (record) => {
  return await putToStore("betHistory", {
    ...record,
    timestamp: new Date().toISOString(),
    status: record.status || "calculated",
    applied: false,
    resolved: false,
    matchResults: null,
    actualNet: null,
    cashoutAmount: null,
  });
};

export const getAllBets = async () => {
  const bets = await getAllFromStore("betHistory");
  return bets.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

export const updateBetRecord = async (id, updates) => {
  const existing = await getFromStore("betHistory", id);
  if (!existing) throw new Error("Bet record not found");

  await putToStore("betHistory", {
    ...existing,
    ...updates,
  });
};

export const deleteBetRecord = async (id) => {
  return await deleteFromStore("betHistory", id);
};

export const getUnappliedBets = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("betHistory", "readonly");
    const store = transaction.objectStore("betHistory");
    const index = store.index("applied");
    const request = index.getAll(false);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Get placed but unresolved bets (waiting for match results)
export const getPlacedUnresolvedBets = async () => {
  const allBets = await getAllBets();
  return allBets.filter((bet) => bet.status === "placed" && !bet.resolved);
};

// Mark bet as placed
export const placeBet = async (betId) => {
  await updateBetRecord(betId, {
    status: "placed",
    placedAt: new Date().toISOString(),
  });
};

// Cashout a bet
export const cashoutBet = async (betId, cashoutAmount) => {
  const bet = await getFromStore("betHistory", betId);
  if (!bet) throw new Error("Bet not found");

  // Calculate net from cashout (cashout - total stake)
  const totalStake = Object.values(bet.stakes || {}).reduce(
    (sum, s) => sum + s,
    0
  );
  const netFromCashout = cashoutAmount - totalStake;

  await updateBetRecord(betId, {
    status: "cashed_out",
    resolved: true,
    cashoutAmount,
    actualNet: netFromCashout,
    cashedOutAt: new Date().toISOString(),
  });

  return netFromCashout;
};

// Record match results for a bet
export const recordMatchResults = async (betId, matchResults) => {
  const bet = await getFromStore("betHistory", betId);
  if (!bet) throw new Error("Bet not found");

  // Calculate actual net based on results
  let actualNet = -Object.values(bet.stakes || {}).reduce(
    (sum, s) => sum + s,
    0
  ); // Start with -totalStake

  for (const [betKey, stakeAmount] of Object.entries(bet.stakes || {})) {
    const matchIndex = parseInt(betKey.split("_")[0].replace("M", "")) - 1;
    const actualResult = matchResults[matchIndex];

    // Check if bet won
    const wonBet = checkIfBetWon(betKey, actualResult);
    if (wonBet) {
      const odds = getBetOdds(bet, betKey);
      actualNet += stakeAmount * odds;
    }
  }

  await updateBetRecord(betId, {
    status: "resolved",
    resolved: true,
    matchResults,
    actualNet,
  });

  return actualNet;
};

// Helper: Check if bet won based on result
const checkIfBetWon = (betKey, result) => {
  if (!result) return false;

  if (
    betKey.includes("_H") &&
    !betKey.includes("_HD") &&
    !betKey.includes("_HA")
  )
    return result === "H";
  if (
    betKey.includes("_D") &&
    !betKey.includes("_HD") &&
    !betKey.includes("_AD")
  )
    return result === "D";
  if (
    betKey.includes("_A") &&
    !betKey.includes("_AD") &&
    !betKey.includes("_HA")
  )
    return result === "A";
  if (betKey.includes("_HD")) return result === "H" || result === "D";
  if (betKey.includes("_AD")) return result === "A" || result === "D";
  if (betKey.includes("_HA")) return result === "H" || result === "A";

  return false;
};

// Helper: Get odds for a bet
const getBetOdds = (bet, betKey) => {
  if (!bet.matches) return 1.0;

  const matchIndex = parseInt(betKey.split("_")[0].replace("M", "")) - 1;
  const match = bet.matches[matchIndex];
  if (!match) return 1.0;

  if (
    betKey.includes("_H") &&
    !betKey.includes("_HD") &&
    !betKey.includes("_HA")
  )
    return parseFloat(match.home) || 1.0;
  if (
    betKey.includes("_D") &&
    !betKey.includes("_HD") &&
    !betKey.includes("_AD")
  )
    return parseFloat(match.draw) || 1.0;
  if (
    betKey.includes("_A") &&
    !betKey.includes("_AD") &&
    !betKey.includes("_HA")
  )
    return parseFloat(match.away) || 1.0;
  if (betKey.includes("_HD")) return parseFloat(match.hd) || 1.0;
  if (betKey.includes("_AD")) return parseFloat(match.ad) || 1.0;
  if (betKey.includes("_HA")) return parseFloat(match.ha) || 1.0;

  return 1.0;
};

// ============================================
// STATISTICS API
// ============================================
export const calculateStatistics = async () => {
  const bets = await getAllBets();
  const resolvedBets = bets.filter((b) => b.resolved);

  const totalBets = bets.length;
  const resolvedCount = resolvedBets.length;
  const unresolvedCount = totalBets - resolvedCount;

  const totalWagered = resolvedBets.reduce((sum, b) => {
    return sum + Object.values(b.stakes || {}).reduce((s, val) => s + val, 0);
  }, 0);

  const totalReturns = resolvedBets.reduce(
    (sum, b) => sum + (b.actualNet || 0),
    0
  );
  const totalProfit = totalReturns;

  const winningBets = resolvedBets.filter((b) => (b.actualNet || 0) > 0).length;
  const losingBets = resolvedBets.filter((b) => (b.actualNet || 0) < 0).length;
  const breakEvenBets = resolvedBets.filter(
    (b) => (b.actualNet || 0) === 0
  ).length;

  // Separate cashout stats
  const cashedOutBets = resolvedBets.filter((b) => b.status === "cashed_out");
  const cashedOutCount = cashedOutBets.length;
  const cashedOutProfit = cashedOutBets.reduce(
    (sum, b) => sum + (b.actualNet || 0),
    0
  );

  const winRate = resolvedCount > 0 ? (winningBets / resolvedCount) * 100 : 0;
  const roi = totalWagered > 0 ? (totalProfit / totalWagered) * 100 : 0;

  const avgProfit = resolvedCount > 0 ? totalProfit / resolvedCount : 0;
  const biggestWin = resolvedBets.reduce(
    (max, b) => Math.max(max, b.actualNet || 0),
    0
  );
  const biggestLoss = resolvedBets.reduce(
    (min, b) => Math.min(min, b.actualNet || 0),
    0
  );

  return {
    totalBets,
    resolvedCount,
    unresolvedCount,
    totalWagered,
    totalReturns,
    totalProfit,
    winningBets,
    losingBets,
    breakEvenBets,
    cashedOutCount,
    cashedOutProfit,
    winRate,
    roi,
    avgProfit,
    biggestWin,
    biggestLoss,
  };
};

// Get bets by date range
export const getBetsByDateRange = async (startDate, endDate) => {
  const allBets = await getAllBets();
  return allBets.filter((bet) => {
    const betDate = new Date(bet.timestamp);
    return betDate >= startDate && betDate <= endDate;
  });
};

// ============================================
// SETTINGS API
// ============================================
export const getSettings = async () => {
  const data = await getFromStore("settings", "app");
  return data || { id: "app", currency: "BWP", theme: "light" };
};

export const saveSettings = async (settings) => {
  await putToStore("settings", { id: "app", ...settings });
};

// ============================================
// UTILITIES
// ============================================
export const clearAllData = async () => {
  const db = await initDB();
  const storeNames = ["bankroll", "betHistory", "settings"];

  for (const storeName of storeNames) {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    await store.clear();
  }
};

export const exportData = async () => {
  const [bankroll, bets, settings] = await Promise.all([
    getFromStore("bankroll", 1),
    getAllBets(),
    getSettings(),
  ]);

  return {
    bankroll,
    betHistory: bets,
    settings,
    exportDate: new Date().toISOString(),
  };
};

export const importData = async (data) => {
  if (data.bankroll) await saveBankroll(data.bankroll.balance);
  if (data.settings) await saveSettings(data.settings);
  if (data.betHistory) {
    for (const bet of data.betHistory) {
      const { id, ...rest } = bet; // Remove old ID for auto-increment
      await saveBetRecord(rest);
    }
  }
};