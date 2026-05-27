/* =====================================================
   FastPay Service Worker — Web Push Notifications
   Place this file at the ROOT of your project
   e.g. /service-worker.js  (same level as index.html)
   ===================================================== */

const APP_NAME = "FastPay";

// ── Receive push from backend ────────────────────────
self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data?.json() ?? {};
  } catch (_) {
    data = { title: APP_NAME, body: event.data?.text() || "You have a new notification" };
  }

  const title   = data.title  || APP_NAME;
  const options = {
    body:    data.body    || "",
    icon:    data.icon    || "/icon.png",    // 192×192 app icon
    badge:   data.badge   || "/badge.png",   // 72×72 monochrome badge
    tag:     data.tag     || "fastpay-notif",// groups notifications of the same type
    data:    { url: data.url || "/dashboard.html" },
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── User clicks the notification popup ───────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/dashboard.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(windowClients => {
        // If the app is already open — focus it
        for (const client of windowClients) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Activate immediately (skip waiting) ──────────────
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", e  => e.waitUntil(clients.claim()));