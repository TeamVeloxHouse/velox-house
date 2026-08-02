import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { gaInit } from "./lib/ga";
import { cfAnalyticsInit } from "./lib/cf-analytics";
import "./index.css";

// Consent Mode defaults must be queued before anything else touches the dataLayer.
gaInit();
// Cookieless traffic counting — runs for everyone, consented or not (see cf-analytics.ts).
cfAnalyticsInit();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
