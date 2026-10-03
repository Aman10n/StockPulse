/**
 * StockPulse — Analytics & Reporting Logic
 */

let historyChart = null;
let sectorChart = null;
let currentPeriod = '1mo';
let currentTicker = '';

// ─── Chart.js Global Defaults ────────────────────────────────
Chart.defaults.color = '#9eb0c5';
Chart.defaults.borderColor = 'rgba(148,163,184,0.12)';
Chart.defaults.font.family = "'DM Sans', sans-serif";

// ─── Historical Performance Chart ────────────────────────────
async function loadChart() {
    const ticker = document.getElementById('chart-ticker').value.trim().toUpperCase();
    if (!ticker) {
        showToast('Please enter a ticker symbol', 'warning');
        return;
    }

    currentTicker = ticker;
    const btn = document.getElementById('load-chart-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Loading…';

    try {
        const data = await api(`/api/history/${ticker}?period=${currentPeriod}`);

        document.getElementById('chart-empty').style.display = 'none';
        document.getElementById('history-chart-container').style.display = 'block';

        const labels = data.map(d => d.date);
        const prices = data.map(d => d.close);

        // Gradient fill
        const ctx = document.getElementById('history-chart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        const isPositive = prices[prices.length - 1] >= prices[0];
        if (isPositive) {
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        } else {
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
        }

        if (historyChart) historyChart.destroy();

        historyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: `${ticker} Close Price`,
                    data: prices,
                    borderColor: isPositive ? '#10b981' : '#ef4444',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: isPositive ? '#10b981' : '#ef4444',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#e5e7eb',
                        bodyColor: '#e5e7eb',
                        borderColor: 'rgba(99, 102, 241, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: ctx => `$${ctx.parsed.y.toFixed(2)}`,
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: { maxTicksLimit: 10, font: { size: 11 } },
                        grid: { display: false },
                    },
                    y: {
                        ticks: {
                            font: { size: 11 },
                            callback: val => '$' + val.toFixed(0),
                        },
                        grid: { color: 'rgba(255,255,255,0.04)' },
                    },
                },
            },
        });
    } catch (e) {
        document.getElementById('chart-empty').style.display = 'block';
        document.getElementById('history-chart-container').style.display = 'none';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-search me-1"></i>Search';
    }
}

// ─── Period Tab Switching ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.period-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentPeriod = tab.dataset.period;
            if (currentTicker) loadChart();
        });
    });

    loadSectorChart();
});

// ─── Sector Pie Chart ────────────────────────────────────────
async function loadSectorChart() {
    try {
        const data = await api('/api/portfolio/distribution');
        const labels = Object.keys(data);
        const values = Object.values(data);

        if (labels.length === 0) return;

        const colors = [
            '#6366f1', '#8b5cf6', '#a78bfa', '#3b82f6', '#10b981',
            '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316',
            '#06b6d4'
        ];

        const ctx = document.getElementById('sector-chart').getContext('2d');
        if (sectorChart) sectorChart.destroy();

        sectorChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: 'rgba(10, 14, 23, 0.8)',
                    borderWidth: 3,
                    hoverOffset: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 16,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { size: 11, weight: '500' },
                        },
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#e5e7eb',
                        bodyColor: '#e5e7eb',
                        borderColor: 'rgba(99, 102, 241, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: ctx => ` ${ctx.label}: $${ctx.parsed.toFixed(2)} (${((ctx.parsed / ctx.dataset.data.reduce((a,b) => a+b, 0)) * 100).toFixed(1)}%)`,
                        },
                    },
                },
            },
        });
    } catch (e) {}
}

// ─── Export Functions ────────────────────────────────────────
async function exportCSV() {
    try {
        const res = await fetch('/api/export/csv');
        const blob = await res.blob();
        downloadBlob(blob, 'portfolio_export.csv');
        showToast('CSV exported successfully!', 'success');
    } catch (e) {
        showToast('Export failed', 'danger');
    }
}

async function exportPDF() {
    try {
        const res = await fetch('/api/export/pdf');
        const blob = await res.blob();
        downloadBlob(blob, 'portfolio_report.pdf');
        showToast('PDF exported successfully!', 'success');
    } catch (e) {
        showToast('Export failed', 'danger');
    }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
