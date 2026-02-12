import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { UI_VERSION } from "../version";

(window as any).__UI_VERSION__ = UI_VERSION;

if ("serviceWorker" in navigator) {
  try {
    const protocol = window.location.protocol;
    if (protocol === "http:" || protocol === "https:") {
      navigator.serviceWorker
        .register("/ui-cache-sw.js")
        .then((reg) => console.log("SW registered", reg))
        .catch((err) => console.warn("SW registration failed:", err));
    }
  } catch (err) {
    console.warn("Service Worker registration skipped:", err);
  }
}


ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
