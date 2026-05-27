document.addEventListener("DOMContentLoaded", () => {
  /* ================= CONFIG ================= */
  const API_BASE = window.FastPay?.getApiBase() || "http://localhost:8080";
  const API      = API_BASE + "/api/bills";

  const token  = window.FastPay?.getToken() || localStorage.getItem("fastpay_token");
  const userId = window.FastPay?.getUserId() || localStorage.getItem("fastpay_userId");

  if (!token || !userId) {
    alert("You must login first.");
    window.location.href = window.FastPay?.getLoginPath?.() || "../signup/login.html";
    return;
  }

  const authHeaders = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${token}`
  };

  /* ================= STATE ================= */
  const state = {
    airtime:     { net: null },
    data:        { net: null, planAmount: 0 },
    electricity: { provider: null, meterType: "prepaid" },
    cable:       { provider: null, planAmount: 0 },
    internet:    { provider: null, planAmount: 0 },
    education:   { provider: null, planAmount: 0 },
  };

  const netLabels = {
    mtn: "MTN", airtel: "Airtel", glo: "Glo", etisalat: "9mobile",
    "mtn-data": "MTN", "airtel-data": "Airtel",
    "glo-data": "Glo", "etisalat-data": "9mobile"
  };

  const provLabels = {
    "ikeja-electric": "Ikeja Electric", "eko-electric": "Eko Electric",
    "abuja-electric": "Abuja Electric", "kano-electric": "Kano Electric",
    phed: "PHED", eedc: "EEDC",
    dstv: "DStv", gotv: "GOtv", startimes: "Startimes", showmax: "Showmax",
    "smile-direct": "Smile", spectranet: "Spectranet", "swift-data": "Swift",
    waec: "WAEC", jamb: "JAMB", neco: "NECO"
  };

  /* ================= INIT ================= */
  fetchWalletBalance();
  injectPinModal();

  /* ================= PIN MODAL ================= */
  /*
   * Injects a reusable PIN modal into the DOM (if not already in the HTML).
   * Call: requestPin(summaryHTML) → Promise<string>
   * Resolves with the entered PIN or rejects if the user cancels.
   */
  function injectPinModal() {
    if (document.getElementById("pinModal")) return; // already in HTML

    const modal = document.createElement("div");
    modal.id        = "pinModal";
    modal.className = "pin-modal-overlay";
    modal.innerHTML = `
      <div class="pin-modal-box">
        <div class="pin-modal-header">
          <span class="pin-modal-icon">🔐</span>
          <h3>Confirm Payment</h3>
          <button class="pin-modal-close" id="pinModalClose">&times;</button>
        </div>

        <div class="pin-modal-summary" id="pinModalSummary"></div>

        <label class="pin-modal-label" for="pinModalInput">Enter your 4-digit PIN</label>
        <div class="pin-input-wrapper">
          <input
            id        = "pinModalInput"
            type      = "password"
            maxlength = "4"
            inputmode = "numeric"
            pattern   = "[0-9]*"
            placeholder = "● ● ● ●"
            autocomplete = "off"
          />
          <button class="pin-eye-btn" id="pinEyeBtn" type="button" aria-label="Toggle PIN visibility">
            👁
          </button>
        </div>
        <p class="pin-modal-error" id="pinModalError"></p>

        <div class="pin-modal-actions">
          <button class="pin-btn-cancel" id="pinModalCancel">Cancel</button>
          <button class="pin-btn-confirm" id="pinModalConfirm">Confirm Payment</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Toggle visibility
    document.getElementById("pinEyeBtn").addEventListener("click", () => {
      const inp = document.getElementById("pinModalInput");
      inp.type  = inp.type === "password" ? "text" : "password";
    });

    // Only allow digits
    document.getElementById("pinModalInput").addEventListener("input", e => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
      document.getElementById("pinModalError").textContent = "";
    });

    // Close on overlay click
    modal.addEventListener("click", e => {
      if (e.target === modal) closePinModal(false);
    });
  }

  let _pinResolve = null;
  let _pinReject  = null;

  function requestPin(summaryHTML) {
    return new Promise((resolve, reject) => {
      _pinResolve = resolve;
      _pinReject  = reject;

      document.getElementById("pinModalSummary").innerHTML = summaryHTML || "";
      document.getElementById("pinModalInput").value       = "";
      document.getElementById("pinModalError").textContent = "";

      document.getElementById("pinModal").classList.add("show");
      setTimeout(() => document.getElementById("pinModalInput").focus(), 100);

      document.getElementById("pinModalConfirm").onclick = () => {
        const pin = document.getElementById("pinModalInput").value.trim();
        if (!pin || pin.length < 4) {
          document.getElementById("pinModalError").textContent = "Please enter your 4-digit PIN.";
          return;
        }
        closePinModal(true, pin);
      };

      document.getElementById("pinModalCancel").onclick = () => closePinModal(false);
      document.getElementById("pinModalClose").onclick  = () => closePinModal(false);

      // Submit on Enter key
      document.getElementById("pinModalInput").onkeydown = e => {
        if (e.key === "Enter") document.getElementById("pinModalConfirm").click();
      };
    });
  }

  function closePinModal(confirmed, pin) {
    document.getElementById("pinModal").classList.remove("show");
    document.getElementById("pinModalInput").value = "";
    if (confirmed && _pinResolve) _pinResolve(pin);
    else if (_pinReject)          _pinReject(new Error("PIN entry cancelled"));
    _pinResolve = null;
    _pinReject  = null;
  }

  /* ================= WALLET BALANCE ================= */
  async function fetchWalletBalance() {
    const el         = document.getElementById("walletBalance");
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${API_BASE}/wallet/balance`, {
        headers: authHeaders,
        signal:  controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) { el.textContent = "₦ —"; return; }

      const data = await res.json();
      const bal  =
        data?.data?.balance ??
        data?.balance ??
        (typeof data === "number" ? data : undefined);

      el.textContent = bal !== undefined
        ? "₦ " + Number(bal).toLocaleString("en-NG", { minimumFractionDigits: 2 })
        : "₦ —";

    } catch (err) {
      clearTimeout(timeout);
      el.textContent = "₦ —";
    }
  }

  /* ================= PANEL SWITCH ================= */
  window.switchPanel = function (name, tabEl) {
    document.querySelectorAll(".bill-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".cat-tab").forEach(t  => t.classList.remove("active"));
    document.getElementById("panel-" + name).classList.add("active");
    tabEl.classList.add("active");
  };

  /* ================= SELECT NETWORK / PROVIDER ================= */
  window.selectItem = function (el, groupKey) {
    const panel = el.closest(".bill-panel");
    panel.querySelectorAll(".network-btn, .provider-btn").forEach(b => {
      if (b.closest(".card-section") === el.closest(".card-section"))
        b.classList.remove("active");
    });
    el.classList.add("active");
    hideErr(groupKey + "-error");

    const val     = el.dataset.service;
    const panelId = panel.id.replace("panel-", "");
    if (groupKey.endsWith("-net")) state[panelId].net      = val;
    else                           state[panelId].provider = val;
  };

  /* ================= METER TYPE ================= */
  window.selectMeterType = function (el) {
    document.querySelectorAll(".meter-btn").forEach(b => b.classList.remove("active"));
    el.classList.add("active");
    state.electricity.meterType = el.dataset.type;
    document.getElementById("elec-s-type").textContent =
      el.dataset.type.charAt(0).toUpperCase() + el.dataset.type.slice(1);
  };

  /* ================= EXTRACT VARIATIONS ================= */
  function extractVariations(data) {
    if (Array.isArray(data?.content?.varations))        return data.content.varations;
    if (Array.isArray(data?.content?.variations))       return data.content.variations;
    if (Array.isArray(data?.data?.content?.varations))  return data.data.content.varations;
    if (Array.isArray(data?.data?.content?.variations)) return data.data.content.variations;
    if (Array.isArray(data?.data?.varations))           return data.data.varations;
    if (Array.isArray(data?.data?.variations))          return data.data.variations;
    if (Array.isArray(data?.data))                      return data.data;
    if (Array.isArray(data))                            return data;
    return [];
  }

  /* ================= LOAD VARIATIONS ================= */
  window.loadVariations = async function (serviceId, selectId) {
    const sel  = document.getElementById(selectId);
    const wrap = document.getElementById(selectId + "-wrap") || sel.parentElement;
    const load = wrap.querySelector(".variation-loading");

    sel.style.display = "none";
    if (load) load.classList.add("show");
    sel.innerHTML = "<option value=''>Loading…</option>";

    try {
      const res = await fetch(`${API}/variations/${serviceId}`, { headers: authHeaders });
      if (!res.ok) { sel.innerHTML = "<option value=''>Failed to load plans</option>"; return; }

      const variations = extractVariations(await res.json());
      sel.innerHTML    = "<option value=''>— Select a plan —</option>";

      if (variations.length) {
        variations.forEach(v => {
          const opt          = document.createElement("option");
          opt.value          = v.variation_code || v.code || v.id || "";
          opt.dataset.amount = v.variation_amount || v.amount || 0;
          opt.dataset.name   = v.name || v.variation_name || opt.value;
          opt.textContent    = `${v.name || v.variation_name} — ₦${Number(v.variation_amount || v.amount || 0).toLocaleString("en-NG")}`;
          sel.appendChild(opt);
        });
      } else {
        sel.innerHTML = "<option value=''>No plans available</option>";
      }
    } catch (err) {
      sel.innerHTML = "<option value=''>Failed to load plans</option>";
    } finally {
      sel.style.display = "";
      if (load) load.classList.remove("show");
    }
  };

  /* ================= VALIDATE METER ================= */
  window.validateMeter = async function () {
    const provider = state.electricity.provider;
    const meter    = document.getElementById("elec-meter").value.trim();
    const type     = state.electricity.meterType;

    if (!provider) { showToast("error", "⚠ Please select a provider first."); return; }
    if (!meter)    { showFieldErr("elec-meter"); return; }

    try {
      const res  = await fetch(`${API}/validate`, {
        method:  "POST",
        headers: authHeaders,
        body:    JSON.stringify({ serviceId: provider, billersCode: meter, type })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const name = data?.data?.Customer_Name || data?.data?.name || "Verified";
        document.getElementById("elec-customer-name").textContent = name;
        document.getElementById("elec-validate-result").classList.add("show");
      } else {
        showToast("error", data.message || "Meter verification failed.");
      }
    } catch (_) { showToast("error", "Network error during verification."); }
  };

  /* ================= VALIDATE SMART CARD ================= */
  window.validateSmartCard = async function () {
    const provider = state.cable.provider;
    const card     = document.getElementById("cable-card").value.trim();

    if (!provider) { showToast("error", "⚠ Please select a provider first."); return; }
    if (!card)     { showFieldErr("cable-card"); return; }

    try {
      const res  = await fetch(`${API}/validate`, {
        method:  "POST",
        headers: authHeaders,
        body:    JSON.stringify({ serviceId: provider, billersCode: card, type: "smartcard" })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const name = data?.data?.Customer_Name || data?.data?.name || "Verified";
        document.getElementById("cable-customer-name").textContent = name;
        document.getElementById("cable-validate-result").classList.add("show");
      } else {
        showToast("error", data.message || "Smart card verification failed.");
      }
    } catch (_) { showToast("error", "Network error during verification."); }
  };

  window.clearValidateResult = function (prefix) {
    document.getElementById(prefix + "-validate-result")?.classList.remove("show");
  };

  /* ================= QUICK AMOUNT ================= */
  window.qa = function (inputId, val, panel) {
    document.getElementById(inputId).value = val;
    clearErr(inputId);
    syncSummary(panel);
  };

  /* ================= LIVE SUMMARY ================= */
  window.syncSummary = function syncSummary(panel) {
    const s = document.getElementById(panel + "-summary");

    if (panel === "airtime") {
      const net    = state.airtime.net;
      const phone  = document.getElementById("airtime-phone").value.trim();
      const amount = Number(document.getElementById("airtime-amount").value);
      if (net && amount >= 50) {
        setText("airtime-s-net",    netLabels[net] || net);
        setText("airtime-s-phone",  phone || "—");
        setText("airtime-s-amount", "₦" + amount.toLocaleString("en-NG"));
        s.classList.add("show");
      } else { s.classList.remove("show"); }

    } else if (panel === "data") {
      const net   = state.data.net;
      const sel   = document.getElementById("data-plans");
      const opt   = sel.selectedOptions[0];
      const phone = document.getElementById("data-phone").value.trim();
      if (net && sel.value && phone) {
        setText("data-s-net",    netLabels[net] || net);
        setText("data-s-plan",   opt?.dataset.name || sel.options[sel.selectedIndex]?.text || "—");
        setText("data-s-phone",  phone);
        setText("data-s-amount", "₦" + Number(opt?.dataset.amount || 0).toLocaleString("en-NG"));
        s.classList.add("show");
      } else { s.classList.remove("show"); }

    } else if (panel === "electricity") {
      const prov   = state.electricity.provider;
      const meter  = document.getElementById("elec-meter").value.trim();
      const amount = Number(document.getElementById("elec-amount").value);
      if (prov && meter && amount >= 1000) {
        setText("elec-s-prov",   provLabels[prov] || prov);
        setText("elec-s-meter",  meter);
        setText("elec-s-amount", "₦" + amount.toLocaleString("en-NG"));
        s.classList.add("show");
      } else { s.classList.remove("show"); }

    } else if (panel === "cable") {
      const prov = state.cable.provider;
      const card = document.getElementById("cable-card").value.trim();
      const sel  = document.getElementById("cable-plans");
      const opt  = sel.selectedOptions[0];
      if (prov && card && sel.value) {
        setText("cable-s-prov",   provLabels[prov] || prov);
        setText("cable-s-plan",   opt?.dataset.name || sel.options[sel.selectedIndex]?.text || "—");
        setText("cable-s-card",   card);
        setText("cable-s-amount", "₦" + Number(opt?.dataset.amount || 0).toLocaleString("en-NG"));
        s.classList.add("show");
      } else { s.classList.remove("show"); }

    } else if (panel === "internet") {
      const prov  = state.internet.provider;
      const sel   = document.getElementById("inet-plans");
      const opt   = sel.selectedOptions[0];
      const phone = document.getElementById("inet-phone").value.trim();
      if (prov && sel.value && phone) {
        setText("inet-s-prov",   provLabels[prov] || prov);
        setText("inet-s-plan",   opt?.dataset.name || sel.options[sel.selectedIndex]?.text || "—");
        setText("inet-s-phone",  phone);
        setText("inet-s-amount", "₦" + Number(opt?.dataset.amount || 0).toLocaleString("en-NG"));
        s.classList.add("show");
      } else { s.classList.remove("show"); }

    } else if (panel === "education") {
      const prov  = state.education.provider;
      const sel   = document.getElementById("edu-plans");
      const opt   = sel.selectedOptions[0];
      const phone = document.getElementById("edu-phone").value.trim();
      if (prov && sel.value && phone) {
        setText("edu-s-prov",   provLabels[prov] || prov);
        setText("edu-s-plan",   opt?.dataset.name || sel.options[sel.selectedIndex]?.text || "—");
        setText("edu-s-phone",  phone);
        setText("edu-s-amount", "₦" + Number(opt?.dataset.amount || 0).toLocaleString("en-NG"));
        s.classList.add("show");
      } else { s.classList.remove("show"); }
    }
  };

  /* ================= BUILD SUMMARY HTML FOR PIN MODAL ================= */
  function buildPinSummary(panel) {
    const rows = [];

    if (panel === "airtime") {
      rows.push(["Network",  netLabels[state.airtime.net] || state.airtime.net]);
      rows.push(["Phone",    document.getElementById("airtime-phone").value.trim()]);
      rows.push(["Amount",   "₦" + Number(document.getElementById("airtime-amount").value).toLocaleString("en-NG")]);

    } else if (panel === "data") {
      const sel = document.getElementById("data-plans");
      const opt = sel.selectedOptions[0];
      rows.push(["Network", netLabels[state.data.net] || state.data.net]);
      rows.push(["Plan",    opt?.dataset.name || "—"]);
      rows.push(["Phone",   document.getElementById("data-phone").value.trim()]);
      rows.push(["Amount",  "₦" + Number(opt?.dataset.amount || 0).toLocaleString("en-NG")]);

    } else if (panel === "electricity") {
      rows.push(["Provider", provLabels[state.electricity.provider] || state.electricity.provider]);
      rows.push(["Meter",    document.getElementById("elec-meter").value.trim()]);
      rows.push(["Type",     state.electricity.meterType]);
      rows.push(["Amount",   "₦" + Number(document.getElementById("elec-amount").value).toLocaleString("en-NG")]);

    } else if (panel === "cable") {
      const sel = document.getElementById("cable-plans");
      const opt = sel.selectedOptions[0];
      rows.push(["Provider",   provLabels[state.cable.provider] || state.cable.provider]);
      rows.push(["Smart Card", document.getElementById("cable-card").value.trim()]);
      rows.push(["Plan",       opt?.dataset.name || "—"]);
      rows.push(["Amount",     "₦" + Number(opt?.dataset.amount || 0).toLocaleString("en-NG")]);

    } else if (panel === "internet") {
      const sel = document.getElementById("inet-plans");
      const opt = sel.selectedOptions[0];
      rows.push(["Provider", provLabels[state.internet.provider] || state.internet.provider]);
      rows.push(["Plan",     opt?.dataset.name || "—"]);
      rows.push(["Phone",    document.getElementById("inet-phone").value.trim()]);
      rows.push(["Amount",   "₦" + Number(opt?.dataset.amount || 0).toLocaleString("en-NG")]);

    } else if (panel === "education") {
      const sel = document.getElementById("edu-plans");
      const opt = sel.selectedOptions[0];
      rows.push(["Provider", provLabels[state.education.provider] || state.education.provider]);
      rows.push(["Plan",     opt?.dataset.name || "—"]);
      rows.push(["Phone",    document.getElementById("edu-phone").value.trim()]);
      rows.push(["Amount",   "₦" + Number(opt?.dataset.amount || 0).toLocaleString("en-NG")]);
    }

    return `<table class="pin-summary-table">
      ${rows.map(([k, v]) => `<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`).join("")}
    </table>`;
  }

  /* ================= SUBMIT PAYMENT ================= */
  window.submitPayment = async function (panel) {
    let payload  = {};
    let valid    = true;
    let endpoint = "";

    /* ── Build & validate payload ────────────────────────────────── */
    if (panel === "airtime") {
      if (!state.airtime.net) { showErr("airtime-net-error"); valid = false; }
      const phone  = document.getElementById("airtime-phone").value.trim();
      const amount = Number(document.getElementById("airtime-amount").value);
      if (!/^0[789]\d{9}$/.test(phone))            { showFieldErr("airtime-phone");  valid = false; }
      if (!amount || amount < 50 || amount > 50000) { showFieldErr("airtime-amount"); valid = false; }
      if (!valid) return;
      payload  = { serviceId: state.airtime.net, phone, amount, category: "airtime" };
      endpoint = `${API}/pay/airtime`;

    } else if (panel === "data") {
      if (!state.data.net) { showErr("data-net-error"); valid = false; }
      const plans = document.getElementById("data-plans");
      const phone = document.getElementById("data-phone").value.trim();
      if (!plans.value)                 { showErr("data-plans-error");  valid = false; }
      if (!/^0[789]\d{9}$/.test(phone)) { showFieldErr("data-phone");   valid = false; }
      if (!valid) return;
      payload  = { serviceId: state.data.net, variationCode: plans.value, phone, category: "data" };
      endpoint = `${API}/pay/data`;

    } else if (panel === "electricity") {
      if (!state.electricity.provider) { showErr("elec-provider-error"); valid = false; }
      const meter  = document.getElementById("elec-meter").value.trim();
      const phone  = document.getElementById("elec-phone").value.trim();
      const amount = Number(document.getElementById("elec-amount").value);
      if (!meter)                              { showFieldErr("elec-meter");  valid = false; }
      if (!/^0[789]\d{9}$/.test(phone))        { showFieldErr("elec-phone");  valid = false; }
      if (!amount || amount < 1000)            { showFieldErr("elec-amount"); valid = false; }
      if (!valid) return;
      payload  = {
        serviceId: state.electricity.provider, billersCode: meter,
        variationCode: state.electricity.meterType, phone, amount, category: "electricity"
      };
      endpoint = `${API}/pay/electricity`;

    } else if (panel === "cable") {
      if (!state.cable.provider) { showErr("cable-provider-error"); valid = false; }
      const card  = document.getElementById("cable-card").value.trim();
      const plans = document.getElementById("cable-plans");
      const phone = document.getElementById("cable-phone").value.trim();
      if (!card)                               { showFieldErr("cable-card");   valid = false; }
      if (!plans.value)                        { showErr("cable-plans-error"); valid = false; }
      if (!/^0[789]\d{9}$/.test(phone))        { showFieldErr("cable-phone");  valid = false; }
      if (!valid) return;
      payload  = {
        serviceId: state.cable.provider, billersCode: card,
        variationCode: plans.value, phone, category: "cable"
      };
      endpoint = `${API}/pay/cable`;

    } else if (panel === "internet") {
      if (!state.internet.provider) { showErr("inet-provider-error"); valid = false; }
      const plans = document.getElementById("inet-plans");
      const phone = document.getElementById("inet-phone").value.trim();
      if (!plans.value)                 { showErr("inet-plans-error"); valid = false; }
      if (!/^0[789]\d{9}$/.test(phone)) { showFieldErr("inet-phone");  valid = false; }
      if (!valid) return;
      payload  = {
        serviceId: state.internet.provider, variationCode: plans.value,
        phone, category: "data"
      };
      endpoint = `${API}/pay/internet`;

    } else if (panel === "education") {
      if (!state.education.provider) { showErr("edu-provider-error"); valid = false; }
      const plans = document.getElementById("edu-plans");
      const phone = document.getElementById("edu-phone").value.trim();
      if (!plans.value)                 { showErr("edu-plans-error"); valid = false; }
      if (!/^0[789]\d{9}$/.test(phone)) { showFieldErr("edu-phone");  valid = false; }
      if (!valid) return;
      payload  = {
        serviceId: state.education.provider, variationCode: plans.value,
        phone, category: "education"
      };
      endpoint = `${API}/pay/data`;
    }

    /* ── Step 1: Show PIN modal — block until user confirms or cancels ── */
    let pin;
    try {
      pin = await requestPin(buildPinSummary(panel));
    } catch (_) {
      // User cancelled — do nothing, no toast
      return;
    }

    /* ── Step 2: Inject PIN into payload ────────────────────────────── */
    payload.pin = pin;

    /* ── Step 3: Fire the request ───────────────────────────────────── */
    const btn = document.getElementById(panel + "-pay-btn");
    btn.classList.add("loading");
    btn.disabled = true;

    try {
      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: authHeaders,
        body:    JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast("success", "✓ Payment successful!");
        resetPanel(panel);
        fetchWalletBalance();
      } else {
        // Show backend error (e.g. "Invalid PIN", "PIN is locked")
        showToast("error", data.message || "Payment failed. Please try again.");
      }
    } catch (_) {
      showToast("error", "Network error. Please check your connection.");
    } finally {
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  };

  /* ================= RESET PANEL ================= */
  window.resetPanel = function (panel) {
    const p = document.getElementById("panel-" + panel);
    p.querySelectorAll(".network-btn, .provider-btn").forEach(b => b.classList.remove("active"));
    p.querySelectorAll("input").forEach(i  => { i.value = ""; i.classList.remove("error"); });
    p.querySelectorAll(".field-error").forEach(e  => e.classList.remove("show"));
    p.querySelectorAll(".validate-result").forEach(r => r.classList.remove("show"));
    p.querySelectorAll(".summary-section").forEach(s => s.classList.remove("show"));
    p.querySelectorAll("select").forEach(s => s.selectedIndex = 0);
    p.querySelectorAll(".meter-btn").forEach((b, i) => b.classList.toggle("active", i === 0));

    const defaults = {
      airtime:     { net: null },
      data:        { net: null, planAmount: 0 },
      electricity: { provider: null, meterType: "prepaid" },
      cable:       { provider: null, planAmount: 0 },
      internet:    { provider: null, planAmount: 0 },
      education:   { provider: null, planAmount: 0 },
    };
    state[panel] = { ...defaults[panel] };
  };

  /* ================= HELPERS ================= */
  function showFieldErr(id) {
    document.getElementById(id)?.classList.add("error");
    document.getElementById(id + "-error")?.classList.add("show");
  }
  function clearErr(id) {
    document.getElementById(id)?.classList.remove("error");
    document.getElementById(id + "-error")?.classList.remove("show");
  }
  function showErr(id) { document.getElementById(id)?.classList.add("show");    }
  function hideErr(id) { document.getElementById(id)?.classList.remove("show"); }
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

  let toastTimer;
  function showToast(type, msg) {
    const t = document.getElementById("toast");
    document.getElementById("toastMsg").textContent = msg;
    t.className = "toast " + type + " show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 4500);
  }
});
