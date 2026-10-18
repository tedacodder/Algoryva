// Algoryva service worker. It caches the app shell and build assets only.
// Pages and API responses are never cached, because they can contain a signed-in learner's data.
const VERSION = "algoryva-v1";
const SHELL = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Build assets have hashed names, so they never change: serve from cache, fill it on first use.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      })),
    );
    return;
  }

  // Page visits: go to the network, and show the offline page only when the network is unavailable.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline")));
  }
});
