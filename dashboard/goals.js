// ================= CONFIG =================
const API_BASE = window.FastPay?.getApiBase() || "http://localhost:8080";
const token = window.FastPay?.getToken() || localStorage.getItem("fastpay_token");
const userId = window.FastPay?.getUserId() || localStorage.getItem("fastpay_userId");

if (!token || !userId) {
    alert("You must login first.");
    window.location.href = window.FastPay?.getLoginPath?.() || "../signup/login.html";
}

const headers = {
    "Authorization": `Bearer ${token}`
};

async function readJsonResponse(response) {
    if (window.FastPay?.readResponse) {
        return window.FastPay.readResponse(response);
    }

    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (error) {
        data = null;
    }

    return { ok: response.ok, status: response.status, text, data, response };
}

const goalImageCropState = {
    originalFile: null,
    croppedFile: null,
    imageUrl: "",
    imageElement: null,
    viewportElement: null,
    cropSelectionElement: null,
    zoomInput: null,
    scale: 1,
    minScale: 1,
    offsetX: 0,
    offsetY: 0,
    baseWidth: 0,
    baseHeight: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    interactionMode: null,
    resizeHandle: null,
    cropRect: { x: 0, y: 0, width: 0, height: 0 },
    cropStartRect: { x: 0, y: 0, width: 0, height: 0 }
};

// ================= COMPLETION CELEBRATION MODAL =================
function showCompletionCelebration(goal) {
    // ✅ FIX: For auto-withdrawal, savedAmount is 0 after transfer, so use targetAmount
    const displayAmount = (goal.autoWithdrawOnComplete && goal.savedAmount === 0) 
        ? goal.targetAmount 
        : goal.savedAmount;
    
    // Create modal HTML
    const modal = document.createElement('div');
    modal.id = 'celebrationModal';
    modal.className = 'celebration-modal';
    modal.innerHTML = `
        <div class="celebration-content">
            <div class="confetti-container">
                <div class="confetti"></div>
                <div class="confetti"></div>
                <div class="confetti"></div>
                <div class="confetti"></div>
                <div class="confetti"></div>
                <div class="confetti"></div>
                <div class="confetti"></div>
                <div class="confetti"></div>
                <div class="confetti"></div>
                <div class="confetti"></div>
            </div>
            
            <div class="celebration-body">
                <div class="celebration-icon">🎉</div>
                <h1>Goal Completed!</h1>
                <h2>${escapeHTML(goal.name)}</h2>
                
                <div class="celebration-stats">
                    <div class="stat-item">
                        <span class="stat-label">Amount Saved</span>
                        <span class="stat-value">₦${formatCurrency(displayAmount)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total Contributions</span>
                        <span class="stat-value">${goal.totalContributions}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Days Taken</span>
                        <span class="stat-value">${goal.daysElapsed} days</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Streak</span>
                        <span class="stat-value">${goal.currentStreak} days 🔥</span>
                    </div>
                </div>
                
                <p class="celebration-message">
                    Congratulations! You've successfully reached your savings goal.<br>
                    ${goal.autoWithdrawOnComplete 
                        ? '₦' + formatCurrency(displayAmount) + ' has been automatically transferred to your wallet!' 
                        : 'Click "Withdraw" to transfer funds to your wallet, or "Cancel" to remove this completed goal.'}
                </p>
                
                <div class="celebration-actions">
                    ${!goal.autoWithdrawOnComplete ? `
                        <button onclick="handleCelebrationWithdraw('${goal.id}')" class="btn-primary">
                            💸 Withdraw ₦${formatCurrency(displayAmount)}
                        </button>
                    ` : ''}
                    <button onclick="handleCelebrationCancel('${goal.id}')" class="btn-secondary">
                        ${goal.autoWithdrawOnComplete ? 'Close' : 'Cancel'}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Trigger animation
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

function closeCelebrationModal() {
    const modal = document.getElementById('celebrationModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

async function handleCelebrationWithdraw(goalId) {
    closeCelebrationModal();
    await withdrawGoal(goalId);
}

async function handleCelebrationCancel(goalId) {
    closeCelebrationModal();
    // Automatically delete the goal when user cancels
    await deleteGoalSilently(goalId);
}

// ================= DELETE GOAL SILENTLY (NO CONFIRMATION) =================
async function deleteGoalSilently(goalId) {
    try {
        const response = await fetch(`${API_BASE}/api/goals/${goalId}?userId=${userId}`, {
            method: 'DELETE',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to delete goal');
        }

        // Silent delete - no success message
        loadUserGoals();
        
    } catch (error) {
        console.error("Error deleting goal:", error);
        showError(error.message || "Failed to delete goal");
    }
}

// ================= DELETE GOAL =================
async function deleteGoal(goalId) {
    if (!confirm("Are you sure you want to delete this goal? This action cannot be undone.")) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/goals/${goalId}?userId=${userId}`, {
            method: 'DELETE',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to delete goal');
        }

        showSuccess('Goal deleted successfully!');
        loadUserGoals();
        
    } catch (error) {
        console.error("Error deleting goal:", error);
        showError(error.message || "Failed to delete goal");
    }
}

