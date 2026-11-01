import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./pages/Dashboard";
import "./styles/globals.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
