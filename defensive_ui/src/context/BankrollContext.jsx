// defensive_ui/src/context/BankrollContext.jsx
// ✅ Clean bankroll management for new workflow
import React, { createContext, useContext, useState, useEffect } from "react";
import { getBankroll, saveBankroll } from "../utils/db";

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
  // Generic method for any adjustment
  // ============================================
  const adjustBankroll = async (amount) => {
    const newBalance = Math.max((bankroll || 0) + amount, 0); // Never negative
    setBankroll(newBalance);

    try {
      await saveBankroll(newBalance);
      console.log(`💰 Bankroll adjusted by ${amount >= 0 ? '+' : ''}${amount.toFixed(2)} → ${newBalance.toFixed(2)}`);
    } catch (error) {
      console.error("Failed to save bankroll:", error);
      throw error;
    }
  };

  // ============================================
  // MANUALLY SET BANKROLL
  // Used in settings or import
  // ============================================
  const setBalance = async (value) => {
    const newBalance = Math.max(parseFloat(value) || 0, 0);
    setBankroll(newBalance);

    try {
      await saveBankroll(newBalance);
      console.log(`💰 Bankroll set to ${newBalance.toFixed(2)}`);
    } catch (error) {
      console.error("Failed to save bankroll:", error);
      throw error;
    }
  };

  // ============================================
  // DEDUCT STAKE
  // Called ONLY in BetPlacementStep.jsx
  // ============================================
  const deductStake = async (totalStake) => {
    if (totalStake <= 0) {
      throw new Error("Invalid stake amount");
    }

    if (bankroll != null && totalStake > bankroll) {
      throw new Error("Insufficient bankroll");
    }

    console.log(`💸 Deducting stake: ${totalStake.toFixed(2)}`);
    await adjustBankroll(-totalStake);
  };

  // ============================================
  // ADD WINNINGS
  // Called when recording results or cashing out
  // ============================================
  const addWinnings = async (amount) => {
    if (amount <= 0) {
      console.warn("No winnings to add");
      return;
    }

    console.log(`💵 Adding winnings: ${amount.toFixed(2)}`);
    await adjustBankroll(amount);
  };

  // ============================================
  // RETURN NET PROFIT/LOSS
  // Used in MatchResultsEntry
  // Stake already deducted, so just add the NET
  // ============================================
  const recordResult = async (netAmount) => {
    console.log(`📊 Recording result: ${netAmount >= 0 ? '+' : ''}${netAmount.toFixed(2)}`);
    
    if (netAmount !== 0) {
      await adjustBankroll(netAmount);
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
        addWinnings,
        recordResult,
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