// ================= MODAL FUNCTIONS =================
function showCreateGoalModal() {
    const modal = document.getElementById('createGoalModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeCreateGoalModal() {
    const modal = document.getElementById('createGoalModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('createGoalForm').reset();
        resetGoalImageSelection();
    }
}

function initializeGoalImageCropper() {
    goalImageCropState.imageElement = document.getElementById('cropImage');
    goalImageCropState.viewportElement = document.getElementById('cropViewport');
    goalImageCropState.cropSelectionElement = document.getElementById('cropSelection');
    goalImageCropState.zoomInput = document.getElementById('cropZoomRange');

    const fileInput = document.getElementById('goalImageInput');
    const recropButton = document.getElementById('recropGoalImageBtn');
    const applyButton = document.getElementById('applyCropBtn');

    if (fileInput) {
        fileInput.addEventListener('change', handleGoalImageSelection);
    }

    if (recropButton) {
        recropButton.addEventListener('click', () => {
            if (goalImageCropState.originalFile) {
                openImageCropModal(goalImageCropState.originalFile);
            }
        });
    }

    if (applyButton) {
        applyButton.addEventListener('click', applyGoalImageCrop);
    }

    if (goalImageCropState.zoomInput) {
        goalImageCropState.zoomInput.addEventListener('input', handleCropZoom);
    }

    if (goalImageCropState.viewportElement) {
        goalImageCropState.viewportElement.addEventListener('pointerdown', startCropDrag);
    }

    if (goalImageCropState.cropSelectionElement) {
        goalImageCropState.cropSelectionElement.addEventListener('pointerdown', startCropBoxMove);
    }

    document.querySelectorAll('.crop-handle').forEach((handle) => {
        handle.addEventListener('pointerdown', startCropResize);
    });

    document.addEventListener('pointermove', onCropDrag);
    document.addEventListener('pointerup', endCropDrag);
    document.addEventListener('pointercancel', endCropDrag);
}

function handleGoalImageSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    openImageCropModal(file);
}

function openImageCropModal(file) {
    const cropModal = document.getElementById('imageCropModal');
    const imageElement = goalImageCropState.imageElement;

    if (!cropModal || !imageElement || !goalImageCropState.viewportElement) return;

    goalImageCropState.originalFile = file;

    if (goalImageCropState.imageUrl) {
        URL.revokeObjectURL(goalImageCropState.imageUrl);
    }

    goalImageCropState.imageUrl = URL.createObjectURL(file);
    imageElement.onload = () => {
        cropModal.classList.add('active');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setupCropBounds();
                initializeCropSelectionBox();
            });
        });
    };
    imageElement.src = goalImageCropState.imageUrl;
}

function closeImageCropModal() {
    const cropModal = document.getElementById('imageCropModal');
    cropModal?.classList.remove('active');
    endCropDrag();

    const fileInput = document.getElementById('goalImageInput');
    if (!goalImageCropState.croppedFile && fileInput) {
        fileInput.value = "";
        goalImageCropState.originalFile = null;
        if (!document.getElementById('goalImagePreview')?.classList.contains('hidden')) {
            updateGoalImagePreview();
        }
    }
}

function initializeCropSelectionBox() {
    const viewport = goalImageCropState.viewportElement;
    if (!viewport) return;

    const insetX = Math.max(24, viewport.clientWidth * 0.12);
    const insetY = Math.max(24, viewport.clientHeight * 0.12);

    goalImageCropState.cropRect = {
        x: insetX,
        y: insetY,
        width: Math.max(160, viewport.clientWidth - (insetX * 2)),
        height: Math.max(120, viewport.clientHeight - (insetY * 2))
    };

    updateCropSelectionUI();
}

function updateCropSelectionUI() {
    const selection = goalImageCropState.cropSelectionElement;
    if (!selection) return;

    selection.style.left = `${goalImageCropState.cropRect.x}px`;
    selection.style.top = `${goalImageCropState.cropRect.y}px`;
    selection.style.width = `${goalImageCropState.cropRect.width}px`;
    selection.style.height = `${goalImageCropState.cropRect.height}px`;
}

function setupCropBounds() {
    const imageElement = goalImageCropState.imageElement;
    const viewport = goalImageCropState.viewportElement;
    const zoomInput = goalImageCropState.zoomInput;

    if (!imageElement || !viewport || !zoomInput || !imageElement.naturalWidth || !imageElement.naturalHeight) {
        return;
    }

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    if (!viewportWidth || !viewportHeight) {
        return;
    }
    const widthRatio = viewportWidth / imageElement.naturalWidth;
    const heightRatio = viewportHeight / imageElement.naturalHeight;

    // Start by showing the full image inside the crop area.
    goalImageCropState.minScale = Math.min(widthRatio, heightRatio);
    goalImageCropState.scale = goalImageCropState.minScale;
    goalImageCropState.baseWidth = imageElement.naturalWidth;
    goalImageCropState.baseHeight = imageElement.naturalHeight;

    zoomInput.min = String(goalImageCropState.minScale);
    zoomInput.max = String(goalImageCropState.minScale * 3);
    zoomInput.value = String(goalImageCropState.minScale);

    const scaledWidth = goalImageCropState.baseWidth * goalImageCropState.scale;
    const scaledHeight = goalImageCropState.baseHeight * goalImageCropState.scale;

    goalImageCropState.offsetX = (viewportWidth - scaledWidth) / 2;
    goalImageCropState.offsetY = (viewportHeight - scaledHeight) / 2;

    updateCropImageTransform();
}

