// sw.js — Service Worker for Expense Tracker PWA

const CACHE = "expense-tracker-v1";
const OFFLINE_ASSETS = ["/", "/index.html", "/manifest.json"];
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxq0KDc7Yz2iaxLdGfDbvgKnXhaFg6j6lbOVJnwGDuXVydju_D1dqJrSz5kQ5lOk8RP/exec";

// ── INSTALL: cache core assets safely ─────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(
        OFFLINE_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn("Failed to cache:", url, err))
        )
      )
    )
  );
  self.skipWaiting();
});

// ── ACTIVATE: remove old caches ───────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH: network-first for API, cache-first for app shell ───
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // API requests to GAS
  if (url.href.startsWith(SCRIPT_URL)) {
    e.respondWith(
      fetch(e.request)
        .then(res => res)
        .catch(() =>
          new Response(JSON.stringify({ ok: false, error: "offline" }), {
            headers: { "Content-Type": "application/json" }
          })
        )
    );
    return;
  }

  // App shell: cache first
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached ||
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match("/index.html"))
    )
  );
});

// ── BACKGROUND SYNC: send queued offline expenses ───────────
self.addEventListener("sync", e => {
  if (e.tag === "sync-expenses") {
    e.waitUntil(syncQueuedExpenses());
  }
});

// Notify clients to sync queued expenses
async function syncQueuedExpenses() {
  const clientsList = await self.clients.matchAll();
  for (const client of clientsList) {
    client.postMessage({ type: "sync-start" });
  }
}

// Optional: push notification when sync complete
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SYNC_COMPLETE") {
    self.registration.showNotification("Expenses synced!", {
      body: "Your offline expenses have been uploaded.",
    });
  }
});
