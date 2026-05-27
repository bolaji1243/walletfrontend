// ================= CONFIGURATION =================
const API_BASE = globalThis.FastPay?.getApiBase() || "http://localhost:8080";
const MIN_DEPOSIT = 100;

// ================= STATE MANAGEMENT =================
let token = null;
let userId = null;
let verificationPoller = null;        // holds setInterval id for polling
const MAX_POLL_ATTEMPTS = 8;          // ~40s total (8 × 5s)
const POLL_INTERVAL_MS  = 5000;

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;

  initializeAmountInput();
  initializeQuickAmounts();
  initializePaymentOptions();
  initializePayButton();
  initializeThemeToggle();
  checkPaymentCallback();
  restorePendingTransaction();        // ← pick up any leftover pending state
});

function checkAuth() {
  token  = globalThis.FastPay?.getToken() || localStorage.getItem("fastpay_token");
  userId = globalThis.FastPay?.getUserId() || localStorage.getItem("fastpay_userId");
  if (!token || !userId) {
    showStatus("You must login first. Redirecting...", 'error');
    setTimeout(() => { globalThis.location.href = globalThis.FastPay?.getLoginPath?.() || "../signup/login.html"; }, 2000);
    return false;
  }
  return true;
}

// ================= AMOUNT INPUT =================
function initializeAmountInput() {
  const amountInput = document.getElementById('amount');
  amountInput.addEventListener('input', (e) => {
    let value = e.target.value.replaceAll(',', '');
    if (!/^\d*$/.test(value)) { e.target.value = value.replaceAll(/\D/g, ''); return; }
    updateSummary(value);
  });
  amountInput.addEventListener('focus', () => {
    amountInput.parentElement.style.transform  = 'scale(1.02)';
    amountInput.parentElement.style.transition = 'transform 0.3s ease';
  });
  amountInput.addEventListener('blur', () => {
    amountInput.parentElement.style.transform = 'scale(1)';
    let value = amountInput.value.replaceAll(',', '');
    if (value) amountInput.value = Number.parseInt(value).toLocaleString();
  });
}

function initializeQuickAmounts() {
  document.querySelectorAll('.quick-amount-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const amount     = e.target.dataset.amount;
      const amountInput = document.getElementById('amount');
      amountInput.value = Number.parseInt(amount).toLocaleString();
      updateSummary(amount);
      btn.style.transform = 'scale(0.95)';
      setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);
      amountInput.focus();
    });
  });
}

function initializePaymentOptions() {
  document.querySelectorAll('.payment-option:not(.disabled)').forEach(option => {
    option.addEventListener('click', (event) => {
      document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      createRipple(option, event);
    });
  });
}

function createRipple(element, event) {
  const ripple = document.createElement('div');
  const rect   = element.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - rect.left - size / 2}px;top:${event.clientY - rect.top - size / 2}px;position:absolute;border-radius:50%;background:rgba(102,126,234,0.3);transform:scale(0);animation:ripple 0.6s ease-out;pointer-events:none;`;
  element.style.position = 'relative';
  element.style.overflow = 'hidden';
  element.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

const style = document.createElement('style');
style.textContent = `
  @keyframes ripple  { to { transform: scale(4); opacity: 0; } }
  @keyframes pulse   { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes shake   { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-10px)} 75%{transform:translateX(10px)} }
