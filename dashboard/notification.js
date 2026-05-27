// Notification Manager Class
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.currentFilter = 'all';
        this.baseURL = `${window.FastPay?.getApiBase?.() || 'http://localhost:8080'}/api/notifications`;
        this.init();
    }

    init() {
        this.checkAuth();
        this.loadNotifications();
        this.attachEventListeners();
    }

    // ✅ Check if user is authenticated
    checkAuth() {
        const token = this.getAuthToken();
        const userId = localStorage.getItem('fastpay_userId');
        
        if (!token || !userId) {
            alert('You must login first.');
            window.location.href = window.FastPay?.getLoginPath?.() || '../signup/login.html';
        }
    }

    // ✅ Get JWT token from localStorage
    getAuthToken() {
        return localStorage.getItem('fastpay_token'); // Changed from 'authToken' to 'fastpay_token'
    }

    // Create headers with JWT token
    getHeaders() {
        const token = this.getAuthToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    }

    // Load notifications from backend
    async loadNotifications() {
        try {
            const response = await fetch(this.baseURL, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.notifications = await response.json();
            this.render();
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showToast('Failed to load notifications', 'error');
        }
    }

    // Attach event listeners
    attachEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilter(e));
        });

        // Mark all as read
        const markAllBtn = document.getElementById('markAllRead');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }

        // Clear all notifications
        const clearAllBtn = document.getElementById('clearAll');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAll();
            });
        }
    }

    // Handle filter change
    handleFilter(e) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.filter;
        this.render();
    }

    // Filter notifications based on current filter
    getFilteredNotifications() {
        if (this.currentFilter === 'all') {
            return this.notifications;
        } else if (this.currentFilter === 'unread') {
            return this.notifications.filter(n => !n.read);
        } else if (this.currentFilter === 'read') {
            return this.notifications.filter(n => n.read);
        }
        return this.notifications;
    }

    // Render notifications
    render() {
        const container = document.getElementById('notificationContainer');
        const emptyState = document.getElementById('emptyState');
        
        if (!container || !emptyState) {
            console.error('Required DOM elements not found');
            return;
        }
        
        const filteredNotifications = this.getFilteredNotifications();

        if (filteredNotifications.length === 0) {
            container.innerHTML = '';
            emptyState.classList.add('show');
            return;
        }

        emptyState.classList.remove('show');
        container.innerHTML = filteredNotifications.map(notification => 
            this.createNotificationHTML(notification)
        ).join('');

        // Attach click listeners to notification items
        container.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('action-btn')) {
                    const id = item.dataset.id;
                    this.markAsRead(id);
                }
            });
        });

        // Attach action button listeners
        container.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('.notification-item').dataset.id;
                const action = btn.dataset.action;
                this.handleAction(id, action);
            });
        });
    }

    // Create notification HTML
    createNotificationHTML(notification) {
        return `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}" data-id="${notification.id}">
                <span class="notification-type ${notification.type}">${notification.type}</span>
                <div class="notification-header">
                    <div>
                        <div class="notification-title">${notification.title}</div>
                        <div class="notification-time">${notification.time}</div>
                    </div>
                </div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-actions">
                    ${!notification.read ? 
                        '<button class="action-btn action-btn-primary" data-action="read">Mark as Read</button>' : 
                        ''
                    }
                    <button class="action-btn action-btn-secondary" data-action="delete">Delete</button>
                </div>
            </div>
        `;
    }

    // Mark notification as read
    async markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification && !notification.read) {
            try {
                const response = await fetch(`${this.baseURL}/${id}/read`, {
                    method: 'POST',
                    headers: this.getHeaders()
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                notification.read = true;
                this.render();
                this.showToast('Notification marked as read', 'success');
            } catch (error) {
                console.error('Error marking notification as read:', error);
                this.showToast('Failed to update notification', 'error');
            }
        }
    }

    // Mark all notifications as read
    async markAllAsRead() {
        try {
            const response = await fetch(`${this.baseURL}/read-all`, {
                method: 'POST',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.notifications.forEach(n => n.read = true);
            this.render();
            this.showToast('All notifications marked as read', 'success');
        } catch (error) {
            console.error('Error marking all as read:', error);
            this.showToast('Failed to update notifications', 'error');
        }
    }

    // Delete notification
    async deleteNotification(id) {
        try {
            const response = await fetch(`${this.baseURL}/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.notifications = this.notifications.filter(n => n.id !== id);
            this.render();
            this.showToast('Notification deleted', 'success');
        } catch (error) {
            console.error('Error deleting notification:', error);
            this.showToast('Failed to delete notification', 'error');
        }
    }

    // Clear all notifications
    async clearAll() {
        if (confirm('Are you sure you want to delete all notifications?')) {
            try {
                const response = await fetch(this.baseURL, {
                    method: 'DELETE',
                    headers: this.getHeaders()
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                this.notifications = [];
                this.render();
                this.showToast('All notifications cleared', 'success');
            } catch (error) {
                console.error('Error clearing notifications:', error);
                this.showToast('Failed to clear notifications', 'error');
            }
        }
    }

    // Handle action buttons
    handleAction(id, action) {
        switch (action) {
            case 'read':
                this.markAsRead(id);
                break;
            case 'delete':
                this.deleteNotification(id);
                break;
            default:
                console.log(`Action ${action} for notification ${id}`);
        }
    }

    // Show toast notification
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = `toast ${type} show`;
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        } else {
            console.warn('Toast element not found');
        }
    }

    // Get unread count from backend
    async getUnreadCount() {
        try {
            const response = await fetch(`${this.baseURL}/unread-count`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.count || 0;
        } catch (error) {
            console.error('Error fetching unread count:', error);
            return 0;
        }
    }

    // Refresh notifications (useful for polling or manual refresh)
    async refresh() {
        await this.loadNotifications();
    }
    
}

// Initialize notification manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.notificationManager = new NotificationManager();
});
