// ================= STATE =================
let currentDate = new Date();
let currentType = "history"; // "history" or "fixed-due"
let savingsData = {};

const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
];
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ================= API CALL =================
async function fetchSavingsData(year, month, type = currentType) {
    const calendarEl = document.getElementById('calendarContent');
    calendarEl.innerHTML = '<div style="text-align:center;padding:40px;">Loading...</div>';

    const BASE_URL = window.FastPay?.getApiBase() || 'http://localhost:8080';
    const token = window.FastPay?.getToken() || localStorage.getItem('fastpay_token');

    if (!token) {
        calendarEl.innerHTML = `
            <div style="text-align:center;padding:40px;color:red;">
                <strong>Not logged in</strong><br>
                <button onclick="window.location.href='${window.FastPay?.getLoginPath?.() || "../signup/login.html"}'" style="padding:10px 20px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;">
                    Go to Login
                </button>
            </div>
        `;
        return;
    }

    const endpoint = type === 'fixed-due'
        ? `${BASE_URL}/wallet/savings/calendar/fixed-due?year=${year}&month=${month}`
        : `${BASE_URL}/wallet/savings/calendar?year=${year}&month=${month}`;

    try {
        const res = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.status === 401 || res.status === 403) {
            logout();
            return;
        }

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }

        const data = await res.json();
        savingsData = transformData(data, type);
        renderCalendar(type);
    } catch (err) {
        console.error('Error fetching savings:', err);
        calendarEl.innerHTML = `<div style="text-align:center;padding:40px;color:red;">Failed to load data.<br>${err.message}</div>`;
    }
}

// Transform API response to calendar-friendly structure
function transformData(apiData, type) {
    const transformed = {};
    if (!Array.isArray(apiData)) return transformed;

    apiData.forEach(item => {
        const date = type === 'fixed-due' && item.maturityDate
            ? new Date(item.maturityDate)
            : new Date(item.createdAt);

        if (!date) return;

        const day = date.getDate();
        if (!transformed[day]) transformed[day] = [];

        transformed[day].push({
            id: item.id,
            amount: item.amount,
            purpose: item.purpose || 'Savings',
            type: item.type || 'NORMAL',
            createdAt: item.createdAt,
            maturityDate: item.maturityDate,
            status: item.status || 'ACTIVE'
        });
    });

    return transformed;
}

