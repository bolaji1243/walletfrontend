/* ================= CONFIG ================= */
const API_BASE = window.FastPay?.getApiBase() || "http://localhost:8080";
const token    = window.FastPay?.getToken() || localStorage.getItem("fastpay_token");
const userId   = window.FastPay?.getUserId() || localStorage.getItem("fastpay_userId");

if (!token || !userId) {
  alert("You must login first.");
  window.location.href = window.FastPay?.getLoginPath?.() || "../signup/login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization:  `Bearer ${token}`
};

/* ================= DOM REFS ================= */
const photoInput        = document.getElementById("photoInput");
const avatarImage       = document.getElementById("avatarImage");
const avatarPlaceholder = document.getElementById("avatarPlaceholder");
const avatarInitials    = document.getElementById("avatarInitials");
const kycModal          = document.getElementById("kycModal");
const documentInput     = document.getElementById("documentInput");
const selfieInput       = document.getElementById("selfieInput");

/* ================= KYC STATE ================= */
let currentStep = 1;
let kycData = { personal: {}, document: null, selfie: null };

/* ================= ANIMATIONS (declared ONCE) ================= */
const animStyle = document.createElement("style");
animStyle.textContent = `
  @keyframes slideIn  { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0);    opacity: 1; } }
  @keyframes slideOut { from { transform: translateX(0);    opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(animStyle);

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
  loadUserProfile();
  loadAccountStats();
  loadRecentActivity();
  loadKYCStatus();
  initializePhotoUpload();
  initializeDocumentUpload();
  initializeSelfieUpload();
});

/* ================= LOAD PROFILE ================= */
async function loadUserProfile() {
  try {
    const res  = await fetch(`${API_BASE}/api/profile`, { headers });
    const json = await res.json();

    if (!res.ok || !json.success) {
      console.error("Failed to load profile:", json.message);
      return;
    }

    displayProfile(json.data);

  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

function displayProfile(p) {
  // ── Header ────────────────────────────────────────────────────────────────
  setText("profileName",  `${p.firstName || ""} ${p.lastName || ""}`.trim() || "User Name");
  setText("profileEmail", p.email || "user@example.com");

  // ── Avatar ────────────────────────────────────────────────────────────────
  if (p.avatarUrl) {
    avatarImage.src                 = p.avatarUrl;
    avatarImage.style.display       = "block";
    avatarPlaceholder.style.display = "none";
  } else {
    if (avatarInitials) avatarInitials.textContent = getInitials(p.firstName, p.lastName);
    avatarImage.style.display       = "none";
    avatarPlaceholder.style.display = "flex";
  }

  // ── Member since ──────────────────────────────────────────────────────────
  if (p.memberSince)
    setText("memberSince", `Member since ${p.memberSince}`);

  // ── Verified badge ────────────────────────────────────────────────────────
  const badge = document.getElementById("verifiedBadge");
  if (badge) badge.style.display = p.verified ? "inline-flex" : "none";

  // ── Personal info panel ───────────────────────────────────────────────────
  setText("infoEmail",   p.email   || "Not provided");
  setText("infoPhone",   p.phone   || "Not provided");
  setText("infoAddress", p.address || "Not provided");

  // DOB: backend sends "YYYY-MM-DD" — parse as LOCAL date to avoid
  // UTC midnight shifting the day back by 1 in Lagos (UTC+1)
  if (p.dateOfBirth) {
    const [y, m, d] = p.dateOfBirth.split("-").map(Number);
    const local = new Date(y, m - 1, d);
    setText("infoDob", local.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric"
    }));
  } else {
    setText("infoDob", "Not provided");
  }
}

/* ================= LOAD STATS ================= */
async function loadAccountStats() {
  try {
    const res  = await fetch(`${API_BASE}/api/profile/stats`, { headers });
    const json = await res.json();

    if (!res.ok || !json.success) {
      console.error("Failed to load stats:", json.message);
      return;
    }

    const s = json.data;
    setText("totalTransactions", s.totalTransactions ?? 0);
    setText("totalVolume",       formatCurrency(s.totalVolume ?? 0));
    setText("savingsGoals",      s.savingsGoals      ?? 0);
    setText("rewardsPoints",     s.rewardPoints      ?? 0);

  } catch (err) {
    console.error("Error loading stats:", err);
  }
}

/* ================= LOAD RECENT ACTIVITY ================= */
async function loadRecentActivity() {
  try {
    const res  = await fetch(`${API_BASE}/api/profile/activity`, { headers });
    const json = await res.json();

    if (!res.ok || !json.success) {
      displayActivity([]);
      return;
    }

    displayActivity(json.data || []);

  } catch (err) {
    console.error("Error loading activity:", err);
    displayActivity([]);
  }
}

function displayActivity(activities) {
  const list = document.getElementById("activityList");
  if (!list) return;

  if (!activities || activities.length === 0) {
    list.innerHTML = `<div class="empty-state-small"><p>No recent activity</p></div>`;
    return;
  }

  list.innerHTML = activities.map(a => `
    <div class="activity-item">
      <div class="activity-icon">${getActivityIcon(a.type)}</div>
      <div class="activity-content">
        <div class="activity-title">${formatActivityTitle(a.type)}</div>
        <div class="activity-meta">
          <span class="activity-status status-${(a.status || "").toLowerCase()}">${a.status || ""}</span>
          <span class="activity-time">${formatRelativeTime(a.createdAt)}</span>
        </div>
      </div>
      <div class="activity-amount ${isCredit(a.type) ? "amount-credit" : "amount-debit"}">
        ${isCredit(a.type) ? "+" : "-"}${formatCurrency(a.amount || 0)}
      </div>
    </div>
  `).join("");
}

/* ================= LOAD KYC STATUS ================= */
async function loadKYCStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/user/kyc/status`, { headers });
    displayKYCStatus(res.ok ? await res.json() : { status: "not_verified" });
  } catch (_) {
    displayKYCStatus({ status: "not_verified" });
  }
}

