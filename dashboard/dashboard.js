document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.FastPay?.getApiBase() || "http://localhost:8080";
  const token = window.FastPay?.getToken() || localStorage.getItem("fastpay_token");
  const userId = window.FastPay?.getUserId() || localStorage.getItem("fastpay_userId");
  const NAIRA = "\u20A6";

  if (!token || !userId) {
    alert("You must login first.");
    window.location.href = window.FastPay?.getLoginPath?.() || "../signup/login.html";
    return;
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };

  const balanceEl = document.getElementById("balance");
  const growthEl = document.querySelector(".growth-text");
  const balanceToggleBtn = document.querySelector(".balance-toggle");
  const balanceAmountEl = document.getElementById("balance");
  const interestEl = document.getElementById("interest");
  const activityList = document.getElementById("activityList");
  const activityEmptyState = document.getElementById("activityEmptyState");
  const themeBtn = document.getElementById("themeToggle");
  const currentDateEl = document.getElementById("currentDate");
  const welcomeNameEl = document.querySelector(".welcome-title .highlight");
  const ctx = document.getElementById("savingsChart")?.getContext("2d");

  let chart;
  let tickerInterval;
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let hasMoved = false;
  let balanceVisible = true;
  let actualBalance = formatCurrency(0);
  let actualInterest = `${NAIRA}0`;

  function formatCurrency(value) {
    return `${NAIRA}${Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function formatCurrencyCompact(value) {
    return `${NAIRA}${Number(value || 0).toLocaleString("en-NG")}`;
  }

  function animateNumber(el, start, end, duration = 1000) {
    if (!el) return;
    const startTime = performance.now();

    function animate(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = start + (end - start) * progress;
      el.textContent = formatCurrency(value);
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  function animatePercentage(el, start, end, duration = 1000) {
    if (!el) return;
    const startTime = performance.now();

    function animate(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = start + (end - start) * progress;
      el.textContent = `${value.toFixed(1)}%`;
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  function initializeDashboardHeader() {
    if (currentDateEl) {
      currentDateEl.textContent = new Date().toLocaleDateString("en-NG", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    }

    const savedName =
      localStorage.getItem("fastpay_user_name") ||
      localStorage.getItem("fastpay_name") ||
      localStorage.getItem("userName") ||
      "User";

    if (welcomeNameEl) {
      welcomeNameEl.textContent = savedName.split(" ")[0];
    }
  }

  async function loadWalletBalance() {
    try {
      const [balanceRes, savingsRes] = await Promise.all([
        fetch(`${API_BASE}/wallet/balance`, { headers }),
        fetch(`${API_BASE}/wallet/savings/balance`, { headers })
      ]);

      if (!balanceRes.ok || !savingsRes.ok) {
        throw new Error("Failed to fetch balance");
      }

      const balance = Number(await balanceRes.json()) || 0;
      const savingsData = await savingsRes.json();
      const interestEarned = Number(savingsData?.interestEarned || 0);

      if (balanceEl) animateNumber(balanceEl, 0, balance);
      if (interestEl) animateNumber(interestEl, 0, interestEarned);
      if (growthEl) growthEl.textContent = "Interest earned from savings";
    } catch (err) {
      console.error("Error loading wallet balance:", err);
      if (balanceEl) balanceEl.textContent = formatCurrency(0);
      if (interestEl) interestEl.textContent = formatCurrency(0);
      if (growthEl) growthEl.textContent = "No interest earned yet";
    }
  }

  async function loadTransactions() {
    const txBody = document.querySelector(".transactions-container tbody");
    if (!txBody) return;

    try {
      const res = await fetch(`${API_BASE}/wallet/transactions`, { headers });
      if (!res.ok) throw new Error("Failed to fetch transactions");

      const txs = await res.json();
      if (!txs || txs.length === 0) {
        txBody.innerHTML = `<tr><td colspan="4">No transactions available</td></tr>`;
        return;
      }

      txBody.innerHTML = txs.map((tx) => {
        const date = new Date(tx.createdAt).toLocaleDateString("en-NG", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        });
        const amount = Number(tx.amount || 0);
        const isDebit = tx.type === "DEBIT" ||
          tx.type === "SAVINGS_WITHDRAWAL" ||
          tx.type === "CONTRIBUTION";

        return `
          <tr>
            <td>${date}</td>
            <td>${tx.type}</td>
            <td class="${isDebit ? "debit" : "credit"}">
              ${isDebit ? "-" : "+"} ${formatCurrency(amount)}
            </td>
            <td><span class="status-badge ${tx.status.toLowerCase()}">${tx.status}</span></td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.error("Error loading transactions:", err);
      txBody.innerHTML = `<tr><td colspan="4">Failed to load transactions</td></tr>`;
    }
  }

  function initializeBalanceToggle() {
    balanceToggleBtn?.addEventListener("click", () => {
      balanceVisible = !balanceVisible;

      if (!balanceVisible) {
        actualBalance = balanceAmountEl?.textContent || formatCurrency(0);
        actualInterest = interestEl?.textContent || `${NAIRA}0`;

        if (balanceAmountEl) balanceAmountEl.textContent = `${NAIRA} ******`;
        if (interestEl) interestEl.textContent = "****";
        balanceToggleBtn.querySelector(".eye-icon").textContent = "S";
        return;
      }

      if (balanceAmountEl) balanceAmountEl.textContent = actualBalance;
      if (interestEl) interestEl.textContent = actualInterest;
      balanceToggleBtn.querySelector(".eye-icon").textContent = "H";
    });
  }

  function initializeThemeToggle() {
    if (!themeBtn) return;

    const syncThemeIcon = () => {
      const isLight = document.body.classList.contains("light");
      const icon = themeBtn.querySelector(".theme-icon");
      if (icon) icon.textContent = isLight ? "D" : "L";
    };

    syncThemeIcon();

    themeBtn.addEventListener("click", () => {
      const isLight = document.body.classList.contains("light");
      const nextTheme = isLight ? "dark" : "light";
      window.FastPay?.applyTheme?.(nextTheme);
      window.localStorage?.setItem("fastpay_theme", nextTheme);
      syncThemeIcon();
    });
  }

  async function loadAIChart(range = "weekly") {
    if (!ctx) return;

    try {
      const res = await fetch(`${API_BASE}/api/ai/savings-projection`, {
        method: "POST",
        headers,
        body: JSON.stringify({ range })
      });

      if (!res.ok) throw new Error("Failed to fetch AI savings projection");

      const result = await res.json();
      const labels = result?.chartData?.labels || [];
      const data = result?.chartData?.data || [];

      const xAxisTitle =
        range === "yearly" ? "Month" :
        range === "monthly" ? "Date" : "Day";

      const dataset = {
        label: `AI Savings Projection (${NAIRA})`,
        data,
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: false,
        backgroundColor: "rgba(99, 102, 241, 0.18)",
        borderColor: "rgba(129, 140, 248, 1)",
        pointBackgroundColor: "rgba(251, 191, 36, 1)",
        pointBorderColor: "#fff"
      };

      if (!chart) {
        chart = new Chart(ctx, {
          type: "line",
          data: { labels, datasets: [dataset] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1000 },
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => formatCurrencyCompact(context.raw)
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: "rgba(148, 163, 184, 0.14)" },
                ticks: {
                  color: "#94a3b8",
                  callback: (value) => formatCurrencyCompact(value)
                }
              },
              x: {
                grid: { display: false },
                ticks: { color: "#94a3b8" },
                title: {
                  display: true,
                  text: xAxisTitle,
                  color: "#94a3b8"
                }
              }
            }
          }
        });
      } else {
        chart.data.labels = labels;
        chart.data.datasets[0] = dataset;
        chart.options.scales.x.title.text = xAxisTitle;
        chart.update();
      }
    } catch (err) {
      console.warn("AI chart unavailable", err);
    }
  }

  function initializeChartFilters() {
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach((item) => item.classList.remove("active"));
        btn.classList.add("active");
        loadAIChart(btn.dataset.period || "weekly");
      });
    });
  }

  function getTransactionBadge(type) {
    const normalized = String(type || "").toUpperCase();

    if (["DEPOSIT", "FUND", "CREDIT", "TRANSFER_IN", "REFUND"].includes(normalized)) {
      return "IN";
    }

    if (["TRANSFER", "DEBIT", "WITHDRAW", "SAVINGS_WITHDRAWAL", "BILL_PAYMENT"].includes(normalized)) {
      return "OUT";
    }

    if (["CONTRIBUTION", "SAVINGS_DEPOSIT", "SAVINGS_CREATION"].includes(normalized)) {
      return "SAVE";
    }

    return "TXN";
  }

  function getTransactionTitle(activity) {
    const normalized = String(activity?.type || "").toUpperCase();

    switch (normalized) {
      case "DEPOSIT":
      case "FUND":
      case "CREDIT":
        return "Wallet deposit";
      case "TRANSFER":
        return "Transfer sent";
      case "TRANSFER_IN":
        return "Transfer received";
      case "WITHDRAW":
        return "Wallet withdrawal";
      case "BILL_PAYMENT":
        return "Bill payment";
      case "CONTRIBUTION":
      case "SAVINGS_DEPOSIT":
        return activity?.savingsName || "Savings deposit";
      case "SAVINGS_CREATION":
        return activity?.savingsName || "Savings plan created";
      case "SAVINGS_WITHDRAWAL":
        return activity?.savingsName || "Savings withdrawal";
      case "REFUND":
        return "Refund received";
      default:
        return activity?.savingsName || activity?.type || "Transaction";
    }
  }

  async function loadRecentActivity() {
    if (!activityList) return;

    try {
      const res = await fetch(`${API_BASE}/wallet/transactions`, { headers });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      renderRecentActivity(await res.json());
    } catch (err) {
      console.warn("Recent activity unavailable", err);
      renderRecentActivity([]);
    }
  }

  function renderRecentActivity(activities) {
    activityList.innerHTML = "";
    if (tickerInterval) clearInterval(tickerInterval);
    activityList.style.transform = "translateY(0)";

    if (!activities.length) {
      activityEmptyState?.classList.remove("hidden");
      return;
    }

    activityEmptyState?.classList.add("hidden");

    activities
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8)
      .forEach((activity) => {
        const badge = getTransactionBadge(activity?.type);
        const time = new Date(activity.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        });
        const title = getTransactionTitle(activity);
        const status = activity?.status ? ` | ${activity.status}` : "";

        const li = document.createElement("li");
        li.className = "activity-item";
        li.innerHTML = `
          <div class="activity-icon">${badge}</div>
          <div class="activity-content">
            <div class="activity-title">${title}</div>
            <div class="activity-meta">${formatCurrencyCompact(activity.amount)} | ${time}${status}</div>
          </div>
          <div class="activity-arrow">></div>
        `;
        li.addEventListener("click", () => {
          window.location.href = "wallet.html";
        });
        activityList.appendChild(li);
      });

    startTicker();
  }

  function startTicker() {
    const items = activityList.querySelectorAll("li");
    if (items.length <= 1) return;

    const height = items[0].offsetHeight + 8;
    let index = 0;

    tickerInterval = setInterval(() => {
      index += 1;
      activityList.style.transition = "transform 0.5s ease";
      activityList.style.transform = `translateY(-${index * height}px)`;

      if (index >= items.length) {
        setTimeout(() => {
          activityList.style.transition = "none";
          activityList.style.transform = "translateY(0)";
          index = 0;
        }, 500);
      }
    }, 3200);
  }

  function calculateSavingsRate(transactions) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const toNumber = (value) => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };

    const monthly = transactions.filter((tx) => {
      const d = new Date(tx.createdAt);
      return tx &&
        tx.status === "SUCCESS" &&
        d.getMonth() === currentMonth &&
        d.getFullYear() === currentYear;
    });

    const incomeTypes = new Set(["FUND", "CREDIT", "DEPOSIT", "TRANSFER_IN", "REFUND"]);
    const savingsTypes = new Set(["CONTRIBUTION", "SAVINGS_DEPOSIT", "SAVINGS_CREATION"]);
    const savingsWithdrawalTypes = new Set(["SAVINGS_WITHDRAWAL"]);
    const expenseTypes = new Set(["BILL_PAYMENT", "DEBIT", "TRANSFER", "WITHDRAW"]);

    const income = monthly
      .filter((tx) => incomeTypes.has(tx.type))
      .reduce((sum, tx) => sum + toNumber(tx.amount), 0);

    const contributions = monthly
      .filter((tx) => savingsTypes.has(tx.type))
      .reduce((sum, tx) => sum + toNumber(tx.amount), 0);

    const savingsWithdrawals = monthly
      .filter((tx) => savingsWithdrawalTypes.has(tx.type))
      .reduce((sum, tx) => sum + toNumber(tx.amount), 0);

    const spent = monthly
      .filter((tx) => expenseTypes.has(tx.type))
      .reduce((sum, tx) => sum + toNumber(tx.amount), 0);

    const netSavings = contributions - savingsWithdrawals;
    let rate = 0;

    if (income > 0) {
      rate = (Math.max(netSavings, 0) / income) * 100;
    } else if (netSavings > 0 && contributions + spent > 0) {
      rate = (netSavings / (contributions + spent)) * 100;
    }

    return {
      rate: Number(rate.toFixed(1)),
      income,
      contributions,
      withdrawals: savingsWithdrawals,
      netSavings,
      spent
    };
  }

  async function loadStats() {
    const totalSavingsEl = document.getElementById("totalSavings");
    const transactionCountEl = document.getElementById("transactionCount");
    const savingsRateEl = document.getElementById("savingsRate");
    const activeGoalsEl = document.getElementById("activeGoals");

    try {
      const [savingsResponse, transactionsResponse] = await Promise.all([
        fetch(`${API_BASE}/wallet/savings/balance`, { headers }),
        fetch(`${API_BASE}/wallet/transactions`, { headers })
      ]);

      if (!savingsResponse.ok || !transactionsResponse.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const savings = await savingsResponse.json();
      const transactions = await transactionsResponse.json();
      const totalSavings = Number(savings.totalSavings || 0);

      if (totalSavingsEl) {
        totalSavings > 0
          ? animateNumber(totalSavingsEl, 0, totalSavings)
          : (totalSavingsEl.textContent = formatCurrency(0));
      }

      if (transactionCountEl) {
        transactionCountEl.textContent = String(transactions?.length || 0);
      }

      if (activeGoalsEl) {
        activeGoalsEl.textContent = String(savings.activeCount || 0);
      }

      if (savingsRateEl) {
        const rateData = calculateSavingsRate(transactions || []);
        rateData.rate > 0
          ? animatePercentage(savingsRateEl, 0, rateData.rate)
          : (savingsRateEl.textContent = "0.0%");
      }
    } catch (err) {
      console.error("Error loading dashboard stats:", err);
      if (totalSavingsEl) totalSavingsEl.textContent = formatCurrency(0);
      if (transactionCountEl) transactionCountEl.textContent = "0";
      if (savingsRateEl) savingsRateEl.textContent = "0.0%";
      if (activeGoalsEl) activeGoalsEl.textContent = "0";
    }
  }

  function initializeAiBot() {
    const aiBot = document.getElementById("aiBot");
    if (!aiBot) return;

    aiBot.addEventListener("mousedown", (event) => {
      dragging = true;
      hasMoved = false;
      offsetX = event.clientX - aiBot.offsetLeft;
      offsetY = event.clientY - aiBot.offsetTop;
    });

    document.addEventListener("mousemove", (event) => {
      if (!dragging) return;
      hasMoved = true;
      aiBot.style.left = `${event.clientX - offsetX}px`;
      aiBot.style.top = `${event.clientY - offsetY}px`;
      aiBot.style.right = "auto";
      aiBot.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
      dragging = false;
    });

    aiBot.addEventListener("click", () => {
      if (!hasMoved) {
        window.location.href = "ai.html";
      }
    });
  }

  initializeDashboardHeader();
  initializeBalanceToggle();
  initializeThemeToggle();
  initializeChartFilters();
  initializeAiBot();
  loadWalletBalance();
  loadTransactions();
  loadAIChart("weekly");
  loadRecentActivity();
  loadStats();
});
