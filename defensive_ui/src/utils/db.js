// defensive_ui/src/utils/db.js
// IndexedDB wrapper for persistent storage

const DB_NAME = "DefensiveBettingDB";
const DB_VERSION = 1;

// Initialize database with stores
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

      // Bet history store with auto-increment ID
      if (!db.objectStoreNames.contains("betHistory")) {
        const betStore = db.createObjectStore("betHistory", {
          keyPath: "id",
          autoIncrement: true,
        });
        betStore.createIndex("timestamp", "timestamp", { unique: false });
        betStore.createIndex("applied", "applied", { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }
    };
  });
};

// Generic get operation
const getFromStore = async (storeName, key) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Generic put operation
const putToStore = async (storeName, data) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Generic delete operation
const deleteFromStore = async (storeName, key) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

// Get all records from a store
const getAllFromStore = async (storeName) => {
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
    applied: false,
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
    const request = index.getAll(false); // Get all where applied = false

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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