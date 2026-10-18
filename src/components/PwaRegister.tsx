"use client";
import { useEffect } from "react";

/** Registers the service worker in production only, so development never serves stale cached code. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => console.error("[pwa] service worker not registered:", e));
  }, []);
  return null;
}