`;
document.head.appendChild(style);

function updateSummary(amount) {
  const summaryAmount = document.getElementById('summaryAmount');
  const summaryTotal  = document.getElementById('summaryTotal');
  if (!amount || amount === '0') {
    summaryAmount.textContent = '₦0.00';
    summaryTotal.textContent  = '₦0.00';
    return;
  }
  const numAmount = Number.parseInt(amount.toString().replaceAll(',', ''));
  summaryAmount.textContent = `₦${numAmount.toLocaleString()}`;
  summaryTotal.textContent  = `₦${numAmount.toLocaleString()}`;
}

function initializePayButton() {
  document.getElementById('payBtn').addEventListener('click', initiatePayment);
}

// ================= INITIATE PAYMENT =================
async function initiatePayment() {
  const amountInput = document.getElementById('amount');
  let amount        = Number.parseInt(amountInput.value.replaceAll(',', ''));

  if (!amount || amount < MIN_DEPOSIT) {
    showStatus(`Minimum deposit is ₦${MIN_DEPOSIT.toLocaleString()}`, 'error');
    shakeElement(amountInput);
    return;
  }

  const selectedMethod = document.querySelector('.payment-option.active');
  if (!selectedMethod) { showStatus('Please select a payment method', 'error'); return; }

  if (selectedMethod.dataset.method === 'paystack') {
    await processPaystackPayment(amount);
  } else {
    showStatus('This payment method is coming soon', 'error');
  }
}

// ================= PROCESS PAYSTACK =================
async function processPaystackPayment(amount) {
  showLoading(true);

  try {
    const response = await fetch(`${API_BASE}/wallet/fund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ amount })
    });

    // --- Defensive: read as text first so we can log bad responses ---
    const responseText = await response.text();
    console.log('Raw backend response:', responseText);

    // --- Distinguish failure types ---
    if (response.status === 401 || response.status === 403) {
      handleAuthExpiry();
      return;
    }
    if (response.status === 422 || response.status === 400) {
      const msg = tryParseErrorMessage(responseText) || 'Invalid deposit amount.';
      showStatus(msg, 'error');
      showLoading(false);
      return;
    }
    if (response.status >= 500) {
      showStatus('Our server is temporarily unavailable. Please try again shortly.', 'error');
      showLoading(false);
      return;
    }
    if (!response.ok) {
      const msg = tryParseErrorMessage(responseText) || 'Failed to initialize payment.';
      showStatus(msg, 'error');
      showLoading(false);
      return;
    }

    // --- Defensive JSON parse ---
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.error('Server returned non-JSON:', responseText);
      showStatus('Unexpected server response. Please try again.', 'error');
      showLoading(false);
      throw e;
    }

    // --- Handle all response shapes from Spring Boot global wrapper ---
    const payload     = parsed?.data || parsed;
    const authUrl     = payload?.authorizationUrl || payload?.authorization_url;
    const reference   = payload?.reference;

    console.log('Resolved authUrl:', authUrl, '| reference:', reference);

    if (!authUrl) {
      console.error('Missing authorizationUrl. Full response:', JSON.stringify(parsed, null, 2));
      showStatus('Payment could not be started — no redirect URL received.', 'error');
      showLoading(false);
      return;
    }

    // --- Persist BEFORE redirecting so we can recover on return ---
    if (reference) {
      persistPendingTransaction({ reference, amount, startedAt: Date.now(), status: 'pending' });
    }

    showStatus('Redirecting to Paystack...', 'success');
    setTimeout(() => { globalThis.location.href = authUrl; }, 1000);

  } catch (error) {
    // Network-level failure (no internet, DNS failure, CORS, etc.)
    console.error('Network error during payment init:', error);
    showLoading(false);
    showStatus('Could not reach payment service. Check your connection and try again.', 'error');
  }
}

// ================= PAYMENT CALLBACK HANDLER =================
function checkPaymentCallback() {
  const urlParams = new URLSearchParams(globalThis.location.search);
  const reference = urlParams.get('reference') || urlParams.get('trxref');
  if (!reference) return;

  // Clean URL immediately so refreshing doesn't re-trigger verification
  globalThis.history.replaceState({}, document.title, globalThis.location.pathname);

  showStatus('Verifying your payment, please wait…', 'info');
  verifyPayment(reference, 0);
}

// ================= PENDING TRANSACTION RESTORE =================
function restorePendingTransaction() {
  const pending = loadPendingTransaction();
  if (!pending) return;

  // If it's older than 30 minutes, abandon it
  const AGE_LIMIT_MS = 30 * 60 * 1000;
  if (Date.now() - pending.startedAt > AGE_LIMIT_MS) {
    clearPendingTransaction();
    return;
  }

  // Don't double-verify if checkPaymentCallback already picked it up
  const urlParams = new URLSearchParams(globalThis.location.search);
  if (urlParams.get('reference') || urlParams.get('trxref')) return;

  showPendingBanner(pending.reference, pending.amount);
}

