/* ui-cache-sw.js */

const UI_CACHE = "ui-cache-v1";
const APP_SHELL = [
  "/",
  "/index.html",
];

// Install: cache app shell
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(UI_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== UI_CACHE) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: online-first for UI, fallback to cache
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(UI_CACHE).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // Navigation fallback: return the app shell when offline.
        if (event.request.mode === "navigate") {
          return caches.match("/index.html");
        }

        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
        });
      })
  );
});
