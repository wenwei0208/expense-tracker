// sw.js — Service Worker for Expense Tracker PWA

const CACHE = "expense-tracker-v1";
const OFFLINE_ASSETS = ["/", "/index.html", "/manifest.json"];
// API_URL is retrieved from localStorage sent by client
let API_URL = null;

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

  // API requests to Google Apps Script (check if it's an API call)
  if (url.host.includes('script.google.com') || url.href.includes('/exec')) {
    e.respondWith(
      fetch(e.request, {
        method: e.request.method,
        headers: e.request.headers,
        body: e.request.method !== 'GET' ? e.request.body : undefined,
        mode: 'cors',
        credentials: 'omit'
      })
        .then(res => {
          // Log successful API calls
          console.log('[SW] API call successful:', url.href);
          return res;
        })
        .catch(err => {
          // If offline, return JSON indicating offline
          console.warn('[SW] API call failed (offline?):', url.href, err);
          return new Response(
            JSON.stringify({ ok: false, error: "offline", queued: true }),
            { headers: { "Content-Type": "application/json" } }
          );
        })
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
  console.log('[SW] Triggering sync for queued expenses');
  const clientsList = await self.clients.matchAll();
  for (const client of clientsList) {
    // Notify the main app to send queued expenses
    client.postMessage({ type: "sync-expenses" });
  }
  return true;
}

// Message handling between SW and client
self.addEventListener("message", e => {
  if (!e.data) return;

  switch (e.data.type) {
    case "SET_API_URL":
      // Store API URL from client
      API_URL = e.data.url;
      console.log('[SW] API URL set from client');
      break;

    case "SYNC_COMPLETE":
      console.log('[SW] Sync complete, showing notification');
      self.registration.showNotification("Expenses synced!", {
        body: "Your offline expenses have been uploaded.",
      });
      break;

    case "QUEUE_EXPENSE":
      // The client can send a single expense with month info to queue locally
      // This is just an acknowledgment; actual storage is in IndexedDB or localStorage
      console.log("[SW] Queued expense for offline sync:", e.data.expense);
      break;
  }
});
