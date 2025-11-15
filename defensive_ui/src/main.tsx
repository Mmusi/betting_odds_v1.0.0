import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// 👉 Import the context provider
import { BankrollProvider } from "./context/BankrollContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* 👉 Wrap entire UI inside provider */}
    <BankrollProvider>
      <App />
    </BankrollProvider>
  </StrictMode>
);
