/**
 * StockPulse — Dashboard Logic
 */

let refreshInterval = null;

async function loadDashboard() {
    try {
        const data = await api('/api/portfolio/summary');
        const alertsData = await api('/api/alerts');

        // Compute totals
        let totalInvested = 0, totalMarketValue = 0, totalPnl = 0, holdingCount = 0;
        data.forEach(item => {
            totalInvested += item.total_invested || 0;
            totalMarketValue += item.market_value || 0;
            totalPnl += item.pnl || 0;
            holdingCount += item.entries ? item.entries.length : 0;
        });

        const totalPnlPct = totalInvested > 0 ? ((totalMarketValue - totalInvested) / totalInvested) * 100 : 0;

        // Update summary cards
        document.getElementById('total-invested').textContent = formatCurrency(totalInvested);
        document.getElementById('total-holdings').textContent = `${holdingCount} holding${holdingCount !== 1 ? 's' : ''} · ${data.length} ticker${data.length !== 1 ? 's' : ''}`;

        document.getElementById('market-value').textContent = formatCurrency(totalMarketValue || null);
        document.getElementById('market-value-sub').innerHTML = totalMarketValue
            ? `${pnlArrow(totalPnl)} ${formatCurrency(Math.abs(totalPnl))}`
            : 'Waiting for market data…';
        document.getElementById('market-value-sub').className = `sub ${pnlClass(totalPnl)}`;

        const pnlEl = document.getElementById('total-pnl');
        pnlEl.textContent = formatCurrency(totalPnl);
        pnlEl.className = `value ${pnlClass(totalPnl)}`;

        const pnlPctEl = document.getElementById('total-pnl-pct');
        pnlPctEl.innerHTML = `${pnlArrow(totalPnlPct)} ${formatPercent(totalPnlPct)}`;
        pnlPctEl.className = `sub ${pnlClass(totalPnlPct)}`;

        // Alerts count
        const activeAlerts = alertsData.filter(a => !a.is_triggered).length;
        const triggeredAlerts = alertsData.filter(a => a.is_triggered).length;
        document.getElementById('active-alerts').textContent = activeAlerts;
        document.getElementById('triggered-alerts').textContent = `${triggeredAlerts} triggered`;

        // Render table
        const tbody = document.getElementById('holdings-body');
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state">
                <i class="bi bi-inbox"></i><h4>No Holdings Yet</h4>
                <p>Add stocks from the <a href="/portfolio">Portfolio</a> page to see live data here.</p>
            </div></td></tr>`;
        } else {
            tbody.innerHTML = data.map(item => `
                <tr>
                    <td class="ticker-cell">${item.ticker}</td>
                    <td class="name-cell">${item.name || '—'}</td>
                    <td><span class="sector-badge">${item.sector || 'N/A'}</span></td>
                    <td>${formatCurrency(item.avg_cost)}</td>
                    <td>${formatNumber(item.total_qty, 2)}</td>
                    <td>${formatCurrency(item.total_invested)}</td>
                    <td style="font-weight:600">${formatCurrency(item.current_price)}</td>
                    <td>${formatCurrency(item.market_value)}</td>
                    <td class="${pnlClass(item.pnl)}" style="font-weight:600">
                        ${pnlArrow(item.pnl)} ${formatCurrency(item.pnl != null ? Math.abs(item.pnl) : null)}
                    </td>
                    <td class="${pnlClass(item.pnl_pct)}" style="font-weight:600">
                        ${formatPercent(item.pnl_pct)}
                    </td>
                </tr>
            `).join('');
        }

        // Update timestamp
        const now = new Date();
        document.getElementById('last-updated').innerHTML =
            `<i class="bi bi-clock me-1"></i>Updated ${now.toLocaleTimeString()}`;

    } catch (e) {
        console.error('Dashboard load error:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(loadDashboard, 30000);
});
