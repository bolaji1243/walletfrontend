/* ================= CONFIG ================= */
const API_BASE = window.FastPay?.getApiBase() || "http://localhost:8080";
const SETTINGS = `${API_BASE}/api/settings`;
const PROFILE  = `${API_BASE}/api/profile`;

const token  = window.FastPay?.getToken() || localStorage.getItem("fastpay_token");
const userId = window.FastPay?.getUserId() || localStorage.getItem("fastpay_userId");

if (!token || !userId) {
  alert("You must login first.");
  window.location.href = window.FastPay?.getLoginPath?.() || "../signup/login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization:  `Bearer ${token}`
};

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  initSidebarNav();

  // ✅ Single export call loads everything — replaces 4 broken GET calls:
  //    GET /api/settings/security      → does NOT exist
  //    GET /api/settings/notifications → does NOT exist
  //    GET /api/settings/privacy       → does NOT exist
  //    GET /api/settings/preferences   → does NOT exist
  await loadAllSettings();

  // Wire forms
  document.getElementById("accountForm") ?.addEventListener("submit", handleAccountSave);
  document.getElementById("passwordForm")?.addEventListener("submit", handlePasswordChange);

  // Password visibility toggles
  document.querySelectorAll(".password-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isText    = input.type === "text";
      input.type      = isText ? "password" : "text";
      btn.textContent = isText ? "👁️" : "🙈";
    });
  });

  // Notification toggles
  ["emailTransactions", "emailSavings", "emailMarketing"].forEach(id =>
    document.getElementById(id)?.addEventListener("change", saveEmailNotifications)
  );
  ["pushPayments", "pushLowBalance"].forEach(id =>
    document.getElementById(id)?.addEventListener("change", savePushNotifications)
  );

  // Privacy toggles
  ["shareUsageData", "personalizedAds"].forEach(id =>
    document.getElementById(id)?.addEventListener("change", savePrivacy)
  );

  // Theme select
  document.getElementById("themeSelect")?.addEventListener("change", savePreferences);

  // 2FA toggle
  document.getElementById("twoFactorToggle")?.addEventListener("change", e =>
    saveTwoFactor(e.target.checked)
  );
});

/* ================= SIDEBAR NAV ================= */
function initSidebarNav() {
  document.querySelectorAll(".settings-nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".settings-nav-item").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".settings-section").forEach(s => s.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`${btn.dataset.section}-section`)?.classList.add("active");
    });
  });
}

/* ================= LOAD ALL SETTINGS ================= */
/*
 * ✅ GET /api/settings/privacy/export  — this endpoint EXISTS in SettingController
 * Returns everything in one call:
 * { success, data: {
 *     firstName, lastName, email, phone, address, dateOfBirth,
 *     preferences:   { theme, language, currency, timezone },
 *     notifications: { emailTransactions, emailSavings, emailMarketing,
 *                      emailLoginAlerts, pushPaymentReceived, pushLowBalance },
 *     privacy:       { shareUsageData, personalizedAds },
 *     security:      { twoFactorEnabled },
 *     loginHistory:  [{ device, location, timestamp, currentSession }]
 * }}
 */
