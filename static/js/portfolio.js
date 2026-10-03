/**
 * StockPulse — Portfolio Management Logic
 */

// ─── Load sector options ─────────────────────────────────────
async function loadSectors() {
    try {
        const sectors = await api('/api/sectors');
        ['inp-sector', 'edit-sector'].forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            // Keep first option for add form (auto-detect)
            const firstOpt = id === 'inp-sector' ? '<option value="">Auto-detect</option>' : '';
            sel.innerHTML = firstOpt + sectors.map(s => `<option value="${s}">${s}</option>`).join('');
        });
    } catch (e) {}
}

// ─── Load holdings ───────────────────────────────────────────
async function loadHoldings() {
    try {
        const holdings = await api('/api/holdings');
        const tbody = document.getElementById('portfolio-body');

        if (holdings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
                <i class="bi bi-inbox"></i><h4>No Holdings</h4><p>Click "Add Holding" to get started.</p>
            </div></td></tr>`;
        } else {
            tbody.innerHTML = holdings.map(h => `
                <tr data-search="${`${h.ticker} ${h.name || ''} ${h.sector || ''}`.toLowerCase()}">
                    <td class="ticker-cell">${h.ticker}</td>
                    <td class="name-cell">${h.name || '—'}</td>
                    <td><span class="sector-badge">${h.sector || 'N/A'}</span></td>
                    <td>${formatCurrency(h.buy_price)}</td>
                    <td>${formatNumber(h.quantity, 2)}</td>
                    <td>${formatCurrency(h.buy_price * h.quantity)}</td>
                    <td style="color:var(--text-secondary); font-size:12px">${h.date_purchased || '—'}</td>
                    <td>
                        <button class="btn-outline-glass btn-sm me-1" onclick="openEditModal(${h.id})" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn-danger-soft btn-sm" onclick="deleteHolding(${h.id})" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        const totalCost = holdings.reduce((sum, h) => sum + (h.buy_price * h.quantity), 0);
        document.getElementById('portfolio-entry-count').textContent = holdings.length;
        document.getElementById('portfolio-ticker-count').textContent = new Set(holdings.map(h => h.ticker)).size;
        document.getElementById('portfolio-cost-basis').textContent = formatCurrency(totalCost);

        // Build weighted average summary
        buildAvgSummary(holdings);
        filterHoldings();
    } catch (e) {}
}

function filterHoldings() {
    const query = document.getElementById('portfolio-search')?.value.trim().toLowerCase() || '';
    document.querySelectorAll('#portfolio-body tr[data-search]').forEach(row => {
        row.hidden = query !== '' && !row.dataset.search.includes(query);
    });
}

// ─── Weighted Average Summary ────────────────────────────────
function buildAvgSummary(holdings) {
    const agg = {};
    holdings.forEach(h => {
        if (!agg[h.ticker]) agg[h.ticker] = { name: h.name, totalQty: 0, totalCost: 0, count: 0 };
        agg[h.ticker].totalQty += h.quantity;
        agg[h.ticker].totalCost += h.buy_price * h.quantity;
        agg[h.ticker].count++;
    });

    const container = document.getElementById('avg-summary-body');
    const tickers = Object.keys(agg);
    if (tickers.length === 0) {
        container.innerHTML = '<p class="text-muted" style="font-size:13px">Add holdings to see weighted averages.</p>';
        return;
    }

    let html = `<table class="data-table"><thead><tr>
        <th>Ticker</th><th>Name</th><th>Entries</th><th>Total Qty</th><th>Weighted Avg Cost</th><th>Total Invested</th>
    </tr></thead><tbody>`;

    tickers.forEach(t => {
        const d = agg[t];
        const avg = d.totalQty > 0 ? d.totalCost / d.totalQty : 0;
        html += `<tr>
            <td class="ticker-cell">${t}</td>
            <td class="name-cell">${d.name || '—'}</td>
            <td>${d.count}</td>
            <td>${formatNumber(d.totalQty, 2)}</td>
            <td style="font-weight:600">${formatCurrency(avg)}</td>
            <td>${formatCurrency(d.totalCost)}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ─── Add Holding ─────────────────────────────────────────────
async function submitHolding(e) {
    e.preventDefault();

    const ticker = document.getElementById('inp-ticker').value.trim();
    const price = document.getElementById('inp-price').value;
    const qty = document.getElementById('inp-qty').value;

    if (!ticker || !price || !qty) {
        showToast('Please fill in the Ticker, Buy Price, and Quantity fields.', 'warning');
        return;
    }

    const btn = document.getElementById('submit-holding-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Adding…';

    try {
        await api('/api/holdings', {
            method: 'POST',
            body: JSON.stringify({
                ticker: document.getElementById('inp-ticker').value,
                name: document.getElementById('inp-name').value,
                buy_price: document.getElementById('inp-price').value,
                quantity: document.getElementById('inp-qty').value,
                date_purchased: document.getElementById('inp-date').value,
                sector: document.getElementById('inp-sector').value,
            }),
        });
        showToast('Holding added successfully!', 'success');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('addHoldingModal')).hide();
        document.getElementById('add-holding-form').reset();
        loadHoldings();
    } catch (e) {
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Add Holding';
    }
}

// ─── Edit Holding ────────────────────────────────────────────
let _allHoldings = [];

async function openEditModal(id) {
    if (_allHoldings.length === 0) {
        _allHoldings = await api('/api/holdings');
    }
    const h = _allHoldings.find(x => x.id === id);
    if (!h) { _allHoldings = await api('/api/holdings'); const hRetry = _allHoldings.find(x => x.id === id); if (!hRetry) return; }
    const holding = _allHoldings.find(x => x.id === id);

    document.getElementById('edit-id').value = holding.id;
    document.getElementById('edit-ticker').value = holding.ticker;
    document.getElementById('edit-name').value = holding.name || '';
    document.getElementById('edit-price').value = holding.buy_price;
    document.getElementById('edit-qty').value = holding.quantity;
    document.getElementById('edit-date').value = holding.date_purchased || '';

    const sel = document.getElementById('edit-sector');
    if (sel) {
        for (let opt of sel.options) {
            if (opt.value === holding.sector) { opt.selected = true; break; }
        }
    }

    new bootstrap.Modal(document.getElementById('editHoldingModal')).show();
}

async function updateHolding(e) {
    e.preventDefault();

    const ticker = document.getElementById('edit-ticker').value.trim();
    const price = document.getElementById('edit-price').value;
    const qty = document.getElementById('edit-qty').value;

    if (!ticker || !price || !qty) {
        showToast('Please fill in the Ticker, Buy Price, and Quantity fields.', 'warning');
        return;
    }

    const id = document.getElementById('edit-id').value;
    try {
        await api(`/api/holdings/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                ticker: document.getElementById('edit-ticker').value,
                name: document.getElementById('edit-name').value,
                buy_price: document.getElementById('edit-price').value,
                quantity: document.getElementById('edit-qty').value,
                date_purchased: document.getElementById('edit-date').value,
                sector: document.getElementById('edit-sector').value,
            }),
        });
        showToast('Holding updated!', 'success');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('editHoldingModal')).hide();
        _allHoldings = [];
        loadHoldings();
    } catch (e) {}
}