function handleCropZoom(event) {
    const previousScale = goalImageCropState.scale;
    const nextScale = Number(event.target.value);
    const viewport = goalImageCropState.viewportElement;
    if (!viewport || !previousScale || !nextScale) return;

    const viewportCenterX = viewport.clientWidth / 2;
    const viewportCenterY = viewport.clientHeight / 2;
    const imagePointX = (viewportCenterX - goalImageCropState.offsetX) / previousScale;
    const imagePointY = (viewportCenterY - goalImageCropState.offsetY) / previousScale;

    goalImageCropState.scale = nextScale;
    goalImageCropState.offsetX = viewportCenterX - (imagePointX * nextScale);
    goalImageCropState.offsetY = viewportCenterY - (imagePointY * nextScale);

    constrainCropOffsets();
    updateCropImageTransform();
}

function startCropDrag(event) {
    if (event.target.closest('#cropSelection')) return;
    if (!goalImageCropState.imageElement?.src) return;

    event.preventDefault();
    goalImageCropState.interactionMode = 'image-drag';
    goalImageCropState.dragging = true;
    goalImageCropState.dragStartX = event.clientX;
    goalImageCropState.dragStartY = event.clientY;
    goalImageCropState.startOffsetX = goalImageCropState.offsetX;
    goalImageCropState.startOffsetY = goalImageCropState.offsetY;
    goalImageCropState.viewportElement?.classList.add('dragging');
    goalImageCropState.viewportElement?.setPointerCapture?.(event.pointerId);
}

function startCropBoxMove(event) {
    if (event.target.closest('.crop-handle')) return;

    event.preventDefault();
    event.stopPropagation();
    goalImageCropState.interactionMode = 'crop-move';
    goalImageCropState.dragging = true;
    goalImageCropState.dragStartX = event.clientX;
    goalImageCropState.dragStartY = event.clientY;
    goalImageCropState.cropStartRect = { ...goalImageCropState.cropRect };
    goalImageCropState.cropSelectionElement?.classList.add('dragging-box');
}

function startCropResize(event) {
    event.preventDefault();
    event.stopPropagation();
    goalImageCropState.interactionMode = 'crop-resize';
    goalImageCropState.resizeHandle = event.currentTarget.dataset.handle;
    goalImageCropState.dragging = true;
    goalImageCropState.dragStartX = event.clientX;
    goalImageCropState.dragStartY = event.clientY;
    goalImageCropState.cropStartRect = { ...goalImageCropState.cropRect };
    goalImageCropState.cropSelectionElement?.classList.add('resizing');
}

function onCropDrag(event) {
    if (!goalImageCropState.dragging) return;

    const deltaX = event.clientX - goalImageCropState.dragStartX;
    const deltaY = event.clientY - goalImageCropState.dragStartY;

    if (goalImageCropState.interactionMode === 'image-drag') {
        goalImageCropState.offsetX = goalImageCropState.startOffsetX + deltaX;
        goalImageCropState.offsetY = goalImageCropState.startOffsetY + deltaY;

        constrainCropOffsets();
        updateCropImageTransform();
        return;
    }

    if (goalImageCropState.interactionMode === 'crop-move') {
        moveCropSelection(deltaX, deltaY);
        return;
    }

    if (goalImageCropState.interactionMode === 'crop-resize') {
        resizeCropSelection(deltaX, deltaY);
    }
}

function endCropDrag() {
    goalImageCropState.dragging = false;
    goalImageCropState.interactionMode = null;
    goalImageCropState.resizeHandle = null;
    goalImageCropState.viewportElement?.classList.remove('dragging');
    goalImageCropState.cropSelectionElement?.classList.remove('dragging-box');
    goalImageCropState.cropSelectionElement?.classList.remove('resizing');
}

function constrainCropOffsets() {
    const viewport = goalImageCropState.viewportElement;
    if (!viewport) return;

    const scaledWidth = goalImageCropState.baseWidth * goalImageCropState.scale;
    const scaledHeight = goalImageCropState.baseHeight * goalImageCropState.scale;

    if (scaledWidth <= viewport.clientWidth) {
        goalImageCropState.offsetX = (viewport.clientWidth - scaledWidth) / 2;
    } else {
        const minOffsetX = viewport.clientWidth - scaledWidth;
        const maxOffsetX = 0;
        goalImageCropState.offsetX = Math.min(maxOffsetX, Math.max(minOffsetX, goalImageCropState.offsetX));
    }

    if (scaledHeight <= viewport.clientHeight) {
        goalImageCropState.offsetY = (viewport.clientHeight - scaledHeight) / 2;
    } else {
        const minOffsetY = viewport.clientHeight - scaledHeight;
        const maxOffsetY = 0;
        goalImageCropState.offsetY = Math.min(maxOffsetY, Math.max(minOffsetY, goalImageCropState.offsetY));
    }
}

