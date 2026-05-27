const CONFIG = {
  API_BASE: window.FastPay?.getApiBase() || "http://localhost:8080",
  DEBUG_MODE: true
};

const token = window.FastPay?.getToken() || localStorage.getItem("fastpay_token");
const userId = window.FastPay?.getUserId() || localStorage.getItem("fastpay_userId");
const NAIRA = "\u20A6";

if (!token || !userId) {
  alert("You must login first.");
  window.location.href = window.FastPay?.getLoginPath?.() || "../signup/login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`
};

const elements = {
  chatWindow: document.getElementById("chatWindow"),
  chatInput: document.getElementById("chatInput"),
  sendBtn: document.getElementById("sendBtn"),
  suggestions: document.getElementById("suggestions"),
  quickActions: document.getElementById("quickActions"),
  fallbackNotice: document.getElementById("fallbackNotice")
};

const state = {
  chatHistory: [],
  isProcessing: false
};

const log = {
  info: (...args) => CONFIG.DEBUG_MODE && console.log("[INFO]", ...args),
  success: (...args) => CONFIG.DEBUG_MODE && console.log("[OK]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
  warn: (...args) => CONFIG.DEBUG_MODE && console.warn("[WARN]", ...args)
};

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRichText(text = "") {
  return escapeHtml(text)
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>");
}

function formatCurrency(value) {
  return `${NAIRA}${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function showFallbackNotice(active) {
  if (!elements.fallbackNotice) return;
  elements.fallbackNotice.classList.toggle("active", active);
}

function addMessage(text, sender, metadata = {}) {
  if (!elements.chatWindow) return;

  const emptyState = elements.chatWindow.querySelector(".empty-chat");
  if (emptyState) emptyState.remove();

  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${sender}`;

  const providerBadge = sender === "ai" && metadata.provider
    ? `<span class="provider-badge">${escapeHtml(metadata.provider)}</span>`
    : "";

  const avatarLabel = sender === "user" ? "YOU" : "AI";

  messageDiv.innerHTML = `
    <div class="message-avatar ${sender}-avatar">${avatarLabel}</div>
    <div class="message-wrapper">
      <div class="message-content">${formatRichText(text)}</div>
      ${providerBadge}
      <div class="message-time">${new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })}</div>
    </div>
  `;

  elements.chatWindow.appendChild(messageDiv);
  elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
  state.chatHistory.push({ sender, text, timestamp: Date.now(), ...metadata });

  if (sender === "user") {
    if (elements.suggestions) elements.suggestions.style.display = "none";
    if (elements.quickActions) elements.quickActions.style.display = "flex";
  }
}

function showTypingIndicator(provider = "Groq") {
  removeTypingIndicator();
  if (!elements.chatWindow) return;

  const div = document.createElement("div");
  div.id = "typing";
  div.className = "chat-message ai typing-indicator";
  div.innerHTML = `
    <div class="message-avatar ai-avatar">AI</div>
    <div class="message-wrapper">
      <div class="message-content">
        <span class="typing-dots"><span></span><span></span><span></span></span>
        <small>${escapeHtml(provider)} is thinking...</small>
      </div>
    </div>
  `;

  elements.chatWindow.appendChild(div);
  elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
}

function removeTypingIndicator() {
  const typing = document.getElementById("typing");
  if (typing) typing.remove();
}

function detectIntent(message) {
  const lower = message.toLowerCase().trim();

  if (lower.match(/^(show|what'?s?|check|my|get)\s+(my\s+)?balance/i)) return "BALANCE";
  if (lower.match(/^(show|my|check|get)\s+(my\s+)?savings?/i)) return "SAVINGS";
  if (lower.match(/^(show|my|check|get)\s+(my\s+)?(transaction|history)/i)) return "HISTORY";
  if (lower.match(/^(show|my|get)\s+(my\s+)?(financial\s+)?insights?/i)) return "INSIGHTS";

  const exactMatches = {
    balance: "BALANCE",
    "my balance": "BALANCE",
    "wallet balance": "BALANCE",
    savings: "SAVINGS",
    "my savings": "SAVINGS",
    "show savings": "SAVINGS",
    transactions: "HISTORY",
    history: "HISTORY",
    "transaction history": "HISTORY",
    insights: "INSIGHTS",
    "financial insights": "INSIGHTS"
  };

  return exactMatches[lower] || "AI";
}

async function sendMessage(message) {
  if (!message || !message.trim() || state.isProcessing) return;

  state.isProcessing = true;
  const userMessage = message.trim();
  addMessage(userMessage, "user");
  if (elements.chatInput) elements.chatInput.value = "";

  const intent = detectIntent(userMessage);
  log.info("Intent:", intent);

  try {
    switch (intent) {
      case "BALANCE":
        showTypingIndicator("FastPay");
        await fetchBalance();
        break;
      case "SAVINGS":
        showTypingIndicator("FastPay");
        await fetchSavings();
        break;
      case "HISTORY":
        showTypingIndicator("FastPay");
        await fetchTransactions();
        break;
      case "INSIGHTS":
        showTypingIndicator("AI Advisor");
        await fetchInsights();
        break;
      default:
        await sendToAI(userMessage);
        break;
    }
  } catch (err) {
    log.error("Message send error:", err);
    removeTypingIndicator();
    addMessage("Something went wrong. Please try again.", "ai", { provider: "FastPay" });
  } finally {
    state.isProcessing = false;
  }
}

async function sendToAI(message) {
  showTypingIndicator("Groq");
  showFallbackNotice(false);

  try {
    const response = await callGroqAI(message);
    removeTypingIndicator();
    addMessage(response.answer, "ai", { provider: response.provider || "Groq" });
  } catch (err) {
    log.error("Groq error:", err.message);
    removeTypingIndicator();
    showFallbackNotice(true);
    addMessage(
      "AI service is temporarily unavailable.\n\nYou can still ask me to check your balance, savings, transaction history, or financial insights.",
      "ai",
      { provider: "FastPay" }
    );
  }
}

async function callGroqAI(message) {
  const response = await fetch(`${CONFIG.API_BASE}/api/ai/groq-financial`, {
    method: "POST",
    headers,
    body: JSON.stringify({ question: message })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.answer) throw new Error("No answer in response");

  return {
    answer: data.answer,
    provider: data.provider || "Groq"
  };
}

async function fetchBalance() {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/wallet/balance`, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const balance = await response.json();
    removeTypingIndicator();
    addMessage(`**Your Wallet Balance**\n\n${formatCurrency(balance)}`, "ai", { provider: "FastPay" });
  } catch (err) {
    log.error("Balance error:", err);
    removeTypingIndicator();
    addMessage("Unable to fetch your balance right now. Please try again later.", "ai", { provider: "FastPay" });
  }
}

async function fetchSavings() {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/wallet/savings/activity`, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    removeTypingIndicator();

    if (!data || data.length === 0) {
      addMessage("You do not have any active savings yet.\n\nWould you like help creating a savings plan?", "ai", { provider: "FastPay" });
      return;
    }

    let totalSavings = 0;
    let msg = "**Your Savings**\n\n";

    data.forEach((item) => {
      const amount = Number(item.amount || 0);
      totalSavings += amount;
      msg += `• **${item.savingsName || "Savings"}**: ${formatCurrency(amount)} _(${item.status || "Active"})_\n`;
    });

    msg += `\n**Total Savings**: ${formatCurrency(totalSavings)}`;
    addMessage(msg, "ai", { provider: "FastPay" });
  } catch (err) {
    log.error("Savings error:", err);
    removeTypingIndicator();
    addMessage("Unable to fetch your savings right now. Please try again later.", "ai", { provider: "FastPay" });
  }
}

async function fetchTransactions() {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/wallet/transactions`, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    removeTypingIndicator();

    if (!data || data.length === 0) {
      addMessage("No transactions found.\n\nYour transaction history will appear here once you start using your wallet.", "ai", { provider: "FastPay" });
      return;
    }

    let msg = "**Recent Transactions**\n\n";

    data.slice(0, 5).forEach((tx) => {
      const amount = Number(tx.amount || 0);
      const date = new Date(tx.createdAt).toLocaleDateString("en-NG");
      msg += `• **${tx.type || "Transaction"}**: ${formatCurrency(amount)}\n  _${date}_\n\n`;
    });

    addMessage(msg.trim(), "ai", { provider: "FastPay" });
  } catch (err) {
    log.error("Transactions error:", err);
    removeTypingIndicator();
    addMessage("Unable to fetch transactions right now. Please try again later.", "ai", { provider: "FastPay" });
  }
}

async function fetchInsights() {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/api/ai/insights`, {
      method: "POST",
      headers
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    removeTypingIndicator();

    const balance = formatCurrency(data?.metrics?.balance || 0);
    const savings = formatCurrency(data?.metrics?.totalSavings || 0);

    let msg = "**Your Financial Insights**\n\n";
    msg += `${data.insights || "No insights are available right now."}\n\n`;
    msg += "**Quick Stats**\n";
    msg += `• Balance: ${balance}\n`;
    msg += `• Total Savings: ${savings}\n`;
    msg += `• Savings Rate: ${(data?.metrics?.savingsRate || 0).toFixed(1)}%\n`;
    msg += `• Transactions: ${data?.metrics?.transactionCount || 0}`;

    addMessage(msg, "ai", { provider: "AI Advisor" });
  } catch (err) {
    log.error("Insights error:", err);
    removeTypingIndicator();
    addMessage("Unable to generate financial insights right now. Please try again later.", "ai", { provider: "FastPay" });
  }
}

function autoResizeInput() {
  if (!elements.chatInput) return;
  elements.chatInput.style.height = "auto";
  elements.chatInput.style.height = `${Math.min(elements.chatInput.scrollHeight, 160)}px`;
}

function initializeEventListeners() {
  elements.sendBtn?.addEventListener("click", () => {
    sendMessage(elements.chatInput?.value || "");
  });

  elements.chatInput?.addEventListener("input", autoResizeInput);

  elements.chatInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(elements.chatInput?.value || "");
    }
  });

  document.querySelectorAll(".quick-action-chip, .suggestion-card").forEach((el) => {
    el.addEventListener("click", () => {
      sendMessage(el.dataset.prompt || el.textContent.trim());
    });
  });
}

function initialize() {
  log.info("FastPay AI Chat Initialized");
  initializeEventListeners();
  autoResizeInput();

  addMessage(
    "Hello! I am your FastPay AI assistant powered by Groq.\n\nI can help you with:\n• Financial advice and savings tips\n• Checking your balance and savings\n• Viewing transactions\n• Personalized financial insights\n\nWhat would you like to know?",
    "ai",
    { provider: "Groq" }
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
