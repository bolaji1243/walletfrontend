// ================= CONFIGURATION =================
const API_BASE_URL = '/api/rewards';
const TOKEN        = window.FastPay?.getToken() || localStorage.getItem("fastpay_token");

const AUTH_HEADERS = {
  "Content-Type":  "application/json",
  "Authorization": `Bearer ${TOKEN}`
};

const TIER_THRESHOLDS = {
  BRONZE:   0,
  SILVER:   10_000,
  GOLD:     50_000,
  PLATINUM: 100_000
};

const TIER_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

// ================= STATE =================
let currentPoints = 0;
let currentTier   = 'BRONZE';

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  if (!TOKEN) {
    window.location.href = window.FastPay?.getLoginPath?.() || "../signup/login.html";
    return;
  }
  loadDashboard();
  setupRealtimeCalculator();
});

// ================= DASHBOARD =================
/*
 * Calls GET /api/rewards/summary — returns:
 * { success, points, tier, pointsToNextTier, cashValue, message }
 */
async function loadDashboard() {
  showLoading(true);
  try {
    const res  = await fetch(`${API_BASE_URL}/summary`, { headers: AUTH_HEADERS });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    currentPoints = Number(data.points)    || 0;
    currentTier   = data.tier              || 'BRONZE';

    updateAllDisplays(data);

  } catch (err) {
    console.error('Dashboard load failed:', err);
    currentPoints = 0;
    currentTier   = 'BRONZE';
    updateAllDisplays(null);
    showToast(err.message || 'Failed to load rewards', 'error');
  } finally {
    showLoading(false);
  }
}

// ================= UI UPDATES =================
/*
 * data — the full summary response object, or null on error.
 * When data is null we fall back to local state.
 */
function updateAllDisplays(data) {
  updatePointsDisplay();
  updateTierDisplay();
  updateCashValue(data?.cashValue);
  updateTierProgress(data?.pointsToNextTier);
}

function updatePointsDisplay() {
  const el = document.getElementById('totalPoints');
  if (el) el.textContent = currentPoints.toLocaleString();
}

function updateTierDisplay() {
  const tierEl  = document.getElementById('currentTier');
  const badgeEl = document.getElementById('tierBadge');
  if (tierEl)  tierEl.textContent  = currentTier;
  if (badgeEl) {
    badgeEl.textContent = currentTier;
    badgeEl.className   = `tier-badge tier-${currentTier.toLowerCase()}`;
  }
}

function updateCashValue(serverCashValue) {
  const el = document.getElementById('cashValue');
  if (!el) return;

  // Prefer server value (already calculated at correct rate); fall back locally
  const cash = serverCashValue !== undefined && serverCashValue !== null
    ? Number(serverCashValue)
    : currentPoints * 0.5;

  el.textContent = `₦${cash.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function updateTierProgress(serverPointsToNext) {
  const fillEl      = document.getElementById('progressFill');
  const textEl      = document.getElementById('progressText');
  const nextLabel   = document.getElementById('nextTierLabel');
  const currentLabel = document.getElementById('currentTierLabel');

  if (currentLabel) currentLabel.textContent = currentTier;

  const nextTier = getNextTier(currentTier);

  if (!nextTier) {
    if (nextLabel) nextLabel.textContent   = 'MAX';
    if (fillEl)   fillEl.style.width       = '100%';
    if (textEl)   textEl.textContent       = '🎉 Maximum tier reached — PLATINUM!';
    return;
  }

  if (nextLabel) nextLabel.textContent = nextTier;

  // Use server-supplied pointsToNextTier when available
  const pointsNeeded = serverPointsToNext !== undefined && serverPointsToNext !== null
    ? Number(serverPointsToNext)
    : TIER_THRESHOLDS[nextTier] - currentPoints;

  const currentThreshold = TIER_THRESHOLDS[currentTier];
  const nextThreshold    = TIER_THRESHOLDS[nextTier];
  const percent = ((currentPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100;

  if (fillEl) fillEl.style.width = `${Math.min(Math.max(percent, 0), 100)}%`;
  if (textEl) textEl.textContent =
    `${pointsNeeded.toLocaleString()} more points to reach ${nextTier}`;
}

// ================= TIER HELPERS =================
function getNextTier(tier) {
  const idx = TIER_ORDER.indexOf(tier);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

// ================= REALTIME CALCULATOR =================
/*
 * Uses GET /api/rewards/preview?points=N to get the server-calculated
 * cash value and also check whether the user can redeem that many points.
 */
function setupRealtimeCalculator() {
  const inputEl = document.getElementById('pointsToRedeem');
  if (!inputEl) return;

  const helpEl = inputEl.parentElement?.querySelector('.input-help');

  let previewDebounce = null;

  inputEl.addEventListener('input', () => {
    const points = parseInt(inputEl.value) || 0;

    if (points <= 0) {
      if (helpEl) {
        helpEl.textContent   = 'Conversion rate: 1 point = ₦0.50';
        helpEl.style.color   = '#888';
      }
      return;
    }

    // Instant local feedback while server call is in flight
    const localCash = (points * 0.5).toLocaleString('en-NG', { minimumFractionDigits: 2 });
    if (helpEl) {
      helpEl.innerHTML   = `💰 Calculating…`;
      helpEl.style.color = '#888';
    }

    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/preview?points=${points}`, { headers: AUTH_HEADERS });
        const data = await res.json();

        if (!res.ok || !data.success) throw new Error(data.message);

        const cash = Number(data.cashValue).toLocaleString('en-NG', { minimumFractionDigits: 2 });
        if (helpEl) {
          helpEl.innerHTML = `💰 You will receive <strong>₦${cash}</strong>`;
          if (!data.canRedeem) {
            helpEl.innerHTML += ` <span style="color:#f5576c;">⚠️ Exceeds your balance (${data.availablePoints.toLocaleString()} pts)</span>`;
          }
        }
      } catch (_) {
        // Fallback to local calc on network failure
        if (helpEl) {
          helpEl.innerHTML = `💰 You will receive <strong>₦${localCash}</strong>`;
          if (points > currentPoints) {
            helpEl.innerHTML += ` <span style="color:#f5576c;">⚠️ Exceeds balance</span>`;
          }
        }
      }
    }, 500);
  });
}

