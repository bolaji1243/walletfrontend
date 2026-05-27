/* ============================================================
   transfer.js
   ============================================================ */

const BASE  = window.FastPay?.getApiBase() || "http://localhost:8080";
const TOKEN = window.FastPay?.getToken()   || localStorage.getItem("fastpay_token");

const EP = {
  banks:    `${BASE}/api/banks`,
  verify:   `${BASE}/api/verify-account`,
  fpUser:   `${BASE}/api/transfer/fastpay-user`,
  transfer: `${BASE}/api/transfer`,
};

/* ────────────────────────────────────────────────────────────
   Shared helpers
   ──────────────────────────────────────────────────────────── */

function fmt(n) {
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcFee(amt) {
  if (amt <= 0)     return 0;
  if (amt <= 5000)  return 10.75;
  if (amt <= 50000) return 26.88;
  return 53.75;
}

function rawNum(str) {
  return parseFloat((str || "").replace(/,/g, "")) || 0;
}

async function safeFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (window.FastPay?.readResponse) return window.FastPay.readResponse(res);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function closeSuccessModal() {
  document.getElementById("successModal").classList.remove("show");
}
window.closeSuccessModal = closeSuccessModal;


/* ════════════════════════════════════════════════════════════
   TAB SWITCHER
   ════════════════════════════════════════════════════════════ */

document.querySelectorAll(".transfer-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;

    document.querySelectorAll(".transfer-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === target);
      t.setAttribute("aria-selected", t.dataset.tab === target);
    });

    document.querySelectorAll(".transfer-panel").forEach((panel) => {
      const isTarget = panel.id === `panel-${target}`;
      panel.classList.toggle("active", isTarget);
      panel.hidden = !isTarget;
    });
  });
});


/* ════════════════════════════════════════════════════════════
   BANK TRANSFER PANEL
   ════════════════════════════════════════════════════════════ */

const bankSelect      = document.getElementById("bankCode");
const accountInput    = document.getElementById("accountNumber");
const verifyBadge     = document.getElementById("verifyBadge");
const recipientCard   = document.getElementById("recipientCard");
const recipientName   = document.getElementById("recipientName");
const recipientBank   = document.getElementById("recipientBank");
const amountInput     = document.getElementById("amount");
const bankStatusMsg   = document.getElementById("bankStatusMsg");
const bankTransferBtn = document.getElementById("bankTransferBtn");

let verifiedAccountName = null;
let bankDebounce = null;

function bankBadge(state, text) {
  verifyBadge.className = state ? `verify-badge ${state}` : "verify-badge";
  verifyBadge.innerHTML = state === "verifying"
    ? `<div class="verify-spinner"></div><span>${text}</span>`
    : state ? `<span>${text}</span>` : "";
}

function showBankRecipient(name, bank) {
  recipientName.textContent = name;
  recipientBank.textContent = bank;
  recipientCard.classList.add("visible");
}

function hideBankRecipient() {
  recipientCard.classList.remove("visible");
  recipientName.textContent = "-";
  recipientBank.textContent = "-";
}

function setBankStatus(state, html) {
  bankStatusMsg.className = state ? `status-message ${state}` : "status-message";
  bankStatusMsg.innerHTML  = html;
}

function setBankBtnLoading(on) {
  bankTransferBtn.disabled = on;
  bankTransferBtn.querySelector(".btn-text").textContent = on ? "Processing…" : "Send Money";
}

function updateBankSummary() {
  const amt = rawNum(amountInput.value);
  const fee = calcFee(amt);
  document.getElementById("summaryAmount").textContent = fmt(amt);
  document.getElementById("summaryFee").textContent    = fmt(fee);
  document.getElementById("summaryTotal").textContent  = fmt(amt + fee);
}

amountInput.addEventListener("input", updateBankSummary);