async function loadAllSettings() {
  try {
    const res  = await fetch(`${SETTINGS}/privacy/export`, { headers });
    const json = await res.json();

    if (!res.ok || !json.success) {
      console.error("Failed to load settings:", json.message);
      return;
    }

    const d = json.data;
    if (!d) return;

    // ── Account form ──────────────────────────────────────────────────────
    setVal("firstName",   d.firstName   || "");
    setVal("lastName",    d.lastName    || "");
    setVal("email",       d.email       || "");
    setVal("phone",       d.phone       || "");
    setVal("address",     d.address     || "");
    setVal("dateOfBirth", d.dateOfBirth || "");  // "YYYY-MM-DD" — perfect for <input type="date">

    // ── Preferences ───────────────────────────────────────────────────────
    if (d.preferences) {
      setVal("themeSelect",    d.preferences.theme    || "light");
      setVal("languageSelect", d.preferences.language || "en");
      setVal("currencySelect", d.preferences.currency || "NGN");
      setVal("timezoneSelect", d.preferences.timezone || "Africa/Lagos");
      applyTheme(d.preferences.theme || "light");
    }

    // ── Notifications ─────────────────────────────────────────────────────
    if (d.notifications) {
      const n = d.notifications;
      setChecked("emailTransactions", n.emailTransactions   ?? true);
      setChecked("emailSavings",      n.emailSavings        ?? true);
      setChecked("emailMarketing",    n.emailMarketing      ?? false);
      setChecked("pushPayments",      n.pushPaymentReceived ?? true);  // ✅ correct field name
      setChecked("pushLowBalance",    n.pushLowBalance      ?? true);
    }

    // ── Privacy ───────────────────────────────────────────────────────────
    if (d.privacy) {
      setChecked("shareUsageData",  d.privacy.shareUsageData  ?? true);
      setChecked("personalizedAds", d.privacy.personalizedAds ?? true);
    }

    // ── Security ──────────────────────────────────────────────────────────
    if (d.security) {
      setChecked("twoFactorToggle", d.security.twoFactorEnabled ?? false);
    }

    // ── Login history — included in export, no extra request needed ───────
    renderLoginHistory(d.loginHistory || []);

  } catch (err) {
    console.error("Error loading settings:", err);
    showNotification("Failed to load settings", "error");
  }
}

/* ================= ACCOUNT SAVE ================= */
/*
 * ✅ PUT /api/profile
 * Body: { firstName, lastName, phone, dateOfBirth, address }
 * Email is NOT sent — changes need separate verification
 */
async function handleAccountSave(e) {
  e.preventDefault();

  const btn  = e.target.querySelector("button[type='submit']");
  const body = {
    firstName:   getVal("firstName"),
    lastName:    getVal("lastName"),
    phone:       getVal("phone"),
    dateOfBirth: getVal("dateOfBirth"),
    address:     getVal("address")
  };

  if (!body.firstName || !body.lastName) {
    showNotification("First name and last name are required", "error"); return;
  }

  setButtonLoading(btn, "Saving…");

  try {
    const res  = await fetch(PROFILE, {
      method:  "PUT",
      headers,
      body:    JSON.stringify(body)
    });
    const json = await res.json();
    showNotification(
      json.message || (json.success ? "Profile updated" : "Failed to update profile"),
      json.success ? "success" : "error"
    );
  } catch (err) {
    console.error("Account save error:", err);
    showNotification("Failed to update profile", "error");
  } finally {
    setButtonDone(btn, "Save Changes");
  }
}

function resetForm(formId) {
  if (formId === "accountForm") loadAllSettings();
  else document.getElementById(formId)?.reset();
}

/* ================= CHANGE PASSWORD ================= */
/*
 * ✅ PUT (NOT POST) /api/settings/security/password
 * Body: { currentPassword, newPassword, confirmPassword }
 */