// ================= REDEEM POINTS =================
/*
 * POST /api/rewards/redeem?points=N
 * Returns: { success, points, cashValue, message }
 */
async function redeemPoints() {
  const inputEl = document.getElementById('pointsToRedeem');
  const points  = parseInt(inputEl?.value);

  if (!points || points <= 0) { showToast('Enter a valid number of points', 'error'); return; }
  if (points > currentPoints)  { showToast('Insufficient points balance', 'error');   return; }

  showLoading(true);
  try {
    const res  = await fetch(`${API_BASE_URL}/redeem?points=${points}`, {
      method:  'POST',
      headers: AUTH_HEADERS
    });
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.message || 'Redemption failed');

    showToast(data.message || `${points} points redeemed successfully! ₦${data.cashValue} added to wallet.`, 'success');
    if (inputEl) inputEl.value = '';

    // Re-fetch to get fresh points + tier
    await loadDashboard();

  } catch (err) {
    console.error('Redeem failed:', err);
    showToast(err.message || 'Redemption failed. Please try again.', 'error');
  } finally {
    showLoading(false);
  }
}

// ================= QUICK REDEEM =================
function quickRedeem(points) {
  const inputEl = document.getElementById('pointsToRedeem');
  if (!inputEl) return;

  inputEl.value = points;
  inputEl.dispatchEvent(new Event('input')); // trigger calculator preview

  // Small delay so the user sees the preview before it fires
  setTimeout(redeemPoints, 600);
}

// ================= AI INSIGHT =================
/*
 * POST /api/rewards/ai/insight
 * Endpoint is ready in GeminiService — just wired here.
 */
async function getAIInsight() {
  const insightBox     = document.getElementById('aiInsightBox');
  const insightContent = document.getElementById('aiInsightContent');

  showLoading(true);
  try {
    const res = await fetch(`${API_BASE_URL}/ai/insight`, {
      method:  'POST',
      headers: AUTH_HEADERS
    });

    if (!res.ok) throw new Error('AI service unavailable');

    const insight = await res.text();
    if (insightContent) insightContent.textContent = insight;
    if (insightBox)     insightBox.style.display   = 'block';

  } catch (err) {
    console.error('AI insight error:', err);
    if (insightContent) insightContent.innerHTML =
      '<strong style="color:#f5576c;">AI service temporarily unavailable. Please try again later.</strong>';
    if (insightBox) insightBox.style.display = 'block';
  } finally {
    showLoading(false);
  }
}

// ================= HELPERS =================
function showLoading(show) {
  document.getElementById('loadingOverlay')?.classList.toggle('show', show);
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 4000);
}

window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled promise rejection:', e.reason);
  showToast('An unexpected error occurred', 'error');
});
