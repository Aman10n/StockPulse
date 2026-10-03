/**
 * StockPulse — Shared JavaScript Utilities
 * ==========================================
 */

// ─── Format helpers ──────────────────────────────────────────
function formatCurrency(val, symbol = '$') {
    if (val == null || isNaN(val)) return '—';
    return symbol + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(val) {
    if (val == null || isNaN(val)) return '—';
    const sign = val >= 0 ? '+' : '';
    return sign + Number(val).toFixed(2) + '%';
}

function formatNumber(val, decimals = 2) {
    if (val == null || isNaN(val)) return '—';
    return Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pnlClass(val) {
    if (val == null) return 'text-neutral';
    return val >= 0 ? 'text-profit' : 'text-loss';
}

function pnlArrow(val) {
    if (val == null) return '';
    return val >= 0 ? '<i class="bi bi-caret-up-fill"></i>' : '<i class="bi bi-caret-down-fill"></i>';
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
}

// ─── API Fetch Wrapper ───────────────────────────────────────
async function api(url, options = {}) {
    try {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || 'API Error');
        }
        // Check if response might be a file download
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/csv') || ct.includes('application/pdf')) {
            return res;
        }
        return await res.json();
    } catch (err) {
        console.error(`API Error [${url}]:`, err);
        showToast(err.message, 'danger');
        throw err;
    }
}

// ─── Toast Notifications ─────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const colors = {
        info: 'var(--accent-primary)',
        success: 'var(--green)',
        danger: 'var(--red)',
        warning: 'var(--yellow)',
    };
    const icons = {
        info: 'bi-info-circle',
        success: 'bi-check-circle',
        danger: 'bi-exclamation-triangle',
        warning: 'bi-exclamation-circle',
    };

    const toastId = 'toast-' + Date.now();
    const role = type === 'danger' || type === 'warning' ? 'alert' : 'status';
    const html = `
        <div id="${toastId}" class="toast show fade-in" role="${role}" style="border-left: 3px solid ${colors[type] || colors.info}">
            <div class="toast-body d-flex align-items-center gap-2">
                <i class="bi ${icons[type] || icons.info}" style="color:${colors[type] || colors.info}; font-size:16px"></i>
                <span class="flex-grow-1">${escapeHtml(message)}</span>
                <button type="button" class="toast-dismiss" aria-label="Dismiss notification" onclick="this.closest('.toast').remove()"><i class="bi bi-x"></i></button>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
        const el = document.getElementById(toastId);
        if (el) el.remove();
    }, 4000);
}

// ─── Market Status Updater ───────────────────────────────────
async function updateMarketStatus() {
    try {
        const data = await api('/api/market-status');
        document.querySelectorAll('.market-badge, .market-badge-top').forEach(el => {
            el.setAttribute('data-status', data.status);
            el.querySelector('.status-text').textContent = data.label;
        });
    } catch (e) { /* silent */ }
}

// ─── Live Clock ──────────────────────────────────────────────
function startClock() {
    const el = document.getElementById('live-clock');
    if (!el) return;
    const tick = () => {
        const now = new Date();
        el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    tick();
    setInterval(tick, 1000);
}

// ─── Alert Sound ─────────────────────────────────────────────
function playAlertSound() {
    const audio = document.getElementById('alert-sound');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
}

// ─── Browser Notifications ───────────────────────────────────
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/static/img/icon.png' });
    }
}

function applyTheme(theme) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = normalized;
    document.documentElement.dataset.bsTheme = normalized;
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    const isDark = normalized === 'dark';
    toggle.innerHTML = `<i class="bi bi-${isDark ? 'sun' : 'moon-stars'}"></i>`;
    toggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
}

function updateConnectionStatus() {
    const indicator = document.getElementById('connection-status');
    if (!indicator) return;
    const online = navigator.onLine;
    indicator.classList.toggle('offline', !online);
    indicator.innerHTML = `<span></span> ${online ? 'Online' : 'Offline'}`;
}

function labelResponsiveTable(table) {
    if (!table) return;
    const labels = [...table.querySelectorAll('thead th')].map(cell => cell.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row => {
        [...row.children].forEach((cell, index) => {
            if (!cell.querySelector('.empty-state')) cell.dataset.label = labels[index] || '';
        });
    });
}

// ─── Startup ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('stockpulse-theme');
    const preferredTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    applyTheme(savedTheme || preferredTheme);
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('stockpulse-theme', next);
        applyTheme(next);
    });
    startClock();
    updateConnectionStatus();
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    updateMarketStatus();

    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    const backdrop = document.getElementById('sidebar-backdrop');
    const closeSidebar = () => {
        sidebar?.classList.remove('open');
        backdrop?.classList.remove('show');
        toggle?.setAttribute('aria-expanded', 'false');
    };
    toggle?.addEventListener('click', () => {
        const isOpen = sidebar?.classList.toggle('open');
        backdrop?.classList.toggle('show', Boolean(isOpen));
        toggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
    });
    backdrop?.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeSidebar();
    });

    // Refresh market status every 60s
    setInterval(updateMarketStatus, 60000);
});