function displayKYCStatus(kyc) {
  const statusEl            = document.getElementById("kycStatus");
  const notVerifiedSection  = document.getElementById("kycNotVerified");
  const verifiedSection     = document.getElementById("kycVerified");
  const pendingSection      = document.getElementById("kycPending");
  const verifiedBadge       = document.getElementById("verifiedBadge");

  notVerifiedSection.style.display = "none";
  verifiedSection.style.display    = "none";
  pendingSection.style.display     = "none";

  switch (kyc.status) {
    case "verified":
      statusEl.textContent          = "Verified";
      statusEl.className            = "verification-status verified";
      verifiedSection.style.display = "block";
      if (verifiedBadge)    verifiedBadge.style.display = "inline-flex";
      if (kyc.verifiedAt)   setText("verificationDate", formatDateLocal(kyc.verifiedAt));
      if (kyc.documentType) setText("documentType",     formatDocumentType(kyc.documentType));
      break;

    case "pending":
      statusEl.textContent         = "Pending Review";
      statusEl.className           = "verification-status pending";
      pendingSection.style.display = "block";
      if (kyc.submittedAt) setText("submissionTime", formatDateTime(kyc.submittedAt));
      break;

    default:
      statusEl.textContent             = "Not Verified";
      statusEl.className               = "verification-status";
      notVerifiedSection.style.display = "block";
  }
}

/* ================= AVATAR UPLOAD ================= */
function initializePhotoUpload() {
  if (!photoInput) return;

  photoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showNotification("Please select an image file", "error"); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotification("Image must be less than 5MB", "error"); return;
    }

    // Instant local preview
    const reader = new FileReader();
    reader.onload = ev => {
      avatarImage.src                 = ev.target.result;
      avatarImage.style.display       = "block";
      avatarPlaceholder.style.display = "none";
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res  = await fetch(`${API_BASE}/api/profile/avatar`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    formData
      });
      const json = await res.json();

      if (res.ok && json.success) {
        avatarImage.src = json.avatarUrl;
        showNotification("Profile photo updated successfully", "success");
      } else {
        showNotification(json.message || "Failed to upload photo", "error");
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      showNotification("Failed to upload photo", "error");
    }
  });
}

/* ================= EDIT PROFILE MODAL ================= */

/**
 * Call this from your "Edit Profile" button:
 *   <button onclick="openEditProfileModal()">Edit Profile</button>
 *
 * It pre-fills the modal fields from the current displayed values so
 * the user sees their existing data, not blank inputs.
 */
window.openEditProfileModal = async function () {
  const modal = document.getElementById("editProfileModal");
  if (!modal) {
    console.error("editProfileModal element not found in HTML");
    return;
  }

  // Pre-fill from a fresh API fetch so data is always current
  try {
    const res  = await fetch(`${API_BASE}/api/profile`, { headers });
    const json = await res.json();

    if (res.ok && json.success) {
      const p = json.data;
      setInputValue("editFirstName", p.firstName   || "");
      setInputValue("editLastName",  p.lastName    || "");
      setInputValue("editPhone",     p.phone       || "");
      setInputValue("editAddress",   p.address     || "");
      // Convert "YYYY-MM-DD" straight into the date input (it already expects that format)
      setInputValue("editDob",       p.dateOfBirth || "");
    }
  } catch (err) {
    console.error("Failed to pre-fill edit form:", err);
  }

  modal.classList.add("active");
};

