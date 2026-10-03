/**
 * StockPulse — Smart Alerts Logic
 */

let alertCheckInterval = null;

// ─── Load Alerts ─────────────────────────────────────────────
async function loadAlerts() {
    try {
        const alerts = await api('/api/alerts');
        const active = alerts.filter(a => !a.is_triggered);
        const triggered = alerts.filter(a => a.is_triggered);
        document.getElementById('alert-active-count').textContent = active.length;
        document.getElementById('alert-triggered-count').textContent = triggered.length;

        // Active alerts table
        const activeBody = document.getElementById('active-alerts-body');
        if (active.length === 0) {
            activeBody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
                <i class="bi bi-bell-slash"></i><h4>No Active Alerts</h4><p>Create an alert above to get started.</p>
            </div></td></tr>`;
        } else {
            activeBody.innerHTML = active.map(a => `
                <tr>
                    <td class="ticker-cell">${a.ticker}</td>
                    <td>
                        <span style="color:${a.alert_type === 'stop-loss' ? 'var(--red)' : 'var(--green)'}; font-weight:600; font-size:12px">
                            ${a.alert_type === 'stop-loss' ? '🔻 Stop-Loss' : '🔺 Take-Profit'}
                        </span>
                    </td>
                    <td style="font-weight:600">${formatCurrency(a.threshold_price)}</td>
                    <td>
                        <span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:20px; background:var(--green-soft); color:var(--green); font-size:11px; font-weight:600">
                            <span style="width:6px; height:6px; border-radius:50%; background:var(--green); animation:pulse-dot 2s infinite"></span>
                            Active
                        </span>
                    </td>
                    <td style="color:var(--text-secondary); font-size:12px">${new Date(a.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-danger-soft btn-sm" onclick="deleteAlert(${a.id})" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        // Triggered alerts table
        const triggeredBody = document.getElementById('triggered-alerts-body');
        if (triggered.length === 0) {
            triggeredBody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:30px">
                <p style="color:var(--text-muted); font-size:13px">No triggered alerts yet</p></div></td></tr>`;
        } else {
            triggeredBody.innerHTML = triggered.map(a => `
                <tr class="alert-flash">
                    <td class="ticker-cell">${a.ticker}</td>
                    <td>
                        <span style="color:${a.alert_type === 'stop-loss' ? 'var(--red)' : 'var(--green)'}; font-weight:600; font-size:12px">
                            ${a.alert_type === 'stop-loss' ? '🔻 Stop-Loss' : '🔺 Take-Profit'}
                        </span>
                    </td>
                    <td style="font-weight:600">${formatCurrency(a.threshold_price)}</td>
                    <td style="color:var(--yellow); font-size:12px">${a.triggered_at ? new Date(a.triggered_at).toLocaleString() : '—'}</td>
                    <td>
                        <button class="btn-danger-soft btn-sm" onclick="deleteAlert(${a.id})" title="Remove">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {}
}

// ─── Create Alert ────────────────────────────────────────────
async function createAlert(e) {
    e.preventDefault();
    requestNotificationPermission();
    const btn = document.getElementById('create-alert-btn');
    btn.disabled = true;

    try {
        await api('/api/alerts', {
            method: 'POST',
            body: JSON.stringify({
                ticker: document.getElementById('alert-ticker').value.toUpperCase(),
                alert_type: document.getElementById('alert-type').value,
                threshold_price: document.getElementById('alert-threshold').value,
            }),
        });
        showToast('Alert created!', 'success');
        document.getElementById('create-alert-form').reset();
        loadAlerts();
    } catch (e) {
    } finally {
        btn.disabled = false;
    }
}

// ─── Delete Alert ────────────────────────────────────────────
async function deleteAlert(id) {
    if (!confirm('Delete this alert?')) return;
    try {
        await api(`/api/alerts/${id}`, { method: 'DELETE' });
        showToast('Alert deleted', 'info');
        loadAlerts();
    } catch (e) {}
}

// ─── Check Alerts ────────────────────────────────────────────
async function checkAlerts() {
    try {
        const triggered = await api('/api/alerts/check');
        if (triggered.length > 0) {
            // Visual & audio feedback
            playAlertSound();
            triggered.forEach(a => {
                const msg = `${a.alert_type === 'stop-loss' ? '🔻 STOP-LOSS' : '🔺 TAKE-PROFIT'} triggered for ${a.ticker} at ${formatCurrency(a.current_price)} (threshold: ${formatCurrency(a.threshold_price)})`;
                showToast(msg, 'warning');
                sendBrowserNotification('StockPulse Alert', msg);
            });
            loadAlerts();
        } else {
            showToast('No alerts triggered', 'info');
        }
        document.getElementById('alert-last-checked').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {}
}

// ─── Startup ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadAlerts();
    // Auto-check alerts every 60 seconds
    alertCheckInterval = setInterval(checkAlerts, 60000);
});