function moveCropSelection(deltaX, deltaY) {
    const viewport = goalImageCropState.viewportElement;
    const start = goalImageCropState.cropStartRect;
    if (!viewport) return;

    goalImageCropState.cropRect.x = Math.max(
        0,
        Math.min(viewport.clientWidth - start.width, start.x + deltaX)
    );
    goalImageCropState.cropRect.y = Math.max(
        0,
        Math.min(viewport.clientHeight - start.height, start.y + deltaY)
    );

    updateCropSelectionUI();
}

function resizeCropSelection(deltaX, deltaY) {
    const viewport = goalImageCropState.viewportElement;
    const start = goalImageCropState.cropStartRect;
    const handle = goalImageCropState.resizeHandle || '';
    const minWidth = 120;
    const minHeight = 120;
    if (!viewport) return;

    const next = { ...start };

    if (handle.includes('e')) {
        next.width = Math.max(minWidth, Math.min(viewport.clientWidth - start.x, start.width + deltaX));
    }
    if (handle.includes('s')) {
        next.height = Math.max(minHeight, Math.min(viewport.clientHeight - start.y, start.height + deltaY));
    }
    if (handle.includes('w')) {
        next.x = Math.max(0, Math.min(start.x + start.width - minWidth, start.x + deltaX));
        next.width = start.width + (start.x - next.x);
    }
    if (handle.includes('n')) {
        next.y = Math.max(0, Math.min(start.y + start.height - minHeight, start.y + deltaY));
        next.height = start.height + (start.y - next.y);
    }

    if (next.x + next.width > viewport.clientWidth) {
        next.width = viewport.clientWidth - next.x;
    }
    if (next.y + next.height > viewport.clientHeight) {
        next.height = viewport.clientHeight - next.y;
    }

    goalImageCropState.cropRect = next;
    updateCropSelectionUI();
}

function updateCropImageTransform() {
    const imageElement = goalImageCropState.imageElement;
    if (!imageElement) return;

    imageElement.style.width = `${goalImageCropState.baseWidth}px`;
    imageElement.style.height = `${goalImageCropState.baseHeight}px`;
    imageElement.style.transform = `translate(${goalImageCropState.offsetX}px, ${goalImageCropState.offsetY}px) scale(${goalImageCropState.scale})`;
}

async function applyGoalImageCrop() {
    const imageElement = goalImageCropState.imageElement;
    const cropRect = goalImageCropState.cropRect;
    if (!imageElement || !goalImageCropState.originalFile || !cropRect.width || !cropRect.height) return;

    const canvas = document.createElement('canvas');
    const maxDimension = 1600;
    const ratio = cropRect.width / cropRect.height;
    canvas.width = ratio >= 1 ? maxDimension : Math.round(maxDimension * ratio);
    canvas.height = ratio >= 1 ? Math.round(maxDimension / ratio) : maxDimension;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = "#13131f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sourceX = (cropRect.x - goalImageCropState.offsetX) / goalImageCropState.scale;
    const sourceY = (cropRect.y - goalImageCropState.offsetY) / goalImageCropState.scale;
    const sourceWidth = cropRect.width / goalImageCropState.scale;
    const sourceHeight = cropRect.height / goalImageCropState.scale;

    ctx.drawImage(
        imageElement,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
    );

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;

    const fileName = goalImageCropState.originalFile.name.replace(/\.[^.]+$/, '') + '-cropped.jpg';
    goalImageCropState.croppedFile = new File([blob], fileName, { type: 'image/jpeg' });
    updateGoalImagePreview();
    closeImageCropModal();
}

function updateGoalImagePreview() {
    const previewWrapper = document.getElementById('goalImagePreview');
    const previewImage = document.getElementById('goalImagePreviewImg');
    const fileName = document.getElementById('goalImageFileName');

    if (!previewWrapper || !previewImage || !fileName) return;

    if (!goalImageCropState.croppedFile) {
        previewWrapper.classList.add('hidden');
        previewImage.removeAttribute('src');
        fileName.textContent = 'No image selected';
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        previewImage.src = reader.result;
        previewWrapper.classList.remove('hidden');
        fileName.textContent = goalImageCropState.croppedFile.name;
    };
    reader.readAsDataURL(goalImageCropState.croppedFile);
}

function resetGoalImageSelection() {
    const fileInput = document.getElementById('goalImageInput');
    closeImageCropModal();
    if (goalImageCropState.imageUrl) {
        URL.revokeObjectURL(goalImageCropState.imageUrl);
    }

    goalImageCropState.originalFile = null;
    goalImageCropState.croppedFile = null;
    goalImageCropState.imageUrl = "";
    goalImageCropState.scale = 1;
    goalImageCropState.minScale = 1;
    goalImageCropState.offsetX = 0;
    goalImageCropState.offsetY = 0;
    goalImageCropState.cropRect = { x: 0, y: 0, width: 0, height: 0 };
    goalImageCropState.cropStartRect = { x: 0, y: 0, width: 0, height: 0 };

    if (fileInput) fileInput.value = "";
    updateGoalImagePreview();
    updateCropSelectionUI();
}

