/* =====================================================
   FastPay Push Notification Registration
   ===================================================== */

const PUSH_API = `${window.FastPay?.getApiBase?.() || "http://localhost:8080"}/api/push`;

// ✅ Read token inside the function — not at file load time
// (at file load time the user may not be logged in yet)

async function registerPushNotifications() {
  console.log("🔔 [Push] Starting registration...");

  // ── Step 1: Check browser support ────────────────────
  if (!("serviceWorker" in navigator)) {
    console.warn("🔔 [Push] STOPPED — serviceWorker not supported in this browser");
    return;
  }
  console.log("🔔 [Push] Step 1 ✅ serviceWorker supported");

  if (!("PushManager" in window)) {
    console.warn("🔔 [Push] STOPPED — PushManager not supported (try Chrome or Edge)");
    return;
  }
  console.log("🔔 [Push] Step 2 ✅ PushManager supported");

  // ── Step 2: Check token ───────────────────────────────
  const token = localStorage.getItem("fastpay_token");
  if (!token) {
    console.warn("🔔 [Push] STOPPED — no token in localStorage (user not logged in)");
    return;
  }
  console.log("🔔 [Push] Step 3 ✅ token found");

  // ── Step 3: Check current permission ─────────────────
  console.log("🔔 [Push] Current permission:", Notification.permission);
  if (Notification.permission === "denied") {
    console.warn("🔔 [Push] STOPPED — notifications blocked by user");
    console.warn("🔔 [Push] Fix: Chrome → Settings → Privacy → Site Settings → Notifications → localhost → Reset");
    return;
  }

  try {
    // ── Step 4: Register service worker ──────────────────
    console.log("🔔 [Push] Registering service worker at /service-worker.js ...");
    const registration = await navigator.serviceWorker.register("/service-worker.js");
    console.log("🔔 [Push] Step 4 ✅ Service worker registered:", registration.scope);

    // ── Step 5: Check if already subscribed ──────────────
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      console.log("🔔 [Push] Step 5 ✅ Already subscribed — nothing to do");
      return;
    }
    console.log("🔔 [Push] Step 5 ✅ No existing subscription — will subscribe now");

    // ── Step 6: Request permission ────────────────────────
    console.log("🔔 [Push] Requesting notification permission...");
    const permission = await Notification.requestPermission();
    console.log("🔔 [Push] Permission result:", permission);

    if (permission !== "granted") {
      console.warn("🔔 [Push] STOPPED — user denied permission");
      return;
    }
    console.log("🔔 [Push] Step 6 ✅ Permission granted");

    // ── Step 7: Get VAPID key from backend ────────────────
    console.log("🔔 [Push] Fetching VAPID public key from backend...");
    const keyRes = await fetch(`${PUSH_API}/vapid-public-key`);

    if (!keyRes.ok) {
      console.error("🔔 [Push] STOPPED — failed to fetch VAPID key, status:", keyRes.status);
      return;
    }

    const keyData   = await keyRes.json();
    const publicKey = keyData.publicKey;
    console.log("🔔 [Push] Step 7 ✅ VAPID key received:", publicKey?.substring(0, 20) + "...");

    if (!publicKey) {
      console.error("🔔 [Push] STOPPED — publicKey is empty in response");
      return;
    }

    // ── Step 8: Subscribe to push manager ────────────────
    console.log("🔔 [Push] Subscribing to PushManager...");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    console.log("🔔 [Push] Step 8 ✅ Subscribed to push manager");

    // ── Step 9: Save subscription to backend ─────────────
    const sub = subscription.toJSON();
    console.log("🔔 [Push] Saving subscription to backend...");

    const res  = await fetch(`${PUSH_API}/subscribe`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh:   sub.keys.p256dh,
        auth:     sub.keys.auth
      })
    });

    const json = await res.json();

    if (json.success) {
      console.log("🔔 [Push] Step 9 ✅ Push notifications fully enabled!");
    } else {
      console.error("🔔 [Push] STOPPED — backend rejected subscription:", json.message);
    }

  } catch (err) {
    console.error("🔔 [Push] ERROR at some step:", err.message);
    console.error(err);
  }
}

/* ── Unsubscribe ─────────────────────────────────────── */
async function unregisterPushNotifications() {
  const token = localStorage.getItem("fastpay_token");
  try {
    const registration = await navigator.serviceWorker.getRegistration("/service-worker.js");
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch(`${PUSH_API}/unsubscribe`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });

    await subscription.unsubscribe();
    console.log("🔔 [Push] Unsubscribed successfully");
  } catch (err) {
    console.error("🔔 [Push] Unsubscribe error:", err.message);
  }
}

/* ── Helper ──────────────────────────────────────────── */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── Run after DOM is ready ────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", registerPushNotifications);
} else {
  registerPushNotifications();
}
