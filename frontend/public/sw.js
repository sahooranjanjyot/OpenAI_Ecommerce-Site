/**
 * Service Worker (G-172, G-094, G-126)
 * Enables PWA offline support, background sync, push notifications
 * Place this file in /public/sw.js
 */

const CACHE_NAME    = "groceryos-v1";
const STATIC_ASSETS = ["/", "/faq", "/privacy", "/terms", "/cookies", "/accessibility"];

// ── Install: cache static assets ─────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: Network-first with cache fallback ──────────────────────────────────
self.addEventListener("fetch", (event) => {
  // Never intercept API calls or admin routes
  if (event.request.url.includes("/api/") || event.request.url.includes("/admin")) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful GET responses
        if (event.request.method === "GET" && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached ?? caches.match("/")))
  );
});

// ── Push Notifications (G-094) ────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "GroceryOS", {
      body:    data.body  ?? "You have a new notification",
      icon:    data.icon  ?? "/icons/icon-192.png",
      badge:   data.badge ?? "/icons/icon-72.png",
      tag:     data.tag   ?? "groceryos",
      data:    { url: data.url ?? "/" },
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(windows => {
      const url = event.notification.data?.url ?? "/";
      if (windows.length > 0) return windows[0].navigate(url);
      return clients.openWindow(url);
    })
  );
});

// ── Background Sync (G-030) — sync offline cart/orders ───────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-cart") {
    event.waitUntil(
      // In production: read from IndexedDB and POST to /api/cart
      Promise.resolve(console.info("[SW] Background cart sync triggered"))
    );
  }
});
