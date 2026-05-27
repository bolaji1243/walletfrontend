document.addEventListener("DOMContentLoaded", () => {
  const token = window.FastPay?.getToken() || localStorage.getItem("fastpay_token");
  if (!token) {
    alert("You must login first");
    window.location.href = window.FastPay?.getLoginPath?.() || "../signup/login.html";
    return;
  }

  const API = `${window.FastPay?.getApiBase?.() || "http://localhost:8080"}/wallet/savings`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const totalSavingsEl = document.getElementById("totalSavings");
  const savingsCardsEl = document.getElementById("savingsCards");
  const emptySavingsEl = document.getElementById("emptySavings");
  const historyEl = document.getElementById("historyList");
  const emptyActivityEl = document.getElementById("emptyActivity");
  const activeSavingsEl = document.getElementById("activeSavingsCount");
  const lockedSavingsEl = document.getElementById("lockedSavingsCount");
  const interestEarnedEl = document.getElementById("interestEarned");
  const savingsCountEl = document.getElementById("savingsCount");

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString("en-NG", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "";

  const prettifyText = (value = "") =>
    value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  function animateNumber(el, start, end, duration = 1000) {
    if (!el) return;
    const startTime = performance.now();

    function animate(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = start + (end - start) * progress;
      el.textContent = `₦${value.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  function animateCount(el, start, end, duration = 800) {
    if (!el) return;
    const startTime = performance.now();

    function animate(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      el.textContent = Math.round(start + (end - start) * progress);
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  function animateNumberWithPrefix(el, start, end, prefix = "", duration = 1000) {
    if (!el) return;
    const startTime = performance.now();

    function animate(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = start + (end - start) * progress;
      el.textContent = `${prefix}₦${value.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  function getSavingsTypeLabel(type) {
    return type === "FIXED" ? "Fixed Savings" : "Flexible Savings";
  }

  function getActivityMeta(item) {
    const map = {
      CONTRIBUTION: { label: "Contribution", icon: "inflow", direction: "inflow" },
      FUND: { label: "Wallet Funding", icon: "wallet", direction: "inflow" },
      CREDIT: { label: "Credit", icon: "wallet", direction: "inflow" },
      DEPOSIT: { label: "Deposit", icon: "wallet", direction: "inflow" },
      WITHDRAW: { label: "Withdrawal", icon: "outflow", direction: "outflow" },
      SAVINGS_WITHDRAWAL: { label: "Savings Withdrawal", icon: "outflow", direction: "outflow" },
      BILL_PAYMENT: { label: "Bill Payment", icon: "bill", direction: "outflow" },
    };

    const base = map[item.type] || {
      label: prettifyText(item.type || "Transaction"),
      icon: "wallet",
      direction: "neutral",
    };

    return {
      ...base,
      statusLabel: prettifyText(item.status || "Pending"),
    };
  }

  async function loadSavingsBalances() {
    try {
      const [balanceRes, savingsRes] = await Promise.all([
        fetch(`${API}/balance`, { headers }),
        fetch(API, { headers }),
      ]);

      if (!balanceRes.ok || !savingsRes.ok) throw new Error("Failed to load balances");

      const data = await balanceRes.json();
      const allSavings = await savingsRes.json();

      const activeFilteredCount = allSavings.filter(
        (s) => s.status === "ACTIVE" && s.type === "NORMAL" && Number(s.amount) > 0
      ).length;

      const lockedCount = allSavings.filter(
        (s) => s.status === "LOCKED" && s.type === "FIXED"
      ).length;

      const totalSavingsAmount = allSavings.reduce((sum, s) => {
        if (
          (s.status === "ACTIVE" && s.type === "NORMAL" && Number(s.amount) > 0) ||
          (s.status === "LOCKED" && s.type === "FIXED")
        ) {
          return sum + Number(s.amount || 0);
        }
        return sum;
      }, 0);

      const totalCount = activeFilteredCount + lockedCount;

      animateCount(activeSavingsEl, 0, activeFilteredCount);
      animateCount(lockedSavingsEl, 0, lockedCount);
      animateNumber(interestEarnedEl, 0, Number(data.interestEarned || 0));
      animateNumber(totalSavingsEl, 0, totalSavingsAmount);

      if (savingsCountEl) {
        animateCount(savingsCountEl, 0, totalCount);
        setTimeout(() => {
          savingsCountEl.textContent = `${totalCount} Plans`;
        }, 850);
      }
    } catch (err) {
      console.error("Error loading balances:", err);
      if (activeSavingsEl) activeSavingsEl.textContent = "0";
      if (lockedSavingsEl) lockedSavingsEl.textContent = "0";
      if (interestEarnedEl) interestEarnedEl.textContent = "₦0.00";
      if (totalSavingsEl) totalSavingsEl.textContent = "₦0.00";
      if (savingsCountEl) savingsCountEl.textContent = "0 Plans";
    }
  }

  async function loadSavings() {
    savingsCardsEl.innerHTML = "";
    emptySavingsEl.classList.add("hidden");

    try {
      const res = await fetch(API, { headers });
      if (!res.ok) throw new Error("Failed to load savings");

      const savings = await res.json();
      const renderableSavings = savings.filter(
        (s) =>
          (s.status === "ACTIVE" && s.type === "NORMAL" && Number(s.amount) > 0) ||
          (s.status === "LOCKED" && s.type === "FIXED")
      );

      if (!renderableSavings.length) {
        emptySavingsEl.classList.remove("hidden");
        return;
      }

      renderableSavings.forEach(renderSavingsCard);
    } catch (err) {
      console.error("Error loading savings:", err);
      savingsCardsEl.innerHTML = '<div class="activity-loading">Error loading savings</div>';
    }
  }

  function renderSavingsCard(s) {
    const isFixed = s.type === "FIXED";
    const isActive = s.status === "ACTIVE";
    const amount = Number(s.amount || 0);
    const interestRate = Number(s.interestRate || 0);
    const interestValue = Number(s.accruedInterest || 0);
    const purposeLabel = s.purpose ? prettifyText(s.purpose) : "Untitled Savings";
    const maturityDate = isFixed && s.maturityDate ? formatDate(s.maturityDate) : "";
    const card = document.createElement("div");

    card.className = `savings-card ${isFixed ? "fixed-card" : "flex-card"}`;
    card.innerHTML = `
      <div class="card-top">
        <div class="card-type-block">
          <span class="badge ${isFixed ? "locked" : "active"}">${isFixed ? "Locked" : "Active"}</span>
          <p class="card-type">${getSavingsTypeLabel(s.type)}</p>
        </div>
        <div class="card-icon ${isFixed ? "locked" : "active"}">${isFixed ? "FD" : "FL"}</div>
      </div>
      <div class="card-main">
        <h4 class="card-title">${purposeLabel}</h4>
        <p class="card-caption">${isFixed ? "Protected until the maturity date" : "Available for flexible access"}</p>
        <p class="amount-label">Current Balance</p>
        <p class="amount" data-amount="${amount}">₦0.00</p>
      </div>
      <div class="card-metrics">
        <div class="metric-block">
          <span class="metric-label">Interest Rate</span>
          <span class="metric-value">${(interestRate * 100).toFixed(2)}%</span>
        </div>
        <div class="metric-block">
          <span class="metric-label">Interest Earned</span>
          <span class="metric-value interest-earned" data-interest="${interestValue}">₦0.00</span>
        </div>
      </div>
      <div class="card-footer">
        <div class="card-note ${isFixed ? "locked-note" : ""}">
          <span class="note-label">${isFixed ? "Maturity Date" : "Availability"}</span>
          <span class="note-value">${isFixed ? (maturityDate || "Not available") : "Withdraw anytime"}</span>
        </div>
        ${
          isFixed
            ? '<span class="card-action static">Locked</span>'
            : '<button class="mini-btn">Withdraw</button>'
        }
      </div>
    `;

    savingsCardsEl.appendChild(card);

    const amountEl = card.querySelector(".amount");
    const interestEl = card.querySelector(".interest-earned");

    animateNumber(amountEl, 0, amount);
    animateNumberWithPrefix(interestEl, 0, interestValue, "");

    if (isActive && !isFixed) {
      const btn = card.querySelector(".mini-btn");
      if (btn) btn.onclick = () => (window.location.href = `withdraw.html?savingsId=${s.id}`);
    }
  }

  async function loadSavingsActivity() {
    historyEl.innerHTML = '<div class="activity-loading">Loading activity...</div>';
    emptyActivityEl?.classList.remove("show");

    try {
      const res = await fetch(`${API}/activity`, { headers });
      if (!res.ok) throw new Error("Failed to load activity");

      const activity = await res.json();
      const visibleActivity = activity.filter((item) => Number(item.amount) > 0);

      if (!visibleActivity.length) {
        historyEl.innerHTML = "";
        emptyActivityEl?.classList.add("show");
        return;
      }

      historyEl.innerHTML = "";

      visibleActivity.forEach((item) => {
        const meta = getActivityMeta(item);
        const row = document.createElement("div");
        row.className = "history-item";
        row.innerHTML = `
          <div class="history-main">
            <div class="history-icon ${meta.icon}"></div>
            <div class="history-copy">
              <strong>${meta.label}</strong>
              <span class="history-subline">${meta.statusLabel}${item.createdAt ? ` • ${formatDate(item.createdAt)}` : ""}</span>
            </div>
          </div>
          <div class="history-amount ${meta.direction}">
            ₦${formatMoney(item.amount)}
          </div>
        `;
        historyEl.appendChild(row);
      });
    } catch (err) {
      console.error("Error loading activity:", err);
      historyEl.innerHTML = '<div class="activity-loading">Failed to load activity</div>';
    }
  }

  async function init() {
    await Promise.all([loadSavingsBalances(), loadSavings(), loadSavingsActivity()]);
  }

  init();
});