// ================= UTIL =================
function formatCurrency(amount) {
    return '₦' + Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ================= CALENDAR RENDER =================
function renderCalendar(type = currentType) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();

    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = "<div class='calendar'>";
    dayNames.forEach(d => html += `<div class="day-header">${d}</div>`);

    for (let i = 0; i < firstDay; i++) html += `<div class="day empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        const daySavings = savingsData[d] || [];
        const total = daySavings.reduce((sum, s) => sum + Number(s.amount), 0);

        let classes = "day";
        if (today.getDate() === d && today.getMonth() === month && today.getFullYear() === year) classes += " today";
        if (daySavings.length) classes += " has-savings";

        if (type === 'fixed-due') {
            daySavings.forEach(s => {
                if (!s.maturityDate) return;
                const diffDays = Math.ceil((new Date(s.maturityDate) - today) / (1000 * 60 * 60 * 24));
                if (diffDays <= 7 && diffDays > 0) classes += " almost-due";
                if (diffDays === 0) classes += " due-today";
            });
        }

        html += `
            <div class="${classes}" onclick="showDayDetails(${d})">
                <div class="day-number">${d}</div>
                ${daySavings.length ? `<div class="savings-amount">${formatCurrency(total)}</div>` : ""}
            </div>
        `;
    }

    html += "</div>";
    document.getElementById('calendarContent').innerHTML = html;
    updateSummary();
}

// ================= SUMMARY =================
function updateSummary() {
    const allSavings = Object.values(savingsData).flat();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalAmount = allSavings.reduce(
        (sum, s) => sum + Number(s.amount || 0), 0
    );

    const setAvgText = (daysLeft) => {
        if (daysLeft === null) {
            document.getElementById('avgSavings').textContent = 'N/A';
        } else if (daysLeft > 0) {
            document.getElementById('avgSavings').textContent = `${daysLeft} Days Left`;
        } else if (daysLeft === 0) {
            document.getElementById('avgSavings').textContent = 'Due Today! 🎉';
        } else {
            document.getElementById('avgSavings').textContent = 'Matured';
        }
    };

    // ================= FIXED SAVINGS VIEW =================
    if (currentType === 'fixed-due') {
        const fixedSavings = allSavings.filter(s => s.type === 'FIXED');
        const fixedTotal = fixedSavings.reduce(
            (sum, s) => sum + Number(s.amount || 0), 0
        );

        let nearestDaysLeft = null;
        let hasActiveFixed = false;

        fixedSavings.forEach(s => {
            if (!s.maturityDate) return;

            const maturityDate = new Date(s.maturityDate);
            maturityDate.setHours(0, 0, 0, 0);

            const daysLeft = Math.ceil(
                (maturityDate - today) / (1000 * 60 * 60 * 24)
            );

            // Only consider active or due-today fixed savings
            if (daysLeft >= 0) {
                hasActiveFixed = true;
                if (nearestDaysLeft === null || daysLeft < nearestDaysLeft) {
                    nearestDaysLeft = daysLeft;
                }
            }
        });

        document.getElementById('totalSavings').textContent =
            formatCurrency(fixedTotal);
        document.getElementById('daysSaved').textContent =
            `${fixedSavings.length} Fixed`;

        setAvgText(hasActiveFixed ? nearestDaysLeft : -1);
        return;
    }

    // ================= HISTORY / ALL SAVINGS VIEW =================
    const savingsWithMaturity = allSavings.filter(s => s.maturityDate);
    let nearestDaysLeft = null;

    savingsWithMaturity.forEach(s => {
        const maturityDate = new Date(s.maturityDate);
        maturityDate.setHours(0, 0, 0, 0);

        const daysLeft = Math.ceil(
            (maturityDate - today) / (1000 * 60 * 60 * 24)
        );

        if (nearestDaysLeft === null || daysLeft < nearestDaysLeft) {
            nearestDaysLeft = daysLeft;
        }
    });

    document.getElementById('totalSavings').textContent =
        formatCurrency(totalAmount);
    document.getElementById('daysSaved').textContent =
        allSavings.length;

    if (savingsWithMaturity.length === 0) {
        document.getElementById('avgSavings').textContent = 'No Fixed Savings';
    } else {
        setAvgText(nearestDaysLeft);
    }
}
   document.getElementById('summary').classList.add('show');

// ================= MODAL =================
function showDayDetails(day) {
    const modal = document.getElementById('detailsModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');

    title.textContent = `Savings on ${day} ${monthNames[currentDate.getMonth()]}`;

    const records = savingsData[day] || [];
    if (!records.length) {
        body.innerHTML = `<div class="no-data">No savings on this day</div>`;
    } else {
        body.innerHTML = records.map(r => `
            <div class="transaction-item">
                <div class="transaction-details">
                    <div class="transaction-purpose">${r.purpose}</div>
                    <div class="transaction-type">
                        ${r.type} - ${r.status}
                        ${r.maturityDate ? `<br><small>Matures: ${new Date(r.maturityDate).toLocaleDateString()}</small>` : ''}
                    </div>
                </div>
                <div class="transaction-amount">${formatCurrency(r.amount)}</div>
            </div>
        `).join('');
    }

    modal.classList.add('show');
}

function closeModal() {
    document.getElementById('detailsModal').classList.remove('show');
}

// ================= NAVIGATION =================
function prevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    fetchSavingsData(currentDate.getFullYear(), currentDate.getMonth() + 1, currentType);
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    fetchSavingsData(currentDate.getFullYear(), currentDate.getMonth() + 1, currentType);
}

// ================= TYPE SWITCH =================
function switchToHistory() {
    currentType = 'history';
    document.getElementById('historyBtn').classList.add('active');
    document.getElementById('fixedBtn').classList.remove('active');
    fetchSavingsData(currentDate.getFullYear(), currentDate.getMonth() + 1, 'history');
}

function switchToFixedDue() {
    currentType = 'fixed-due';
    document.getElementById('fixedBtn').classList.add('active');
    document.getElementById('historyBtn').classList.remove('active');
    fetchSavingsData(currentDate.getFullYear(), currentDate.getMonth() + 1, 'fixed-due');
}

// ================= LOGOUT =================
function logout() {
    localStorage.removeItem('fastpay_token');
    localStorage.removeItem('fastpay_userId');
    window.location.href = window.FastPay?.getLoginPath?.() || '../signup/login.html';
}

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
    fetchSavingsData(currentDate.getFullYear(), currentDate.getMonth() + 1, currentType);
});
