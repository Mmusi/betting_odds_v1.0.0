// defensive_ui/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

import { BankrollProvider } from "./context/BankrollContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BankrollProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BankrollProvider>
  </StrictMode>
);