function showGoalDetailModal(goal) {
    const modal = document.getElementById("goalDetailsModal");
    const content = document.getElementById("goalDetailsContent");

    content.innerHTML = `
        <h2>${escapeHTML(goal.name)}</h2>

        <div class="detail-section">
            <h3>💰 Financial</h3>
            <p><strong>Saved:</strong> ₦${formatCurrency(goal.savedAmount)}</p>
            <p><strong>Target:</strong> ₦${formatCurrency(goal.targetAmount)}</p>
            <p><strong>Progress:</strong> ${goal.progressPercent}%</p>
            <p><strong>Amount Left:</strong> ₦${formatCurrency(goal.amountLeft)}</p>
        </div>

        <div class="detail-section">
            <h3>📅 Timeline</h3>
            <p><strong>Created:</strong> ${formatDate(goal.createdAt)}</p>
            <p><strong>Target Date:</strong> ${goal.targetDate}</p>
            <p><strong>Days Remaining:</strong> ${goal.daysRemaining}</p>
        </div>

        <div class="detail-section">
            <h3>🔥 Performance</h3>
            <p><strong>Streak:</strong> ${goal.currentStreak} days</p>
            <p><strong>Consistency:</strong> ${goal.consistencyScore}%</p>
            <p><strong>Total Contributions:</strong> ${goal.totalContributions}</p>
            <p><strong>Rank:</strong> #${goal.rank || 'N/A'}</p>
        </div>
    `;

    modal.classList.add("active");
}

function closeGoalDetailsModal() {
    const modal = document.getElementById("goalDetailsModal");
    modal.classList.remove("active");
}

// ================= CALCULATE STATS FROM GOALS =================
function calculateStats(goals) {
    if (!goals || goals.length === 0) {
        return {
            totalSaved: 0,
            activeGoals: 0,
            goalsCompleted: 0,
            currentStreak: 0
        };
    }

    let totalSaved = 0;
    let activeGoals = 0;
    let goalsCompleted = 0;
    let maxStreak = 0;

    goals.forEach(goal => {
        // Count active goals (not withdrawn/deleted)
        const isWithdrawn = goal.payoutStatus === 'COMPLETED' || 
                           goal.payoutStatus === 'PAID_OUT' ||
                           (goal.goalStatus === 'COMPLETED' && 
                            (goal.savedAmount === 0 || goal.savedAmount === '0.00' || goal.savedAmount === null));
        
        if (!isWithdrawn) {
            activeGoals++;
            
            // Add to total saved (current balance in goals)
            totalSaved += Number(goal.savedAmount || 0);
            
            // Track highest streak
            const streak = Number(goal.currentStreak || 0);
            if (streak > maxStreak) {
                maxStreak = streak;
            }
        }

        // Count completed goals (regardless of withdrawn status)
        if (goal.goalStatus === 'COMPLETED' || goal.progressPercent >= 100) {
            goalsCompleted++;
        }
    });

    return {
        totalSaved: totalSaved,
        activeGoals: activeGoals,
        goalsCompleted: goalsCompleted,
        currentStreak: maxStreak
    };
}

// ================= RENDER STATS DASHBOARD (FIXED FOR VERTICAL LAYOUT) =================
function renderStatsDashboard(stats) {
    const container = document.getElementById('statsDashboard');
    if (!container) return;

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
                <span class="stat-label">Total Saved</span>
                <span class="stat-value">₦${formatCurrency(stats.totalSaved)}</span>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-content">
                <span class="stat-label">Active Goals</span>
                <span class="stat-value">${stats.activeGoals}</span>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-content">
                <span class="stat-label">Goals Completed</span>
                <span class="stat-value">${stats.goalsCompleted}</span>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">🔥</div>
            <div class="stat-content">
                <span class="stat-label">Current Streak</span>
                <span class="stat-value">${stats.currentStreak} days</span>
            </div>
        </div>
    `;
}

// ================= FETCH ALL USER GOALS =================
async function loadUserGoals() {
    const container = document.getElementById('goalsContainer');
    container.innerHTML = '<div class="loading">Loading goals...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/goals/user/${userId}`, {
            method: 'GET',
            headers: headers
        });

        const parsed = await readJsonResponse(response);
        if (!parsed.ok) {
            throw new Error(window.FastPay?.extractMessage?.(parsed, `HTTP ${response.status}`) || `HTTP ${response.status}`);
        }

        const goals = parsed.data;
        
        // ✅ Calculate and render stats dashboard
        const stats = calculateStats(goals);
        renderStatsDashboard(stats);
        
        // Render goals
        renderGoals(goals);
        
    } catch (error) {
        console.error("Error loading goals:", error);
        container.innerHTML = `
            <div class="error-message">
                <p>Failed to load goals</p>
                <button onclick="loadUserGoals()" class="btn-retry">Retry</button>
            </div>
        `;
    }
}