window.closeEditProfileModal = function () {
  const modal = document.getElementById("editProfileModal");
  if (modal) modal.classList.remove("active");
};

/**
 * Wires up to the Save button inside the Edit Profile modal:
 *   <button onclick="saveProfile()">Save Changes</button>
 *
 * Sends PUT /api/profile with the updated fields, then re-renders
 * the profile panel so the new data appears immediately.
 */
window.saveProfile = async function () {
  const btn = document.getElementById("saveProfileBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

  const body = {
    firstName:   getInputValue("editFirstName"),
    lastName:    getInputValue("editLastName"),
    phone:       getInputValue("editPhone"),
    address:     getInputValue("editAddress"),
    dateOfBirth: getInputValue("editDob")   // "YYYY-MM-DD" — exactly what the backend stores
  };

  // Basic client-side guard
  if (!body.firstName || !body.lastName) {
    showNotification("First name and last name are required", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Save Changes"; }
    return;
  }

  try {
    const res  = await fetch(`${API_BASE}/api/profile`, {
      method:  "PUT",
      headers,
      body:    JSON.stringify(body)
    });
    const json = await res.json();

    if (res.ok && json.success) {
      showNotification("Profile updated successfully", "success");
      window.closeEditProfileModal();
      // Re-render the page with fresh data from server
      loadUserProfile();
    } else {
      showNotification(json.message || "Failed to update profile", "error");
    }
  } catch (err) {
    console.error("Save profile error:", err);
    showNotification("Failed to update profile", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Save Changes"; }
  }
};

/* ================= KYC MODAL ================= */
window.openKYCModal = function () {
  kycModal.classList.add("active");
  currentStep = 1;
  updateStepDisplay();
};

window.closeKYCModal = function () {
  kycModal.classList.remove("active");
  resetKYCForm();
};

window.nextStep = function (step) {
  if (currentStep === 1) {
    const form = document.getElementById("kycPersonalForm");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    kycData.personal = {
      firstName:   document.getElementById("kycFirstName").value,
      lastName:    document.getElementById("kycLastName").value,
      dateOfBirth: document.getElementById("kycDob").value,
      gender:      document.getElementById("kycGender").value,
      address:     document.getElementById("kycAddress").value,
      city:        document.getElementById("kycCity").value,
      state:       document.getElementById("kycState").value
    };
  } else if (currentStep === 2) {
    if (!document.getElementById("documentTypeSelect").value) {
      showNotification("Please select a document type", "error"); return;
    }
    if (!kycData.document) {
      showNotification("Please upload your document", "error"); return;
    }
  }
  currentStep = step;
  updateStepDisplay();
};

window.previousStep = function (step) {
  currentStep = step;
  updateStepDisplay();
};

function updateStepDisplay() {
  document.querySelectorAll(".step").forEach((el, i) => {
    const n = i + 1;
    el.classList.remove("active", "completed");
    if (n < currentStep)        el.classList.add("completed");
    else if (n === currentStep) el.classList.add("active");
  });
  document.querySelectorAll(".step-content").forEach((el, i) =>
    el.classList.toggle("active", i + 1 === currentStep)
  );
}

/* ================= KYC DOCUMENT / SELFIE ================= */
function initializeDocumentUpload() {
  if (!documentInput) return;
  documentInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const valid = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!valid.includes(file.type)) {
      showNotification("Please select a valid image or PDF", "error"); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotification("File must be less than 5MB", "error"); return;
    }

    kycData.document = file;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = ev => {
        document.getElementById("documentImage").src = ev.target.result;
        document.getElementById("documentUpload").querySelector(".upload-placeholder").style.display = "none";
        document.getElementById("documentPreview").style.display = "block";
      };
      reader.readAsDataURL(file);
    } else {
      document.getElementById("documentUpload").querySelector(".upload-placeholder").style.display = "none";
      document.getElementById("documentPreview").innerHTML = `
        <div style="padding:2rem;text-align:center;">
          <div style="font-size:3rem;margin-bottom:1rem;">📄</div>
          <p>${file.name}</p>
        </div>
        <button class="remove-upload" onclick="removeDocument()">✕</button>
      `;
      document.getElementById("documentPreview").style.display = "block";
    }
  });
}

window.removeDocument = function () {
  kycData.document    = null;
  documentInput.value = "";
  document.getElementById("documentUpload").querySelector(".upload-placeholder").style.display = "block";
  document.getElementById("documentPreview").style.display = "none";
};

