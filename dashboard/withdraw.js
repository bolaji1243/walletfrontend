// DOM Elements
const amountInput = document.getElementById('amount');
const quickAmountBtns = document.querySelectorAll('.quick-amount-btn');
const accountOptions = document.querySelectorAll('.account-option');
const speedOptions = document.querySelectorAll('.speed-option');
const pinInputs = document.querySelectorAll('.pin-digit');
const withdrawBtn = document.getElementById('withdrawBtn');
const withdrawStatus = document.getElementById('withdrawStatus');
const successModal = document.getElementById('successModal');
const addAccountModal = document.getElementById('addAccountModal');
const addAccountBtn = document.getElementById('addAccountBtn');
const refreshBalanceBtn = document.getElementById('refreshBalance');

// Summary elements
const summaryAmount = document.getElementById('summaryAmount');
const summaryFee = document.getElementById('summaryFee');
const summaryTotal = document.getElementById('summaryTotal');

// Modal elements
const modalAmount = document.getElementById('modalAmount');
const refNumber = document.getElementById('refNumber');
const timeStamp = document.getElementById('timeStamp');

// Add account modal elements
const bankSelect = document.getElementById('bankSelect');
const accountNumber = document.getElementById('accountNumber');
const accountName = document.getElementById('accountName');
const accountValidation = document.getElementById('accountValidation');
const saveAccountBtn = document.getElementById('saveAccountBtn');

// State
let selectedAmount = 0;
let selectedAccount = 'primary';
let selectedSpeed = 'instant';
let enteredPin = '';
let transferFee = 50; // Instant transfer fee

// Format number as currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2
  }).format(amount).replace('NGN', '₦');
}

// Parse input to number
function parseAmount(value) {
  return parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
}

// Update transaction summary
function updateSummary() {
  const amount = selectedAmount;
  const fee = selectedSpeed === 'instant' ? transferFee : 0;
  const total = amount + fee;
  
  summaryAmount.textContent = formatCurrency(amount);
  summaryFee.textContent = selectedSpeed === 'instant' ? formatCurrency(fee) : 'Free';
  summaryTotal.textContent = formatCurrency(total);
}
const environ = process.env.NODE_ENV
console.log('Current Environment:', environ);
// Amount input handling
amountInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/[^0-9.]/g, '');
  
  // Prevent multiple decimal points
  const parts = value.split('.');
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('');
  }
  
  e.target.value = value;
  selectedAmount = parseAmount(value);
  
  // Update quick amount buttons
  quickAmountBtns.forEach(btn => {
    btn.classList.remove('active');
    if (parseFloat(btn.dataset.amount) === selectedAmount) {
      btn.classList.add('active');
    }
  });
  
  updateSummary();
});

// Format on blur
amountInput.addEventListener('blur', (e) => {
  if (selectedAmount > 0) {
    e.target.value = selectedAmount.toFixed(2);
  }
});

// Quick amount buttons
quickAmountBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const amount = parseFloat(btn.dataset.amount);
    selectedAmount = amount;
    amountInput.value = amount.toFixed(2);
    
    quickAmountBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    updateSummary();
  });
});

// Account selection
accountOptions.forEach(option => {
  option.addEventListener('click', () => {
    if (!option.classList.contains('disabled')) {
      accountOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      selectedAccount = option.dataset.account;
    }
  });
});

// Speed selection
speedOptions.forEach(option => {
  option.addEventListener('click', () => {
    speedOptions.forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');
    selectedSpeed = option.dataset.speed;
    
    // Update fee
    transferFee = selectedSpeed === 'instant' ? 50 : 0;
    updateSummary();
  });
});

// PIN input handling
pinInputs.forEach((input, index) => {
  input.addEventListener('input', (e) => {
    const value = e.target.value;
    
    if (value.length === 1 && index < pinInputs.length - 1) {
      pinInputs[index + 1].focus();
    }
    
    // Update PIN state
    enteredPin = Array.from(pinInputs).map(inp => inp.value).join('');
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      pinInputs[index - 1].focus();
    }
  });
  
  // Only allow numbers
  input.addEventListener('keypress', (e) => {
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  });
});

// Refresh balance
refreshBalanceBtn.addEventListener('click', () => {
  refreshBalanceBtn.style.transform = 'rotate(360deg)';
  
  setTimeout(() => {
    refreshBalanceBtn.style.transform = 'rotate(0deg)';
    showStatus('Balance updated', 'success');
  }, 500);
});

// Add account button
addAccountBtn.addEventListener('click', () => {
  addAccountModal.classList.add('show');
});