// ================= RENDER GOALS (FIXED) =================
function renderGoals(goals) {
    const container = document.getElementById('goalsContainer');
    
    if (!goals || goals.length === 0) {
        container.innerHTML = `
            <div class="no-goals">
                <div class="no-goals-icon">🎯</div>
                <h3>No Goals Yet</h3>
                <p>Start your savings journey by creating your first goal!</p>
                <button onclick="showCreateGoalModal()" class="btn-create">Create First Goal</button>
            </div>
        `;
        return;
    }

    // ⭐ FILTER OUT WITHDRAWN GOALS
    const activeGoals = goals.filter(goal => {
        const isWithdrawn = goal.payoutStatus === 'COMPLETED' || 
                           goal.payoutStatus === 'PAID_OUT' ||
                           (goal.goalStatus === 'COMPLETED' && 
                            (goal.savedAmount === 0 || goal.savedAmount === '0.00' || goal.savedAmount === null));
        return !isWithdrawn;
    });
    
    if (activeGoals.length === 0) {
        container.innerHTML = `
            <div class="no-goals">
                <div class="no-goals-icon">🎯</div>
                <h3>No Active Goals</h3>
                <p>All your goals have been completed and withdrawn. Create a new goal to continue saving!</p>
                <button onclick="showCreateGoalModal()" class="btn-create">Create New Goal</button>
            </div>
        `;
        return;
    }

    container.innerHTML = activeGoals.map(goal => {
        const progressPercent = Math.min(goal.progressPercent || 0, 100);
        const isOverdue = goal.daysRemaining < 0;
        const isPaused = goal.isPaused;
        const hasGiftLink = goal.giftLinkEnabled;
        
        // Check if goal is truly completed
        const isCompleted = goal.goalStatus === 'COMPLETED' || progressPercent >= 100;
        
        return `
        <div class="goal-card ${isPaused ? 'paused' : ''} ${isCompleted ? 'completed' : ''}">
            ${goal.goalImage ? 
                `<img src="${goal.goalImage}" alt="${escapeHTML(goal.name)}" class="goal-image" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <div class="goal-icon" style="display:none;">${getCategoryIcon(goal.category)}</div>` 
                : 
                `<div class="goal-icon">${getCategoryIcon(goal.category)}</div>`
            }
            
            ${isPaused ? '<div class="paused-badge">⏸ PAUSED</div>' : ''}
            ${hasGiftLink && !isCompleted ? '<div class="gift-badge">🎁 Gift Link Active</div>' : ''}
            
            <div class="goal-header">
                <div class="goal-title">
                    <h3>${escapeHTML(goal.name)}</h3>
                    <span class="goal-category">${goal.category || 'OTHER'}</span>
                </div>
                <span class="goal-status ${isCompleted ? 'completed' : (goal.goalStatus || 'on_track').toLowerCase()}">${isCompleted ? 'COMPLETED' : (goal.goalStatus || 'ON_TRACK')}</span>
            </div>
            
            <div class="goal-progress">
                <div class="progress-bar-container">
                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                </div>
                <div class="progress-text">
                    <span class="progress-percent">${progressPercent.toFixed(1)}%</span>
                    <span>₦${formatCurrency(goal.savedAmount)} / ₦${formatCurrency(goal.targetAmount)}</span>
                </div>
            </div>
            
            ${goal.currentStreak > 0 ? `
            <div class="streak-indicator">
                <span class="streak-fire">${getStreakEmoji(goal.streakPower)}</span>
                <span class="streak-text">${goal.currentStreak} Day Streak - ${goal.streakPower} Power!</span>
            </div>
            ` : ''}
            
            <div class="goal-stats">
                ${isCompleted ? `
                    <!-- Completed Goal Stats -->
                    <div class="stat">
                        <span class="stat-label">Completed</span>
                        <span class="stat-value">✓</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Total Saved</span>
                        <span class="stat-value">₦${formatCurrency(goal.savedAmount)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Contributions</span>
                        <span class="stat-value">${goal.totalContributions || 0}</span>
                    </div>
                ` : `
                    <!-- Active Goal Stats -->
                    <div class="stat">
                        <span class="stat-label">${isOverdue ? 'Overdue' : 'Days Left'}</span>
                        <span class="stat-value ${isOverdue ? 'overdue' : ''}">${Math.abs(goal.daysRemaining)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Daily Goal</span>
                        <span class="stat-value">₦${formatCurrency(goal.suggestedDaily)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Contributions</span>
                        <span class="stat-value">${goal.totalContributions || 0}</span>
                    </div>
                `}
            </div>
            
            ${!isCompleted ? `
            <div class="goal-stats secondary-stats">
                <div class="stat">
                    <span class="stat-label">Points</span>
                    <span class="stat-value">${goal.points || 0}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Rank</span>
                    <span class="stat-value">#${goal.rank || 'N/A'}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Consistency</span>
                    <span class="stat-value">${goal.consistencyScore || 0}%</span>
                </div>
            </div>
            ` : ''}
            
            ${!isCompleted && goal.milestonePercentage && goal.milestoneAmountNeeded > 0 ? `
                <div class="next-milestone">
                    <span class="milestone-label">🎯 Next: ${goal.milestonePercentage}%</span>
                    <span class="milestone-amount">₦${formatCurrency(goal.milestoneAmountNeeded)} needed</span>
                </div>
            ` : ''}
            
            ${goal.tier ? `
                <div class="tier-badge tier-${goal.tier.toLowerCase()}">${goal.tier} TIER</div>
            ` : ''}
            
            ${!isCompleted && goal.behindBy && goal.behindBy > 0 ? `
                <div class="behind-alert">
                    ⚠️ Behind by ₦${formatCurrency(goal.behindBy)} (${goal.behindByDays} days)
                </div>
            ` : ''}
            
            ${goal.giftContributions > 0 ? `
                <div class="gift-contributions">
                    🎁 Gift Contributions: ₦${formatCurrency(goal.giftContributions)}
                </div>
            ` : ''}
            
            ${!isCompleted && goal.autoDebitEnabled && goal.autoDebitAmount > 0 ? `
                <div class="auto-debit-info">
                    🔄 Auto-saving ₦${formatCurrency(goal.autoDebitAmount)} ${goal.autoDebitFrequency.toLowerCase()}
                </div>
            ` : ''}
            
            ${isCompleted && goal.completedAt ? `
                <div class="completion-info">
                    🎉 Completed on ${formatDate(goal.completedAt)}
                </div>
            ` : ''}
            
            <div class="goal-actions">
                <!-- 📊 DETAILS BUTTON (Always Visible) -->
                <button onclick="viewGoalDetails('${goal.id}'); event.stopPropagation();" 
                        class="btn-secondary">
                    📊 Details
                </button>

                ${isCompleted ? `
                    ${goal.payoutStatus !== 'COMPLETED' ? `
                        <button onclick="withdrawGoal('${goal.id}'); event.stopPropagation();" 
                                class="btn-withdraw">
                            💸 Withdraw ₦${formatCurrency(goal.savedAmount)}
                        </button>
                    ` : `
                        <div class="payout-completed">✅ Already Withdrawn</div>
                    `}
                ` : `
                    ${!isPaused ? `
                        <button onclick="contributeToGoal('${goal.id}'); event.stopPropagation();" 
                                class="btn-contribute">
                            💰 Add ₦${formatCurrency(goal.suggestedToday || goal.suggestedDaily)}
                        </button>
                    ` : ''}
                    
                    ${hasGiftLink ? `
                        <button onclick="shareGiftLink('${goal.giftLinkCode}'); event.stopPropagation();" 
                                class="btn-secondary gift-enabled">
                            🎁 Share Link
                        </button>
                    ` : `
                        <button onclick="enableGiftLink('${goal.id}'); event.stopPropagation();" 
                                class="btn-secondary">
                            🎁 Enable Gift Link
                        </button>
                    `}
                `}
            </div>
        </div>
        `;
    }).join('');
}

// ================= CREATE GOAL =================
async function createGoal(formData) {
    try {
        const submitBtn = document.querySelector('#createGoalForm button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;
        
        const response = await fetch(`${API_BASE}/api/goals/create?userId=${userId}`, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: formData
        });

        const parsed = await readJsonResponse(response);
        if (!parsed.ok) {
            throw new Error(window.FastPay?.extractMessage?.(parsed, `HTTP ${response.status}`) || `HTTP ${response.status}`);
        }

        const goal = parsed.data;
        
        showSuccess(`Goal "${goal.name}" created successfully!`);
        closeCreateGoalModal();
        loadUserGoals();
        
    } catch (error) {
        console.error("Error creating goal:", error);
        showError(error.message || "Failed to create goal");
    } finally {
        const submitBtn = document.querySelector('#createGoalForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Create Goal';
            submitBtn.disabled = false;
        }
    }
}

// ================= HANDLE CREATE GOAL FORM =================
function handleCreateGoalForm(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData();
    
    formData.append('name', form.goalName.value);
    formData.append('category', form.category.value || 'OTHER');
    formData.append('targetAmount', form.targetAmount.value);
    formData.append('targetDate', form.targetDate.value);
    formData.append('autoWithdrawOnComplete', form.autoWithdraw?.checked || false);
    formData.append('keepLockedAfterComplete', form.keepLocked?.checked || false);
    
    const imageFile = goalImageCropState.croppedFile || form.goalImage?.files[0];
    if (imageFile) {
        formData.append('goalImageFile', imageFile);
    }
    
    createGoal(formData);
}

// ================= CONTRIBUTE TO GOAL =================
async function contributeToGoal(goalId) {
    const amount = prompt("Enter amount to contribute:");
    
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
        showError("Invalid amount");
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/goals/${goalId}/contribute?amount=${amount}`, {
            method: 'POST',
            headers: headers
        });

        const parsed = await readJsonResponse(response);
        if (!parsed.ok) {
            throw new Error(window.FastPay?.extractMessage?.(parsed, "Failed to contribute") || "Failed to contribute");
        }

        const updatedGoal = parsed.data;
        
        // ✅ CHECK IF GOAL JUST COMPLETED
        const isJustCompleted = updatedGoal.goalStatus === 'COMPLETED' && updatedGoal.progressPercent >= 100;
        
        if (isJustCompleted) {
            // Show celebration modal
            showCompletionCelebration(updatedGoal);
        } else {
            // Regular success message
            showSuccess(`✅ Success! ₦${formatCurrency(amount)} added to "${updatedGoal.name}"

🔥 Current Streak: ${updatedGoal.currentStreak} days
⭐ Points Earned: +${Math.floor(Number(amount) / 1000)}
📊 Progress: ${updatedGoal.progressPercent}%`);
        }
        
        loadUserGoals();
        
    } catch (error) {
        console.error("Error contributing:", error);
        showError(error.message || "Failed to contribute");
    }
}

// ================= WITHDRAW GOAL (FIXED) =================
async function withdrawGoal(goalId) {
    if (!confirm("Are you sure you want to withdraw this completed goal?")) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/goals/${goalId}/withdraw`, {
            method: 'POST',
            headers: headers
        });

        if (!response.ok) {
            let errorMessage = 'Failed to withdraw goal';
            
            if (response.status === 403) {
                errorMessage = 'You do not have permission to withdraw this goal. It may not be completed yet or may have already been withdrawn.';
            } else if (response.status === 404) {
                errorMessage = 'Goal not found.';
            } else if (response.status === 400) {
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || 'Invalid withdrawal request. The goal may not be eligible for withdrawal.';
                } catch (e) {
                    try {
                        errorMessage = await response.text() || 'Invalid withdrawal request.';
                    } catch (e2) {
                        errorMessage = 'Invalid withdrawal request.';
                    }
                }
            } else {
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    try {
                        errorMessage = await response.text() || errorMessage;
                    } catch (e2) {
                        // Keep default error message
                    }
                }
            }
            throw new Error(errorMessage);
        }

        let result;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
        } else {
            const text = await response.text();
            result = text ? { amount: text } : {};
        }
        
        showSuccess(`✅ ₦${formatCurrency(result.amountWithdrawn || result.amount)} withdrawn to your wallet!`);
        
        await loadUserGoals();
        
    } catch (error) {
        console.error("Error withdrawing:", error);
        showError(error.message || "Failed to withdraw. Please try again.");
    }
}

