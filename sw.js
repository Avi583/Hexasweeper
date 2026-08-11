/* ===========================================================
   Hexasweeper Service Worker
   Caches the app shell so the game works fully offline once
   it has been loaded a first time. Uses a cache-first strategy
   for app-shell assets and a network-first strategy for
   navigation requests (so updates are picked up promptly).
=========================================================== */

const CACHE_VERSION = "v1";
const CACHE_NAME = `hexasweeper-${CACHE_VERSION}`;

const BASE = "/Hexasweeper/";

const APP_SHELL = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}style.css`,
  `${BASE}script.js`,
  `${BASE}site.webmanifest`,
  `${BASE}Images/favicon.ico`,
  `${BASE}Images/favicon-16x16.png`,
  `${BASE}Images/favicon-32x32.png`,
  `${BASE}Images/apple-touch-icon.png`,
  `${BASE}Images/android-chrome-192x192.png`,
  `${BASE}Images/android-chrome-512x512.png`,
];

// ---- install: pre-cache the app shell ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ---- activate: clean up old caches ----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("hexasweeper-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ---- fetch: network-first for navigations, cache-first for assets ----
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(`${BASE}index.html`)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