async function handlePasswordChange(e) {
  e.preventDefault();

  const msgEl           = document.getElementById("passwordMessage");
  const btn             = e.target.querySelector("button[type='submit']");
  const currentPassword = getVal("currentPassword");
  const newPassword     = getVal("newPassword");
  const confirmPassword = getVal("confirmPassword");

  if (!currentPassword || !newPassword || !confirmPassword) {
    showMsg(msgEl, "All password fields are required", "error"); return;
  }
  if (newPassword.length < 8) {
    showMsg(msgEl, "New password must be at least 8 characters", "error"); return;
  }
  if (newPassword !== confirmPassword) {
    showMsg(msgEl, "New passwords do not match", "error"); return;
  }

  setButtonLoading(btn, "Updating…");
  if (msgEl) msgEl.textContent = "";

  try {
    const res  = await fetch(`${SETTINGS}/security/password`, {
      method:  "PUT",    // ✅ PUT — not POST
      headers,
      body:    JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
    const json = await res.json();

    if (res.ok && json.success) {
      showMsg(msgEl, json.message || "Password updated successfully", "success");
      e.target.reset();
    } else {
      showMsg(msgEl, json.message || "Failed to update password", "error");
    }
  } catch (err) {
    console.error("Password change error:", err);
    showMsg(msgEl, "Failed to update password", "error");
  } finally {
    setButtonDone(btn, "Update Password");
  }
}

/* ================= TWO-FACTOR AUTH ================= */
/*
 * ✅ PUT (NOT POST) /api/settings/security/2fa  (NOT /two-factor)
 * Body: { enabled: true/false }
 */
async function saveTwoFactor(enabled) {
  try {
    const res  = await fetch(`${SETTINGS}/security/2fa`, {
      method:  "PUT",    // ✅ PUT — not POST
      headers,
      body:    JSON.stringify({ enabled })
    });
    const json = await res.json();

    if (res.ok && json.success) {
      showNotification(`Two-factor authentication ${enabled ? "enabled" : "disabled"}`, "success");
    } else {
      showNotification(json.message || "Failed to update 2FA", "error");
      const toggle = document.getElementById("twoFactorToggle");
      if (toggle) toggle.checked = !enabled;  // revert on failure
    }
  } catch (err) {
    console.error("2FA error:", err);
    showNotification("Failed to update 2FA", "error");
    const toggle = document.getElementById("twoFactorToggle");
    if (toggle) toggle.checked = !enabled;
  }
}

/* ================= LOGIN HISTORY ================= */
function renderLoginHistory(history = []) {
  const container = document.getElementById("loginHistory");
  if (!container) return;

  if (!history.length) {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:0.9rem;">No login history available</p>`;
    return;
  }

  container.innerHTML = history.map(entry => `
    <div class="login-history-item" style="
      display:flex; justify-content:space-between; align-items:flex-start;
      padding:1rem 0; border-bottom:1px solid var(--border);
    ">
      <div>
        <div style="font-weight:500;font-size:0.95rem;margin-bottom:0.25rem;">
          ${escapeHtml(entry.device || "Unknown device")}
          ${entry.currentSession
            ? `<span style="margin-left:0.5rem;padding:0.15rem 0.5rem;background:var(--success-bg);color:var(--success);border-radius:999px;font-size:0.75rem;">Current</span>`
            : ""}
        </div>
        <div style="color:var(--text-muted);font-size:0.85rem;">
          📍 ${escapeHtml(entry.location || "Unknown location")}
        </div>
      </div>
      <div style="color:var(--text-muted);font-size:0.85rem;white-space:nowrap;margin-left:1rem;">
        ${formatDateTime(entry.timestamp)}
      </div>
    </div>
  `).join("");
}

/* ================= EMAIL NOTIFICATIONS ================= */
/*
 * ✅ PUT /api/settings/notifications/email — EXISTS in SettingController
 * Sends full object so backend replaces all fields at once
 */
async function saveEmailNotifications() {
  try {
    const res  = await fetch(`${SETTINGS}/notifications/email`, {
      method:  "PUT",
      headers,
      body:    JSON.stringify({
        emailTransactions: isChecked("emailTransactions"),
        emailSavings:      isChecked("emailSavings"),
        emailMarketing:    isChecked("emailMarketing"),
        emailLoginAlerts:  false  // not shown in UI
      })
    });
    const json = await res.json();
    showNotification(
      json.message || "Email preferences saved",
      json.success ? "success" : "error"
    );
  } catch (err) {
    console.error("Email notification save error:", err);
    showNotification("Failed to save email preferences", "error");
  }
}

/* ================= PUSH NOTIFICATIONS ================= */
/*
 * ✅ PUT /api/settings/notifications/push — EXISTS in SettingController
 * ✅ pushPaymentReceived — correct backend field name (not pushPayments)
 */
async function savePushNotifications() {
  try {
    const res  = await fetch(`${SETTINGS}/notifications/push`, {
      method:  "PUT",
      headers,
      body:    JSON.stringify({
        pushPaymentReceived: isChecked("pushPayments"),   // ✅ correct field
        pushLowBalance:      isChecked("pushLowBalance")
      })
    });
    const json = await res.json();
    showNotification(
      json.message || "Push preferences saved",
      json.success ? "success" : "error"
    );
  } catch (err) {
    console.error("Push notification save error:", err);
    showNotification("Failed to save push preferences", "error");
  }
}

/* ================= PRIVACY ================= */
/* ✅ PUT /api/settings/privacy — EXISTS in SettingController */
async function savePrivacy() {
  try {
    const res  = await fetch(`${SETTINGS}/privacy`, {
      method:  "PUT",
      headers,
      body:    JSON.stringify({
        shareUsageData:  isChecked("shareUsageData"),
        personalizedAds: isChecked("personalizedAds")
      })
    });
    const json = await res.json();
    showNotification(
      json.message || "Privacy settings saved",
      json.success ? "success" : "error"
    );
  } catch (err) {
    console.error("Privacy save error:", err);
    showNotification("Failed to save privacy settings", "error");
  }
}

/* ================= PREFERENCES ================= */
/* ✅ PUT /api/settings/preferences — EXISTS in SettingController */
async function savePreferences() {
  const theme = getVal("themeSelect");
  applyTheme(theme);

  try {
    const res  = await fetch(`${SETTINGS}/preferences`, {
      method:  "PUT",
      headers,
      body:    JSON.stringify({
        theme,
        language: getVal("languageSelect") || "en",
        currency: getVal("currencySelect") || "NGN",
        timezone: getVal("timezoneSelect") || "Africa/Lagos"
      })
    });
    const json = await res.json();
    showNotification(
      json.message || "Preferences saved",
      json.success ? "success" : "error"
    );
  } catch (err) {
    console.error("Preferences save error:", err);
    showNotification("Failed to save preferences", "error");
  }
}

function applyTheme(theme) {
  const resolved = theme === "auto"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  document.documentElement.setAttribute("data-theme", resolved);

  // Apply theme classes for consistency
  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");
    document.body.classList.remove("light");
  } else {
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark");
    document.body.classList.add("light");
  }
  localStorage.setItem("fastpay_theme", resolved);
}

/* ================= HELPERS ================= */
function getVal(id)          { return (document.getElementById(id)?.value || "").trim(); }
function setVal(id, val)     { const el = document.getElementById(id); if (el) el.value = val; }
function isChecked(id)       { return document.getElementById(id)?.checked ?? false; }
function setChecked(id, val) { const el = document.getElementById(id); if (el) el.checked = val; }

function setButtonLoading(btn, text) {
  if (!btn) return;
  btn.disabled    = true;
  btn.textContent = text;
}
function setButtonDone(btn, text) {
  if (!btn) return;
  btn.disabled    = false;
  btn.textContent = text;
}

function showMsg(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className   = `password-message ${type}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTime(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function showNotification(message, type = "success") {
  const el = document.createElement("div");
  el.textContent   = message;
  el.style.cssText = `
    position:fixed; top:2rem; right:2rem;
    padding:1rem 1.5rem; border-radius:8px;
    box-shadow:0 4px 20px rgba(0,0,0,.15); z-index:10000;
    animation:slideIn .3s ease; max-width:400px; font-weight:500;
    background:${type === "success" ? "var(--success-bg,#f0fdf4)" : "var(--error-bg,#fef2f2)"};
    color:${type === "success" ? "var(--success,#16a34a)" : "var(--error,#dc2626)"};
    border:1px solid ${type === "success" ? "var(--success,#16a34a)" : "var(--error,#dc2626)"};
  `;
  document.body.appendChild(el);

  if (!document.getElementById("notif-anim")) {
    const s = document.createElement("style");
    s.id = "notif-anim";
    s.textContent = `
      @keyframes slideIn  { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
      @keyframes slideOut { from{transform:translateX(0);opacity:1} to{transform:translateX(100%);opacity:0} }
    `;
    document.head.appendChild(s);
  }

  setTimeout(() => {
    el.style.animation = "slideOut .3s ease";
    setTimeout(() => el.remove(), 300);
  }, 3500);
}