// ================= ENABLE GIFT LINK =================
// ================= ENABLE GIFT LINK =================
async function enableGiftLink(goalId) {
    if (!confirm("Enable gift link for this goal? Others will be able to contribute via a shareable link.")) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/goals/${goalId}/gift-link`, {
            method: 'POST',
            headers: headers
        });

        if (!response.ok) {
            throw new Error('Failed to enable gift link');
        }

        const giftLink = await response.text();
        
        showSuccess('Gift link enabled! Click "Share Link" to share it.');
        await loadUserGoals();
        
    } catch (error) {
        console.error("Error enabling gift link:", error);
        showError(error.message || "Failed to enable gift link");
    }
}  // ← ADD THIS CLOSING BRACE

// ================= VIEW GOAL DETAILS =================
async function viewGoalDetails(goalId) {
    try {
        const response = await fetch(`${API_BASE}/api/goals/${goalId}`, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const parsed = await readJsonResponse(response);
        if (!parsed.ok) {
            throw new Error(window.FastPay?.extractMessage?.(parsed, `HTTP ${response.status}`) || `HTTP ${response.status}`);
        }
        const goal = parsed.data;
        showGoalDetailModal(goal);
        
    } catch (error) {
        console.error("Error loading goal details:", error);
        showError("Failed to load goal details");
    }
}

// ================= SHARE GIFT LINK =================
/// ================= SHARE GIFT LINK (FIXED TO ALWAYS SHOW CODE) =================
// ================= SHARE GIFT LINK (COPYABLE VERSION) =================
function shareGiftLink(giftLinkCode) {
    // Show code in a prompt so user can copy it
    prompt('Copy this gift code to share (Ctrl+C or Cmd+C):', giftLinkCode);
    
    // Also try to copy to clipboard automatically
    if (navigator.clipboard) {
        navigator.clipboard.writeText(giftLinkCode).then(() => {
            alert('✅ Code copied to clipboard!\n\nShare: ' + giftLinkCode);
        }).catch(() => {
            // User already has the prompt to copy from
        });
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showSuccess(`Code copied!\n\n${text}\n\nShare this code to let others contribute.`);
    }).catch(() => {
        promptCopyCode(text);
    });
}

function promptCopyCode(code) {
    prompt('Copy this gift code to share:', code);
}
// ================= HELPER FUNCTIONS =================
function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function getCategoryIcon(category) {
    const icons = {
        'TRANSPORTATION': '🚗',
        'HOUSING': '🏠',
        'EDUCATION': '📚',
        'TRAVEL': '✈️',
        'EMERGENCY': '🆘',
        'GADGETS': '📱',
        'HEALTH': '💊',
        'OTHER': '🎯'
    };
    return icons[category] || '🎯';
}
function getStreakEmoji(streakPower) {
    const emojis = {
        'INFERNO': '🔥🔥🔥',
        'LAVA':    '🔥🔥',
        'FIRE':    '🔥',
        'FLAME':   '💥',
        'HOT':     '🌟',   // ← ADD THIS
        'SPARK':   '✨',
        'NONE':    '⭐'
    };
    return emojis[streakPower] || '⭐';
}


function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showSuccess(message) {
    alert('✅ ' + message);
}

function showError(message) {
    alert('❌ ' + message);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const createModal = document.getElementById('createGoalModal');
    const detailsModal = document.getElementById('goalDetailsModal');
    const cropModal = document.getElementById('imageCropModal');
    
    if (createModal && event.target === createModal) {
        closeCreateGoalModal();
    }
    if (detailsModal && event.target === detailsModal) {
        closeGoalDetailsModal();
    }
    if (cropModal && event.target === cropModal) {
        closeImageCropModal();
    }
}

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
    loadUserGoals();
    
    // Set minimum date for goal creation (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    const dateInput = document.querySelector('input[name="targetDate"]');
    if (dateInput) {
        dateInput.min = minDate;
    }

    initializeGoalImageCropper();
});