document.querySelectorAll(".quick-amount-btn:not(.fp-quick)").forEach((btn) => {
  btn.addEventListener("click", () => {
    amountInput.value = Number(btn.dataset.amount).toLocaleString();
    updateBankSummary();
    document.querySelectorAll(".quick-amount-btn:not(.fp-quick)").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

async function loadBanks() {
  try {
    const res = await fetch(EP.banks);
    if (!res.ok) throw new Error();
    const banks = await res.json();

    bankSelect.innerHTML = '<option value="">Select a bank</option>';
    banks
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(({ code, name }) => {
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = name;
        bankSelect.appendChild(opt);
      });
  } catch {
    bankSelect.innerHTML = '<option value="">Failed to load banks</option>';
  }
}

async function verifyAccount() {
  const accountNumber = accountInput.value.trim();
  const bankCode      = bankSelect.value;

  verifiedAccountName = null;
  hideBankRecipient();

  if (accountNumber.length !== 10 || !bankCode) {
    bankBadge("", "");
    return;
  }

  bankBadge("verifying", "Verifying…");

  try {
    const url = `${EP.verify}?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`;
    const { ok, data } = await safeFetch(url);
    if (!ok) throw new Error();

    verifiedAccountName = data.accountName;
    bankBadge("verified", `✓ ${verifiedAccountName}`);
    showBankRecipient(verifiedAccountName, bankSelect.selectedOptions[0]?.text || "");
  } catch {
    bankBadge("failed", "Could not verify – check account details");
  }
}

accountInput.addEventListener("input", () => {
  clearTimeout(bankDebounce);
  bankDebounce = setTimeout(verifyAccount, 600);
});

bankSelect.addEventListener("change", verifyAccount);

document.getElementById("bankTransferForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setBankStatus("", "");

  if (!verifiedAccountName) {
    setBankStatus("error", "Please wait for account verification to complete.");
    return;
  }

  const pin    = document.getElementById("pin").value;
  const amount = rawNum(amountInput.value);

  if (pin.length !== 4) { setBankStatus("error", "PIN must be exactly 4 digits."); return; }
  if (amount < 100)     { setBankStatus("error", "Minimum transfer is ₦100.");      return; }

  setBankBtnLoading(true);

  try {
    const { ok, data } = await safeFetch(EP.transfer, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
      body: JSON.stringify({
        transferType:  "BANK",
        accountNumber: accountInput.value.trim(),
        bankCode:      bankSelect.value,
        accountName:   verifiedAccountName,
        amount,
        narration:     document.getElementById("narration").value.trim(),
        pin,
      }),
    });

    if (!ok) throw new Error(data?.message || "Transfer failed");

    document.getElementById("modalMessage").textContent =
      `${fmt(amount)} sent to ${verifiedAccountName} successfully. REF: ${data.reference}`;
    document.getElementById("successModal").classList.add("show");

    e.target.reset();
    updateBankSummary();
    bankBadge("", "");
    hideBankRecipient();
    verifiedAccountName = null;
  } catch (err) {
    setBankStatus("error", `Error: ${err.message}`);
  } finally {
    setBankBtnLoading(false);
  }
});


/* ════════════════════════════════════════════════════════════
   FASTPAY USER TRANSFER PANEL
   ════════════════════════════════════════════════════════════ */

const fpPhoneInput      = document.getElementById("fpPhone");
const fpLookupBtn       = document.getElementById("fpLookupBtn");
const fpVerifyBadge     = document.getElementById("fpVerifyBadge");
const fpRecipientCard   = document.getElementById("fpRecipientCard");
const fpRecipientName   = document.getElementById("fpRecipientName");
const fpRecipientAvatar = document.getElementById("fpRecipientAvatar");
const fpAmountInput     = document.getElementById("fpAmount");
const fpStatusMsg       = document.getElementById("fpStatusMsg");
const fpTransferBtn     = document.getElementById("fpTransferBtn");

/**
 * Holds the resolved FastPay recipient after a successful lookup.
 * Shape: { userId: string, name: string, phone: string }
 * Cleared whenever the phone input is edited.
 */
let resolvedFpUser = null;

function fpBadge(state, text) {
  fpVerifyBadge.className = state ? `verify-badge ${state}` : "verify-badge";
  fpVerifyBadge.innerHTML = state === "verifying"
    ? `<div class="verify-spinner"></div><span>${text}</span>`
    : state ? `<span>${text}</span>` : "";
}

function showFpRecipient(user) {
  fpRecipientAvatar.textContent = user.name?.charAt(0).toUpperCase() || "💎";
  fpRecipientName.textContent   = user.name;
  fpRecipientCard.classList.add("visible");
  fpRecipientCard.hidden = false;
}

function hideFpRecipient() {
  fpRecipientCard.classList.remove("visible");
  fpRecipientCard.hidden        = true;
  fpRecipientName.textContent   = "-";
  fpRecipientAvatar.textContent = "💎";
}

function setFpStatus(state, html) {
  fpStatusMsg.className = state ? `status-message ${state}` : "status-message";
  fpStatusMsg.innerHTML  = html;
}

function setFpBtnLoading(on) {
  fpTransferBtn.disabled = on;
  fpTransferBtn.querySelector(".btn-text").textContent = on ? "Processing…" : "Send Instantly";
}

function updateFpSummary() {
  const amt = rawNum(fpAmountInput.value);
  document.getElementById("fpSummaryAmount").textContent = fmt(amt);
  document.getElementById("fpSummaryTotal").textContent  = fmt(amt); // no fee
}

fpAmountInput.addEventListener("input", updateFpSummary);

document.querySelectorAll(".quick-amount-btn.fp-quick").forEach((btn) => {
  btn.addEventListener("click", () => {
    fpAmountInput.value = Number(btn.dataset.amount).toLocaleString();
    updateFpSummary();
    document.querySelectorAll(".quick-amount-btn.fp-quick").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

/* ── Lookup FastPay user by phone ────────────────────────── */

async function lookupFpUser() {
  const phone = fpPhoneInput.value.trim();

  resolvedFpUser = null;
  hideFpRecipient();
  setFpStatus("", "");

  if (phone.length < 10) {
    fpBadge("failed", "Enter a valid phone number");
    return;
  }

  fpBadge("verifying", "Looking up user…");
  fpLookupBtn.disabled = true;

  try {
    const url = `${EP.fpUser}?phone=${encodeURIComponent(phone)}`;
    const { ok, data } = await safeFetch(url, {
      headers: { "Authorization": `Bearer ${TOKEN}` },
    });

    if (!ok) {
      throw new Error(data?.message || "No FastPay account found for this number");
    }

    /*
      FastPayRecipientResponse (fixed DTO):
      { userId: UUID, name: string, phone: string }
    */
    resolvedFpUser = {
      userId: data.userId,
      name:   data.name,
      phone:  data.phone,
    };

    fpBadge("verified", "✓ FastPay member found");
    showFpRecipient(resolvedFpUser);

  } catch (err) {
    fpBadge("failed", err.message);
    hideFpRecipient();
  } finally {
    fpLookupBtn.disabled = false;
  }
}

fpLookupBtn.addEventListener("click", lookupFpUser);

fpPhoneInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); lookupFpUser(); }
});

// Editing the phone field invalidates the resolved user
fpPhoneInput.addEventListener("input", () => {
  if (resolvedFpUser) {
    resolvedFpUser = null;
    hideFpRecipient();
    fpBadge("", "");
  }
});

/* ── Submit FastPay transfer ─────────────────────────────── */

document.getElementById("fastpayTransferForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setFpStatus("", "");

  if (!resolvedFpUser) {
    setFpStatus("error", "Please find a FastPay user before sending.");
    return;
  }

  const pin    = document.getElementById("fpPin").value;
  const amount = rawNum(fpAmountInput.value);

  if (pin.length !== 4) { setFpStatus("error", "PIN must be exactly 4 digits."); return; }
  if (amount < 100)     { setFpStatus("error", "Minimum transfer is ₦100.");      return; }

  setFpBtnLoading(true);

  try {
    const { ok, data } = await safeFetch(EP.transfer, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
      body: JSON.stringify({
        transferType:    "FASTPAY",
        recipientUserId: resolvedFpUser.userId,   // primary — direct DB lookup, no phone normalisation
        recipientPhone:  resolvedFpUser.phone,    // fallback field used by resolveRecipient()
        amount,
        narration: document.getElementById("fpNarration").value.trim(),
        pin,
      }),
    });

    if (!ok) throw new Error(data?.message || "Transfer failed");

    document.getElementById("modalMessage").textContent =
      `${fmt(amount)} sent to ${resolvedFpUser.name} instantly — no fees! REF: ${data.reference}`;
    document.getElementById("successModal").classList.add("show");

    e.target.reset();
    updateFpSummary();
    fpBadge("", "");
    hideFpRecipient();
    resolvedFpUser = null;

  } catch (err) {
    setFpStatus("error", `Error: ${err.message}`);
  } finally {
    setFpBtnLoading(false);
  }
});


/* ════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════ */

loadBanks();
updateBankSummary();
updateFpSummary();