// ─── Delete Holding ──────────────────────────────────────────
async function deleteHolding(id) {
    if (!confirm('Are you sure you want to delete this holding?')) return;
    try {
        await api(`/api/holdings/${id}`, { method: 'DELETE' });
        showToast('Holding deleted', 'info');
        _allHoldings = [];
        loadHoldings();
    } catch (e) {}
}

// ─── Bulk CSV Upload ─────────────────────────────────────────
function handleCSVUpload(input) {
    const file = input.files[0];
    if (!file) return;
    uploadCSV(file);
}

async function uploadCSV(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/holdings/bulk', { method: 'POST', body: formData });
        const data = await res.json();

        const resultEl = document.getElementById('upload-result');
        if (data.errors && data.errors.length > 0) {
            resultEl.innerHTML = `
                <div class="alert alert-warning" style="font-size:12px; background:var(--yellow-soft); border-color:rgba(245,158,11,0.3); color:var(--yellow)">
                    <strong>${data.created} holdings added.</strong> ${data.errors.length} error(s):<br>
                    ${data.errors.join('<br>')}
                </div>`;
            showToast(`Imported ${data.created} with ${data.errors.length} errors`, 'warning');
        } else {
            resultEl.innerHTML = `
                <div class="alert alert-success" style="font-size:12px; background:var(--green-soft); border-color:rgba(16,185,129,0.3); color:var(--green)">
                    <strong>Success!</strong> ${data.created} holdings imported.
                </div>`;
            showToast(`${data.created} holdings imported`, 'success');
            bootstrap.Modal.getOrCreateInstance(document.getElementById('bulkUploadModal')).hide();
        }
        loadHoldings();
        input.value = ''; // Reset file input so they can upload same file again
    } catch (e) {
        showToast('Upload failed', 'danger');
    }
}

// Drag & drop
document.addEventListener('DOMContentLoaded', () => {
    loadSectors();
    loadHoldings();
    document.getElementById('portfolio-search')?.addEventListener('input', filterHoldings);
    document.addEventListener('keydown', event => {
        if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
            event.preventDefault();
            document.getElementById('portfolio-search')?.focus();
        }
    });

    const dz = document.getElementById('drop-zone');
    if (dz) {
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
        dz.addEventListener('drop', e => {
            e.preventDefault();
            dz.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.csv')) uploadCSV(file);
            else showToast('Please drop a CSV file', 'warning');
        });
    }
});