// ================= VERIFY PAYMENT (with retry / polling) =================
async function verifyPayment(reference, attempt) {
  if (attempt === 0) showLoading(true, 'Verifying…');

  try {
    const response = await fetch(`${API_BASE}/wallet/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true'
      }
    });

    // --- Distinguish failure types ---
    if (response.status === 401 || response.status === 403) {
      handleAuthExpiry();
      return;
    }

    // Backend itself down → treat as PENDING, don't say success
    if (response.status >= 500) {
      handleVerificationPending(reference, 'Our server is temporarily unavailable. Your deposit is pending — we\'ll confirm it automatically.');
      return;
    }

    // --- Defensive JSON parse ---
    let parsed;
    try {
      const text = await response.text();
      parsed = JSON.parse(text);
    } catch (e) {
      console.error('Non-JSON verification response');
      handleVerificationPending(reference, 'Verification response was unreadable. Your deposit is pending.');
      throw e;
    }

    const payload = parsed?.data || parsed;
    // Normalise status to uppercase for comparison
    const rawStatus = (payload?.status || payload?.transactionStatus || '').toString().toUpperCase();

    console.log('Verification status:', rawStatus, '| full payload:', payload);

    if (rawStatus === 'SUCCESS') {
      handleVerificationSuccess(reference, payload);
    } else if (rawStatus === 'FAILED' || rawStatus === 'ABANDONED') {
      handleVerificationFailed(rawStatus);
    } else {
      // PENDING or any unknown status — poll if we haven't exhausted attempts
      attempt < MAX_POLL_ATTEMPTS ? scheduleRetry(reference, attempt) : handleVerificationPending(reference, 'Deposit pending – we\'re still checking your transaction. Check back in a few minutes.');
    }

  } catch (error) {
    // Pure network failure during verification
    console.error('Verification network error (attempt', attempt, '):', error);
    if (attempt < MAX_POLL_ATTEMPTS) {
      scheduleRetry(reference, attempt);
    } else {
      handleVerificationPending(reference, 'Could not verify payment (network issue). Your deposit is saved as pending.');
    }
  }
}

// ================= VERIFICATION OUTCOME HANDLERS =================
function handleVerificationSuccess(reference, payload) {
  showLoading(false);
  clearPendingTransaction();
  hidePendingBanner();
  stopPolling();
  const amount = payload?.amount ? `₦${(payload.amount / 100).toLocaleString()}` : '';
  showStatus(`✅ Deposit ${amount} confirmed! Your wallet has been funded.`, 'success');
}

function handleVerificationFailed(status) {
  showLoading(false);
  clearPendingTransaction();
  hidePendingBanner();
  stopPolling();
  const msg = status === 'ABANDONED'
    ? 'Payment was abandoned. No charge was made.'
    : 'Payment failed. Please try again or contact support if you were charged.';
  showStatus(msg, 'error');
}

function handleVerificationPending(reference, message) {
  showLoading(false);
  stopPolling();
  // Ensure the pending transaction is persisted for when user returns
  const existing = loadPendingTransaction();
  if (!existing) persistPendingTransaction({ reference, startedAt: Date.now(), status: 'pending' });
  showStatus(message, 'warning');
  showPendingBanner(reference);
}

function scheduleRetry(reference, attempt) {
  showStatus(`Checking payment status… (attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS})`, 'info');
  verificationPoller = setTimeout(() => verifyPayment(reference, attempt + 1), POLL_INTERVAL_MS);
}

function stopPolling() {
  if (verificationPoller) {
    clearTimeout(verificationPoller);
    verificationPoller = null;
  }
}

// ================= PENDING BANNER UI =================
function showPendingBanner(reference, amount) {
  let banner = document.getElementById('pendingBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'pendingBanner';
    banner.style.cssText = `
      margin:16px 0;padding:14px 18px;border-radius:10px;
      background:#fff8e1;border:1px solid #f9a825;color:#5d4037;
      font-size:14px;line-height:1.5;
    `;
    const container = document.getElementById('depositStatus')?.parentElement || document.body;
    container.insertBefore(banner, container.firstChild);
  }
  const amtText = amount ? ` of ₦${Number.parseInt(amount).toLocaleString()}` : '';
  banner.innerHTML = `
    <strong>⏳ Deposit${amtText} pending</strong><br>
    We're confirming your transaction. This usually takes a few seconds.<br>
    <button onclick="manualRetryVerification('${reference}')"
      style="margin-top:8px;padding:6px 14px;background:#f9a825;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
      🔄 Check Again
    </button>
  `;
  banner.style.display = 'block';
}

function hidePendingBanner() {
  const banner = document.getElementById('pendingBanner');
  if (banner) banner.style.display = 'none';
}

// Called by the "Check Again" button
function manualRetryVerification(reference) {
  stopPolling();
  showStatus('Re-checking your payment…', 'info');
  verifyPayment(reference, 0);
}

// ================= PERSISTENCE =================
function persistPendingTransaction(data) {
  try {
    localStorage.setItem('fastpay_pending_deposit', JSON.stringify(data));
  } catch (e) {
    console.warn('Could not persist pending transaction:', e);
  }
}

function loadPendingTransaction() {
  const raw = localStorage.getItem('fastpay_pending_deposit');
  return raw ? JSON.parse(raw) : null;
}

function clearPendingTransaction() {
  localStorage.removeItem('fastpay_pending_deposit');
  localStorage.removeItem('paystack_reference'); // legacy key
}

// ================= AUTH EXPIRY =================
function handleAuthExpiry() {
  showLoading(false);
  showStatus('Your session has expired. Redirecting to login…', 'error');
  setTimeout(() => {
    localStorage.removeItem('fastpay_token');
    localStorage.removeItem('fastpay_userId');
    globalThis.location.href = globalThis.FastPay?.getLoginPath?.() || '../signup/login.html';
  }, 2000);
}

// ================= HELPERS =================
function tryParseErrorMessage(text) {
  const obj = JSON.parse(text);
  return obj?.message || obj?.error || obj?.data?.message || null;
}

function showStatus(message, type = 'success') {
  const statusEl = document.getElementById('depositStatus');
  if (!statusEl) return;
  statusEl.textContent = message;
  // Map 'warning' and 'info' to CSS classes — add those classes to your stylesheet
  statusEl.className = `status-message ${type} show`;
  if (type === 'success') {
    // Auto-hide only successes; errors/warnings stay until dismissed
    setTimeout(() => { statusEl.classList.remove('show'); }, 6000);
  }
}

function showLoading(show, label = 'Processing...') {
  const payBtn = document.getElementById('payBtn');
  if (!payBtn) return;
  if (show) {
    payBtn.disabled = true;
    payBtn.innerHTML = `
      <div style="width:20px;height:20px;border:3px solid rgba(255,255,255,0.3);
                  border-top-color:white;border-radius:50%;
                  animation:spin 0.8s linear infinite;display:inline-block;"></div>
      <span>${label}</span>`;
  } else {
    payBtn.disabled = false;
    payBtn.innerHTML = `
      <span class="btn-text">Continue to Payment</span>
      <svg class="btn-arrow" width="20" height="20" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>`;
  }
}

function shakeElement(element) {
  element.style.animation = 'shake 0.5s ease';
  setTimeout(() => { element.style.animation = ''; }, 500);
}

// ================= THEME TOGGLE =================
function initializeThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  // Load saved theme or default to light
  const savedTheme = localStorage.getItem('fastpay_theme') || 'light';
  setTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  });
}

function setTheme(theme) {
  const themeToggle = document.getElementById('theme-toggle');
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
    document.body.classList.remove('light');
    if (themeToggle) themeToggle.querySelector('.theme-icon').textContent = '☀️';
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    document.body.classList.add('light');
    if (themeToggle) themeToggle.querySelector('.theme-icon').textContent = '🌙';
  }
  localStorage.setItem('fastpay_theme', theme);
}