function initializeSelfieUpload() {
  if (!selfieInput) return;
  selfieInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showNotification("Please select an image file", "error"); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotification("Image must be less than 5MB", "error"); return;
    }

    kycData.selfie   = file;
    const reader     = new FileReader();
    reader.onload    = ev => {
      document.getElementById("selfieImage").src = ev.target.result;
      document.getElementById("selfieUpload").querySelector(".upload-placeholder").style.display = "none";
      document.getElementById("selfiePreview").style.display = "block";
    };
    reader.readAsDataURL(file);
  });
}

window.removeSelfie = function () {
  kycData.selfie    = null;
  selfieInput.value = "";
  document.getElementById("selfieUpload").querySelector(".upload-placeholder").style.display = "block";
  document.getElementById("selfiePreview").style.display = "none";
};

/* ================= SUBMIT KYC ================= */
window.submitKYC = async function () {
  if (!kycData.selfie) {
    showNotification("Please upload a selfie", "error"); return;
  }

  const formData = new FormData();
  Object.entries(kycData.personal).forEach(([k, v]) => formData.append(k, v));
  formData.append("documentType", document.getElementById("documentTypeSelect").value);
  formData.append("document",     kycData.document);
  formData.append("selfie",       kycData.selfie);

  try {
    const res  = await fetch(`${API_BASE}/api/user/kyc/submit`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    formData
    });
    const json = await res.json();

    if (res.ok) {
      showNotification("KYC submitted successfully!", "success");
      window.closeKYCModal();
      loadKYCStatus();
    } else {
      showNotification(json.message || "Failed to submit KYC", "error");
    }
  } catch (err) {
    console.error("KYC submit error:", err);
    showNotification("Failed to submit KYC verification", "error");
  }
};

function resetKYCForm() {
  kycData = { personal: {}, document: null, selfie: null };
  document.getElementById("kycPersonalForm")?.reset();
  const sel = document.getElementById("documentTypeSelect");
  if (sel) sel.value = "";
  window.removeDocument();
  window.removeSelfie();
  currentStep = 1;
  updateStepDisplay();
}

/* ================= HELPERS ================= */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getInitials(first, last) {
  return ((first?.[0] || "") + (last?.[0] || "")).toUpperCase() || "U";
}

function isCredit(type) {
  return ["FUND", "CREDIT", "CONTRIBUTION"].includes((type || "").toUpperCase());
}

function formatActivityTitle(type) {
  const map = {
    FUND:         "Wallet Funded",
    CREDIT:       "Credit Received",
    DEBIT:        "Debit",
    TRANSFER:     "Transfer Sent",
    WITHDRAW:     "Withdrawal",
    BILL_PAYMENT: "Bill Payment",
    CONTRIBUTION: "Savings Deposit"
  };
  return map[(type || "").toUpperCase()] || type || "Transaction";
}

function getActivityIcon(type) {
  const icons = {
    FUND:         "📥",
    CREDIT:       "💚",
    DEBIT:        "📤",
    TRANSFER:     "🔄",
    WITHDRAW:     "💸",
    BILL_PAYMENT: "📲",
    CONTRIBUTION: "🎯"
  };
  return icons[(type || "").toUpperCase()] || "📌";
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-NG", {
    style:                 "currency",
    currency:              "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Handles both "YYYY-MM-DD" (date-only) and full ISO timestamps
function formatDateLocal(dateString) {
  if (!dateString) return "—";
  if (dateString.includes("T")) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric"
    });
  }
  // Date-only — split manually to avoid UTC midnight shifting the day
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });
}

function formatDateTime(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "—";
  const diff  = Date.now() - new Date(timestamp).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "Just now";
  if (mins  < 60) return `${mins} min${mins   !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hr${hours  !== 1 ? "s" : ""} ago`;
  if (days  < 7)  return `${days} day${days   !== 1 ? "s" : ""} ago`;
  return formatDateLocal(timestamp);
}

function formatDocumentType(type) {
  const types = {
    passport:        "International Passport",
    drivers_license: "Driver's License",
    national_id:     "National ID Card",
    voters_card:     "Voter's Card"
  };
  return types[type] || type;
}

function showNotification(message, type = "success") {
  const el = document.createElement("div");
  el.className   = `notification notification-${type}`;
  el.textContent = message;
  el.style.cssText = `
    position: fixed; top: 2rem; right: 2rem;
    padding: 1rem 1.5rem; border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg); z-index: 10000;
    animation: slideIn 0.3s ease; max-width: 400px;
    background: ${type === "success" ? "var(--success-bg)" : "var(--error-bg)"};
    color:      ${type === "success" ? "var(--success)"    : "var(--error)"};
    border: 1px solid ${type === "success" ? "var(--success)" : "var(--error)"};
  `;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.animation = "slideOut 0.3s ease";
    setTimeout(() => el.remove(), 300);
  }, 3500);
}