// Bank account validation (simulated)
accountNumber.addEventListener('input', async (e) => {
  const value = e.target.value;
  
  // Only allow numbers
  e.target.value = value.replace(/[^0-9]/g, '');
  
  if (e.target.value.length === 10) {
    accountValidation.textContent = 'Verifying account...';
    accountValidation.className = 'account-validation';
    accountValidation.style.display = 'block';
    accountValidation.style.color = '#93c5fd';
    
    // Simulate API call
    setTimeout(() => {
      const bankName = bankSelect.options[bankSelect.selectedIndex].text;
      accountName.value = 'John Doe'; // Simulated response
      accountValidation.textContent = '✓ Account verified';
      accountValidation.className = 'account-validation success';
    }, 1000);
  } else {
    accountName.value = '';
    accountValidation.style.display = 'none';
  }
});

// Bank selection change
bankSelect.addEventListener('change', () => {
  accountNumber.value = '';
  accountName.value = '';
  accountValidation.style.display = 'none';
});

// Save account button
saveAccountBtn.addEventListener('click', () => {
  if (bankSelect.value && accountNumber.value.length === 10 && accountName.value) {
    showStatus('Account added successfully!', 'success');
    closeAddAccountModal();
  } else {
    showStatus('Please complete all fields', 'error');
  }
});

// Withdraw button
withdrawBtn.addEventListener('click', async () => {
  // Validation
  if (selectedAmount < 500) {
    showStatus('Minimum withdrawal is ₦500', 'error');
    return;
  }
  
  if (selectedAmount > 45280.50) {
    showStatus('Insufficient balance', 'error');
    return;
  }
  
  if (enteredPin.length !== 4) {
    showStatus('Please enter your 4-digit PIN', 'error');
    return;
  }
  
  // Disable button
  withdrawBtn.disabled = true;
  withdrawBtn.innerHTML = `
    <span class="btn-text">Processing...</span>
    <svg class="btn-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  `;
  
  // Simulate API call
  setTimeout(() => {
    // Reset button
    withdrawBtn.disabled = false;
    withdrawBtn.innerHTML = `
      <span class="btn-text">Confirm Withdrawal</span>
      <svg class="btn-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    `;
    
    // Show success modal
    showSuccessModal();
    
    // Clear form
    amountInput.value = '';
    selectedAmount = 0;
    pinInputs.forEach(input => input.value = '');
    enteredPin = '';
    quickAmountBtns.forEach(btn => btn.classList.remove('active'));
    updateSummary();
  }, 2000);
});

// Show status message
function showStatus(message, type) {
  withdrawStatus.textContent = message;
  withdrawStatus.className = `status-message ${type}`;
  
  setTimeout(() => {
    withdrawStatus.className = 'status-message';
  }, 5000);
}

// Show success modal
function showSuccessModal() {
  const fee = selectedSpeed === 'instant' ? transferFee : 0;
  const total = selectedAmount + fee;
  
  modalAmount.textContent = selectedAmount.toFixed(2);
  refNumber.textContent = 'FPW' + Math.random().toString(36).substr(2, 9).toUpperCase();
  timeStamp.textContent = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  successModal.classList.add('show');
}

// Close success modal
function closeSuccessModal() {
  successModal.classList.remove('show');
}

// Close add account modal
function closeAddAccountModal() {
  addAccountModal.classList.remove('show');
  bankSelect.value = '';
  accountNumber.value = '';
  accountName.value = '';
  accountValidation.style.display = 'none';
}

// Download receipt (simulated)
function downloadReceipt() {
  showStatus('Receipt downloaded', 'success');
  closeSuccessModal();
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeSuccessModal();
      closeAddAccountModal();
    }
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // ESC to close modals
  if (e.key === 'Escape') {
    closeSuccessModal();
    closeAddAccountModal();
  }
  
  // Enter on withdraw button
  if (e.key === 'Enter' && document.activeElement === pinInputs[3]) {
    withdrawBtn.click();
  }
});

// Initialize
updateSummary();

// Add some animations on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, {
  threshold: 0.1
});

document.querySelectorAll('.feature-card').forEach(card => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(20px)';
  card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(card);
});

// Add smooth number animation for balance
function animateValue(element, start, end, duration) {
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      current = end;
      clearInterval(timer);
    }
    element.textContent = formatCurrency(current);
  }, 16);
}

// Example: Animate balance on page load
window.addEventListener('load', () => {
  const balanceElement = document.querySelector('.balance-amount');
  if (balanceElement) {
    balanceElement.textContent = formatCurrency(0);
    setTimeout(() => {
      animateValue(balanceElement, 0, 45280.50, 1500);
    }, 300);
  }
});