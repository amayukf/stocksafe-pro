// StockSafe Pro - Main Application Controller

// Global Utility - escapeHtml (must be in app.js since it's loaded on every page)
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Global Utility - Toast Notifications
function showToast(message, type = 'default') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconHtml = '<span>&#x2139;</span>'; // info
    if (type === 'success') iconHtml = '<span>&#x2713;</span>'; // check
    if (type === 'error') iconHtml = '<span>&#x26A0;</span>'; // warning
    if (type === 'warning') iconHtml = '<span>&#x26A0;</span>'; // warning

    toast.innerHTML = `
        <div class="toast-icon">${iconHtml}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.3s forwards';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 4000);
}

document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    loadStoreNameHeader();
    loadDashboard();
    highlightActiveNav();

    // Product Form Submit Listener (add-product.html)
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const productId = document.getElementById('product-id') ? document.getElementById('product-id').value : null;
            const barcode = document.getElementById('barcode').value;
            const name = document.getElementById('product-name').value;
            const qty = parseInt(document.getElementById('quantity').value);
            const price = parseFloat(document.getElementById('price').value);
            const costPriceInput = document.getElementById('cost-price');
            const costPrice = costPriceInput && costPriceInput.value ? parseFloat(costPriceInput.value) : 0;
            const category = document.getElementById('category') ? document.getElementById('category').value : '';

            if (!barcode || !name || isNaN(qty) || isNaN(price)) {
                showToast('Please complete all required fields.', 'warning');
                return;
            }

            const result = await saveProduct(productId, barcode, name, qty, price, category, costPrice);
            showToast(result.message, result.success ? 'success' : 'error');

            if (result.success) {
                productForm.reset();
                const idInput = document.getElementById('product-id');
                const deleteBtn = document.getElementById('delete-btn');
                if (idInput) idInput.value = '';
                if (deleteBtn) deleteBtn.style.display = 'none';

                if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/stocksafe/')) {
                    loadDashboard();
                } else {
                    window.location.href = 'index.html';
                }
            }
        });
    }

    // Delete button
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            const idInput = document.getElementById('product-id');
            if (!idInput || !idInput.value) return;
            const id = parseInt(idInput.value, 10);

            if (confirm('Delete entirely from database?')) {
                await deleteProduct(id);
                showToast('Product deleted.', 'success');
                window.location.href = 'index.html';
            }
        });
    }
});

// ---------- DASHBOARD ----------
async function loadDashboard() {
    const container = document.getElementById('product-container');
    if (!container) return;

    try {
        const products = await getAllProducts();
        const lowStock = await getLowStockProducts(5);
        const allSales = await getAllSales(); // We need all sales for the 7-day chart
        
        const currentStore = await (typeof getCurrentStore === 'function' ? getCurrentStore() : Promise.resolve('Main Store'));
        
        const storeProducts = products.filter(p => p.storeName === currentStore);
        const storeLowStock = lowStock.filter(p => p.storeName === currentStore);
        
        const todayStr = new Date().toISOString().split('T')[0];
        const storeSales = allSales.filter(s => s.storeName === currentStore);
        const todaySales = storeSales.filter(s => s.dateSold.startsWith(todayStr));

        const totalElem = document.getElementById('total-products');
        const lowElem = document.getElementById('low-stock-count');
        const salesElem = document.getElementById('today-sales');
        const revenueElem = document.getElementById('today-revenue');

        if (totalElem) totalElem.textContent = products.length;
        if (lowElem) lowElem.textContent = lowStock.length;
        if (salesElem) salesElem.textContent = todaySales.length;

        const revenue = todaySales.reduce((sum, s) => sum + (s.totalPrice || 0), 0);
        if (revenueElem) revenueElem.textContent = revenue.toFixed(2) + ' ETB';

        renderRevenueChart(storeSales);

        if (storeProducts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-state-icon">&#x2014;</span>
                    <h3>No Products Yet</h3>
                    <p>Add your first product to get started.</p>
                </div>`;
            return;
        }

        const searchFilter = document.getElementById('search-catalog');
        const query = searchFilter ? searchFilter.value.toLowerCase().trim() : '';

        const displayed = query ? storeProducts.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.barcode.includes(query) ||
            (p.category && p.category.toLowerCase().includes(query))
        ) : storeProducts;

        if (displayed.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No products match "${escapeHtml(query)}"</p>
                </div>`;
            return;
        }

        container.innerHTML = displayed.map((p, index) => `
            <div class="product-item slide-in ${p.quantity <= 5 ? 'low-stock' : ''}" onclick="openEditProduct('${p.barcode}')" style="cursor:pointer; animation-delay: ${index * 0.03}s">
                <div class="product-info">
                    <span class="name">${escapeHtml(p.name)}</span>
                    <span class="barcode">${escapeHtml(p.barcode)}</span>
                    ${p.category ? `<span class="badge badge-category">${escapeHtml(p.category)}</span>` : ''}
                    ${p.quantity <= 5 ? '<span class="badge badge-danger">Low Stock</span>' : ''}
                </div>
                <div class="product-price-box">
                    <span class="qty">${p.quantity} units</span>
                    <span class="price">${parseFloat(p.price).toFixed(2)} ETB</span>
                </div>
            </div>
        `).join('');

    } catch (err) {
        container.innerHTML = `<p class="loading" style="color:var(--red)">Error: ${err.message}</p>`;
    }
}

function openEditProduct(barcode) {
    window.location.href = `add-product.html?barcode=${encodeURIComponent(barcode)}`;
}

let revenueChartInstance = null;

function renderRevenueChart(storeSales) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded');
        return;
    }

    // Group sales by past 7 days
    const last7Days = [];
    const revenueData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
        revenueData.push(0);
    }

    storeSales.forEach(sale => {
        const dateStr = sale.dateSold.split('T')[0];
        const dayIndex = last7Days.indexOf(dateStr);
        if (dayIndex !== -1) {
            revenueData[dayIndex] += (sale.totalPrice || 0);
        }
    });

    const displayLabels = last7Days.map(dStr => {
        const d = new Date(dStr);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    });

    if (revenueChartInstance) {
        revenueChartInstance.destroy();
    }

    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f3f4f6' : '#4b5563';
    const gridColor = isDark ? '#262d3d' : '#e5e7eb';

    revenueChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Revenue (ETB)',
                data: revenueData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor, maxTicksLimit: 5 },
                    grid: { color: gridColor, drawBorder: false }
                },
                x: {
                    ticks: { color: textColor },
                    grid: { display: false, drawBorder: false }
                }
            }
        }
    });
}

// ---------- HEADER ----------
async function loadStoreNameHeader() {
    const el = document.getElementById('store-name');
    if (el) {
        el.textContent = await getCurrentStore();
    }
}

// ---------- NAV ----------
function highlightActiveNav() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const path = window.location.pathname;
    navItems.forEach(item => {
        item.classList.remove('active');
        const href = item.getAttribute('onclick') || '';
        if (href.includes('index.html') && (path.endsWith('/') || path.endsWith('index.html'))) {
            item.classList.add('active');
        } else if (href.includes('add-product') && path.includes('add-product')) {
            item.classList.add('active');
        } else if (href.includes('sell.html') && path.includes('sell.html')) {
            item.classList.add('active');
        } else if (href.includes('sales-history') && path.includes('sales-history')) {
            item.classList.add('active');
        } else if (href.includes('settings') && path.includes('settings')) {
            item.classList.add('active');
        }
    });
}

// ---------- THEME ----------
function initTheme() {
    const saved = localStorage.getItem('stocksafe_theme');
    if (saved === 'dark') {
        document.body.classList.add('dark-mode', 'dark-theme');
        document.body.classList.remove('light-theme');
    } else if (saved === 'light') {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-mode', 'dark-theme');
    }
}

function toggleDarkMode() {
    if (document.body.classList.contains('dark-mode') || document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-mode', 'dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('stocksafe_theme', 'light');
    } else {
        document.body.classList.add('dark-mode', 'dark-theme');
        document.body.classList.remove('light-theme');
        localStorage.setItem('stocksafe_theme', 'dark');
    }
}

// ---------- AUDIO SYSTEM ----------
let audioCtx = null;

function playAudio(type) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (type === 'beep') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'success') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1500, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
            
            const osc2 = audioCtx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.1);
            osc2.connect(gainNode);
            osc2.start(audioCtx.currentTime + 0.1);
            osc2.stop(audioCtx.currentTime + 0.4);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    } catch (e) {
        console.warn('Audio play failed', e);
    }
}
