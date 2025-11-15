import React, { createContext, useContext, useState } from "react";

// ---------------------------------------------------
// Context holder
// ---------------------------------------------------
const BankrollContext = createContext();

// ---------------------------------------------------
// Provider component
// ---------------------------------------------------
export function BankrollProvider({ children }) {
  const [bankroll, setBankroll] = useState(100);   // default 100

  // 🔥 adjust bankroll (+ or -)
  const adjustBankroll = (amount) => {
    setBankroll((prev) => Math.max(prev + amount, 0)); // never negative
  };

  // 🔥 manually set bankroll
  const setBalance = (value) => {
    setBankroll(parseFloat(value) || 0);
  };

  return (
    <BankrollContext.Provider value={{ bankroll, adjustBankroll, setBalance }}>
      {children}
    </BankrollContext.Provider>
  );
}

// ---------------------------------------------------
// Hook used everywhere in UI
// ---------------------------------------------------
export function useBankroll() {
  return useContext(BankrollContext);
}
