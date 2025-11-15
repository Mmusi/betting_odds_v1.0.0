// defensive_ui/src/context/BankrollContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { getBankroll, saveBankroll, saveBetRecord } from "../utils/db";

const BankrollContext = createContext();

export function BankrollProvider({ children }) {
  const [bankroll, setBankroll] = useState(null); // null = loading
  const [isLoading, setIsLoading] = useState(true);

  // ============================================
  // LOAD BANKROLL FROM INDEXEDDB ON MOUNT
  // ============================================
  useEffect(() => {
    const loadBankroll = async () => {
      try {
        const saved = await getBankroll();
        setBankroll(saved);
      } catch (error) {
        console.error("Failed to load bankroll:", error);
        setBankroll(100); // Fallback
      } finally {
        setIsLoading(false);
      }
    };

    loadBankroll();
  }, []);

  // ============================================
  // ADJUST BANKROLL (+ or -)
  // ============================================
  const adjustBankroll = async (amount) => {
    const newBalance = Math.max((bankroll || 0) + amount, 0); // Never negative
    setBankroll(newBalance);

    try {
      await saveBankroll(newBalance);
    } catch (error) {
      console.error("Failed to save bankroll:", error);
    }
  };

  // ============================================
  // MANUALLY SET BANKROLL
  // ============================================
  const setBalance = async (value) => {
    const newBalance = Math.max(parseFloat(value) || 0, 0);
    setBankroll(newBalance);

    try {
      await saveBankroll(newBalance);
    } catch (error) {
      console.error("Failed to save bankroll:", error);
    }
  };

  // ============================================
  // DEDUCT STAKE (called on solve)
  // ============================================
  const deductStake = async (totalStake) => {
    await adjustBankroll(-totalStake);
  };

  // ============================================
  // APPLY OUTCOME (called when user selects result)
  // ============================================
  const applyOutcome = async (net, betRecord) => {
    // Net already accounts for stake, so we just add it
    await adjustBankroll(net);

    // Save to bet history with outcome applied
    try {
      await saveBetRecord({
        ...betRecord,
        applied: true,
        finalNet: net,
      });
    } catch (error) {
      console.error("Failed to save bet record:", error);
    }
  };

  return (
    <BankrollContext.Provider
      value={{
        bankroll,
        isLoading,
        adjustBankroll,
        setBalance,
        deductStake,
        applyOutcome,
      }}
    >
      {children}
    </BankrollContext.Provider>
  );
}

export function useBankroll() {
  const context = useContext(BankrollContext);
  if (!context) {
    throw new Error("useBankroll must be used within BankrollProvider");
  }
  return context;
}