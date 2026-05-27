/* savingactivity.js */
(function () {
  "use strict";

  /* ─── CONFIG ─── */
  const API_BASE = window.FastPay?.getApiBase() || "http://localhost:8080";
  const PAGE_SIZE = 10;

  const token  = window.FastPay?.getToken() || localStorage.getItem("fastpay_token");
  const userId = window.FastPay?.getUserId() || localStorage.getItem("fastpay_userId");

  if (!token || !userId) {
    alert("Please log in first.");
    window.location.href = window.FastPay?.getLoginPath?.() || "../signup/login.html";
    return;
  }

  const AUTH = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };

  /* ─── TYPE MAPPINGS ───
     Backend TransactionType enum values:
     DEPOSIT, TRANSFER, FUND, WITHDRAW, DEBIT, CREDIT, CONTRIBUTION, BILL_PAYMENT
  ─── */

  // Maps backend type → display category used for filtering/styling
  const TYPE_CATEGORY = {
    CONTRIBUTION: "deposit",   // saving into a plan
    DEPOSIT:      "deposit",
    FUND:         "deposit",   // wallet top-up
    CREDIT:       "deposit",
    WITHDRAW:     "withdrawal",
    DEBIT:        "withdrawal",
    TRANSFER:     "withdrawal",
    BILL_PAYMENT: "withdrawal",
  };

  // Filter button values → backend type categories to match
  const FILTER_MAP = {
    all:        null,           // show everything
    DEPOSIT:    "deposit",      // matches CONTRIBUTION, DEPOSIT, FUND, CREDIT
    WITHDRAWAL: "withdrawal",   // matches WITHDRAW, DEBIT, TRANSFER, BILL_PAYMENT
    INTEREST:   "interest",     // reserved for future interest type
  };

  /* ─── STATE ─── */
  let allTransactions = [];
  let filtered        = [];
  let currentPage     = 1;
  let activeFilter    = "all";

  /* ─── DOM REFS ─── */
  const listEl       = document.getElementById("activityList");
  const skeleton     = document.getElementById("loadingSkeleton");
  const emptyState   = document.getElementById("emptyState");
  const paginationEl = document.getElementById("pagination");
  const pageNumbers  = document.getElementById("pageNumbers");
  const prevBtn      = document.getElementById("prevPage");
  const nextBtn      = document.getElementById("nextPage");
  const searchInput  = document.getElementById("searchInput");
  const modal        = document.getElementById("receiptModal");
  const closeModal   = document.getElementById("closeModal");
  const menuToggle   = document.getElementById("menuToggle");
  const nav          = document.querySelector(".nav");

  /* ─── INIT ─── */
  fetchActivity();

  /* ─── FETCH ─── */
  async function fetchActivity() {
    showSkeleton(true);
    try {
      // FIX 1: correct endpoint is /api/ai/savings/activity (not /api/savings/activity)
      const res  = await fetch(`${API_BASE}/api/ai/savings/activity`, { headers: AUTH });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      allTransactions =
        data?.data?.content ||
        data?.data          ||
        data?.content       ||
        (Array.isArray(data) ? data : []);

      computeStats();
      applyFilters();
    } catch (err) {
      console.error("[activity] fetch failed:", err.message);
      showSkeleton(false);
      showEmpty(true);
    }
  }

  /* ─── STATS ─── */
  function computeStats() {
    let totalSaved = 0;
    let totalInterest = 0;

    allTransactions.forEach(tx => {
      const amt      = parseAmount(tx);
      const category = getCategory(tx);
      // FIX 2: accumulate by mapped category, not raw backend type
      if (category === "deposit")  totalSaved    += amt;
      if (category === "interest") totalInterest += amt;
    });

    setText("statTotalSaved", fmt(totalSaved));
    setText("statInterest",   fmt(totalInterest));
    setText("statCount",      allTransactions.length.toLocaleString());
  }

  /* ─── FILTERS ─── */
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.type;
      currentPage  = 1;
      applyFilters();
    });
  });

  searchInput.addEventListener("input", () => {
    currentPage = 1;
    applyFilters();
  });

  function applyFilters() {
    const q              = searchInput.value.trim().toLowerCase();
    const targetCategory = FILTER_MAP[activeFilter]; // null means "all"

    filtered = allTransactions.filter(tx => {
      // FIX 3: filter by mapped category, not raw type string
      if (targetCategory !== null && getCategory(tx) !== targetCategory) return false;

      if (q) {
        const rawType = (tx.type || tx.transactionType || "").toUpperCase();
        const searchable = [
          rawType,
          getCategory(tx),
          tx.description || "",
          tx.reference   || "",
          String(parseAmount(tx)),
          fmtDate(tx.createdAt || tx.date || tx.timestamp || "")
        ].join(" ").toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      return true;
    });

    showSkeleton(false);
    renderPage();
  }

  /* ─── RENDER ─── */
  function renderPage() {
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const items = filtered.slice(start, start + PAGE_SIZE);

    listEl.innerHTML = "";

    if (filtered.length === 0) {
      showEmpty(true);
      paginationEl.style.display = "none";
      return;
    }

    showEmpty(false);
    listEl.style.display = "block";

    items.forEach((tx, i) => listEl.appendChild(buildItem(tx, i)));
    renderPagination(totalPages);
  }

  function buildItem(tx, index) {
    const category = getCategory(tx);
    const rawType  = (tx.type || tx.transactionType || "").toUpperCase();
    const amount   = parseAmount(tx);
    const dateStr  = fmtDate(tx.createdAt || tx.date || tx.timestamp || "");
    const desc     = tx.description || typeLabel(rawType);
    const status   = (tx.status || "success").toLowerCase();

    const prefix = category === "withdrawal" ? "−" : "+";

    const icon = category === "withdrawal" ? "📤"
               : category === "interest"   ? "✨"
               : "📥";

    const li = document.createElement("li");
    li.className = "activity-item";
    li.style.animationDelay = `${index * 0.05}s`;
    li.innerHTML = `
      <div class="tx-icon ${category}">${icon}</div>
      <div class="tx-info">
        <div class="tx-type">${escHtml(desc)}</div>
        <div class="tx-date">${dateStr}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${category}">${prefix}${fmt(amount)}</div>
        <span class="tx-badge ${badgeClass(status)}">${status}</span>
      </div>
    `;
    li.addEventListener("click", () => openReceipt(tx));
    return li;
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      paginationEl.style.display = "none";
      return;
    }

    paginationEl.style.display = "flex";
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;

    pageNumbers.innerHTML = "";
    pageRange(currentPage, totalPages, 5).forEach(n => {
      const btn = document.createElement("button");
      btn.className = "page-num" + (n === currentPage ? " active" : "");
      btn.textContent = n;
      btn.addEventListener("click", () => { currentPage = n; renderPage(); scrollToList(); });
      pageNumbers.appendChild(btn);
    });
  }

  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) { currentPage--; renderPage(); scrollToList(); }
  });
  nextBtn.addEventListener("click", () => {
    const total = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage < total) { currentPage++; renderPage(); scrollToList(); }
  });

  /* ─── RECEIPT MODAL ─── */
  function openReceipt(tx) {
    const rawType  = (tx.type || tx.transactionType || "").toUpperCase();
    const category = getCategory(tx);
    const amount   = parseAmount(tx);
    const status   = (tx.status || "success").toLowerCase();
    const date     = fmtDate(tx.createdAt || tx.date || tx.timestamp || "");

    const icon = category === "withdrawal" ? "📤"
               : category === "interest"   ? "✨"
               : "📥";

    document.getElementById("receiptIcon").textContent      = icon;
    document.getElementById("receiptStatus").textContent    = status.charAt(0).toUpperCase() + status.slice(1);
    document.getElementById("receiptStatus").className      = "receipt-status " + badgeClass(status);
    document.getElementById("receiptAmount").textContent    = fmt(amount);
    document.getElementById("receiptDateLabel").textContent = date;

    const rows = [
      { label: "Type",        value: typeLabel(rawType) },
      { label: "Reference",   value: tx.reference || tx.id || "N/A" },
      { label: "Description", value: tx.description || "—" },
      { label: "Date",        value: date },
      { label: "Status",      value: status.charAt(0).toUpperCase() + status.slice(1) },
    ];

    document.getElementById("receiptBody").innerHTML = rows.map(r => `
      <div class="receipt-row">
        <span class="receipt-row-label">${r.label}</span>
        <span class="receipt-row-value">${escHtml(String(r.value))}</span>
      </div>
    `).join("");

    modal.style.display = "grid";
    document.body.style.overflow = "hidden";
  }

  closeModal.addEventListener("click", closeReceiptModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeReceiptModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeReceiptModal(); });

  function closeReceiptModal() {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }

  /* ─── MOBILE NAV ─── */
  if (menuToggle) {
    menuToggle.addEventListener("click", () => nav.classList.toggle("open"));
  }

  /* ─── HELPERS ─── */

  // Resolves a backend TransactionType → display category
  function getCategory(tx) {
    const raw = (tx.type || tx.transactionType || "").toUpperCase();
    return TYPE_CATEGORY[raw] || "deposit";
  }

  function showSkeleton(show) {
    skeleton.style.display = show ? "block" : "none";
    listEl.style.display   = show ? "none"  : "block";
  }

  function showEmpty(show) {
    emptyState.style.display = show ? "block" : "none";
    listEl.style.display     = show ? "none"  : "block";
  }

  function parseAmount(tx) {
    return Number(tx.amount || tx.transactionAmount || 0);
  }

  function fmt(n) {
    return "₦" + Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  }

  function fmtDate(raw) {
    if (!raw) return "—";
    try {
      return new Intl.DateTimeFormat("en-NG", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      }).format(new Date(raw));
    } catch { return String(raw); }
  }

  function typeLabel(rawType) {
    const map = {
      CONTRIBUTION: "Savings Deposit",
      DEPOSIT:      "Deposit",
      FUND:         "Wallet Funding",
      CREDIT:       "Credit",
      WITHDRAW:     "Withdrawal",
      DEBIT:        "Debit",
      TRANSFER:     "Transfer",
      BILL_PAYMENT: "Bill Payment",
    };
    return map[rawType] || (rawType.charAt(0) + rawType.slice(1).toLowerCase().replace(/_/g, " "));
  }

  function badgeClass(status) {
    if (status === "success"  || status === "completed")  return "badge-success";
    if (status === "pending"  || status === "processing") return "badge-pending";
    if (status === "failed"   || status === "error")      return "badge-failed";
    return "badge-success";
  }

  function setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  function escHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function scrollToList() {
    document.querySelector(".savings-activity")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pageRange(current, total, maxVisible) {
    if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i + 1);
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end   = start + maxVisible - 1;
    if (end > total) { end = total; start = Math.max(1, end - maxVisible + 1); }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

})();
