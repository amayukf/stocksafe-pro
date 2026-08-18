// StockSafe Pro - Barcode Scanner Engine (Quagga2 Compatible, Battery Protected)
let scannerActive = false;
let scannerTimer = null;

function stopScanner(containerId) {
    if (scannerTimer) {
        clearTimeout(scannerTimer);
        scannerTimer = null;
    }
    if (typeof Quagga !== 'undefined' && scannerActive) {
        try {
            Quagga.stop();
        } catch (e) {
            console.warn('[Scanner] Stop error (non-fatal):', e);
        }
    }
    scannerActive = false;
    const container = document.getElementById(containerId);
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
    const stopBtnId = containerId === 'scanner-container' ? 'stop-scan-btn' : 'stop-scan-sell-btn';
    const stopBtn = document.getElementById(stopBtnId);
    if (stopBtn) stopBtn.style.display = 'none';
}

function startScanner(containerId, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Check if Quagga2 or original Quagga is loaded
    if (typeof Quagga === 'undefined') {
        showToast('Barcode scanner library not loaded. Please enter barcode manually.', 'error');
        return;
    }

    // Toggle off if currently active
    if (scannerActive) {
        stopScanner(containerId);
        return;
    }

    container.style.display = 'block';
    container.innerHTML = '';
    scannerActive = true;

    const stopBtnId = containerId === 'scanner-container' ? 'stop-scan-btn' : 'stop-scan-sell-btn';
    const stopBtn = document.getElementById(stopBtnId);
    if (stopBtn) stopBtn.style.display = 'inline-flex';

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: container,
            constraints: {
                facingMode: "environment",
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        },
        decoder: {
            readers: [
                "ean_reader",
                "ean_8_reader",
                "upc_reader",
                "upc_e_reader"
            ]
        },
        locate: true,
        locator: {
            halfSample: true,
            patchSize: "medium"
        }
    }, function(err) {
        if (err) {
            console.error('[Scanner] Init error:', err);
            let msg = 'Camera error. ';
            if (err.name === 'NotAllowedError' || (err.message && err.message.includes('Permission'))) {
                msg += 'Camera permission denied. Please allow camera access in your browser settings.';
            } else if (err.name === 'NotFoundError') {
                msg += 'No camera found on this device.';
            } else if (err.message && err.message.includes('secure')) {
                msg += 'Camera requires HTTPS. Use HTTPS or localhost to enable scanning.';
            } else {
                msg += 'Please enter barcode manually.';
            }
            showToast(msg, 'error');
            stopScanner(containerId);
            return;
        }
        Quagga.start();

        // Battery Protection: Auto-stop after 30 seconds
        if (scannerTimer) clearTimeout(scannerTimer);
        scannerTimer = setTimeout(() => {
            if (scannerActive) {
                console.warn('[Scanner] 30s timeout to save battery.');
                stopScanner(containerId);
                showToast('Camera stopped after 30 seconds to save battery.', 'warning');
            }
        }, 30000);
    });

    let scanLastResult = '';
    let scanReadingCount = 0;

    // Only register once
    Quagga.offDetected();
    Quagga.onDetected(function(result) {
        if (!result || !result.codeResult || !result.codeResult.code) return;
        const code = result.codeResult.code;
        
        // Retail barcodes are generally at least 8 digits.
        if (code.length < 8) return;

        if (code === scanLastResult) {
            scanReadingCount++;
            if (scanReadingCount >= 5) { // Require 5 identical frames
                console.log('[Scanner] Confirmed Detected:', code);
                if (typeof playAudio === 'function') playAudio('beep');
                stopScanner(containerId);
                if (callback) callback(code);
                scanLastResult = '';
                scanReadingCount = 0;
            }
        } else {
            // New reading, reset count
            scanLastResult = code;
            scanReadingCount = 1;
        }
    });
}

// Auto-stop on page leave or tab switch
window.addEventListener('beforeunload', () => {
    stopScanner('scanner-container');
    stopScanner('scanner-sell-container');
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopScanner('scanner-container');
        stopScanner('scanner-sell-container');
    }
});

// Button listeners
document.addEventListener('DOMContentLoaded', function() {
    // Add Product page
    const scanBtn = document.getElementById('scan-btn');
    if (scanBtn) {
        scanBtn.addEventListener('click', function(e) {
            e.preventDefault();
            startScanner('scanner-container', function(barcode) {
                const input = document.getElementById('barcode');
                if (input) input.value = barcode;
                fetchProductByBarcode(barcode);
            });
        });
    }

    const stopScanBtn = document.getElementById('stop-scan-btn');
    if (stopScanBtn) {
        stopScanBtn.addEventListener('click', function(e) {
            e.preventDefault();
            stopScanner('scanner-container');
        });
    }

    // Sell page
    const scanSellBtn = document.getElementById('scan-sell-btn');
    if (scanSellBtn) {
        scanSellBtn.addEventListener('click', function(e) {
            e.preventDefault();
            startScanner('scanner-sell-container', async function(barcode) {
                const searchInput = document.getElementById('search-product');
                if (searchInput) searchInput.value = barcode;
                const product = await getProductByBarcode(barcode);
                if (product) {
                    selectProductForSale(product.id, product.name, product.quantity, product.price);
                } else {
                    showToast('No product found with barcode: ' + barcode, 'warning');
                    searchProducts(barcode);
                }
            });
        });
    }

    const stopScanSellBtn = document.getElementById('stop-scan-sell-btn');
    if (stopScanSellBtn) {
        stopScanSellBtn.addEventListener('click', function(e) {
            e.preventDefault();
            stopScanner('scanner-sell-container');
        });
    }
});

async function fetchProductByBarcode(barcode) {
    const product = await getProductByBarcode(barcode);
    if (product) {
        const nameInput = document.getElementById('product-name');
        const qtyInput = document.getElementById('quantity');
        const priceInput = document.getElementById('price');
        const categoryInput = document.getElementById('category');
        const idInput = document.getElementById('product-id');
        const deleteBtn = document.getElementById('delete-btn');

        if (nameInput) nameInput.value = product.name;
        if (qtyInput) qtyInput.value = product.quantity;
        if (priceInput) priceInput.value = product.price;
        if (categoryInput) categoryInput.value = product.category || '';
        if (idInput) idInput.value = product.id;
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    }
}

// Search for sell page
async function searchProducts(query) {
    const resultsDiv = document.getElementById('search-results');
    if (!resultsDiv) return;

    const trimmed = (query || '').trim();
    if (!trimmed) { resultsDiv.innerHTML = ''; return; }

    const allProducts = await getAllProducts();
    const filtered = allProducts.filter(p =>
        (p.name && p.name.toLowerCase().includes(trimmed.toLowerCase())) ||
        (p.barcode && p.barcode.includes(trimmed)) ||
        (p.category && p.category.toLowerCase().includes(trimmed.toLowerCase()))
    );

    if (filtered.length === 0) {
        resultsDiv.innerHTML = '<div class="empty-state" style="padding:12px;"><p>No products found</p></div>';
        return;
    }

    resultsDiv.innerHTML = filtered.map((p, index) => `
        <div class="product-item slide-in" onclick="selectProductForSale(${p.id}, '${escapeHtml(p.name)}', ${p.quantity}, ${p.price})" style="cursor:pointer; margin-bottom:4px; animation-delay: ${index * 0.03}s">
            <div class="product-info">
                <span class="name">${escapeHtml(p.name)}</span>
                <span class="barcode">${escapeHtml(p.barcode)}</span>
            </div>
            <div class="product-price-box">
                <span class="qty">${p.quantity} in stock</span>
                <span class="price">${p.price} ETB</span>
            </div>
        </div>
    `).join('');
}

function selectProductForSale(id, name, stock, price) {
    const selectedBox = document.getElementById('selected-product');
    const nameElem = document.getElementById('selected-name');
    const stockElem = document.getElementById('selected-stock');
    const priceElem = document.getElementById('selected-price');
    const qtyInput = document.getElementById('sell-quantity');
    const resultsDiv = document.getElementById('search-results');
    const searchInput = document.getElementById('search-product');

    if (selectedBox) selectedBox.style.display = 'block';
    if (nameElem) nameElem.textContent = name;
    if (stockElem) stockElem.textContent = stock;
    if (priceElem) priceElem.textContent = price;
    if (qtyInput) { qtyInput.max = stock; qtyInput.value = stock > 0 ? 1 : 0; }
    if (resultsDiv) resultsDiv.innerHTML = '';
    if (searchInput) searchInput.value = name;

    window._selectedProductId = id;
    window._selectedProductPrice = price;
}

async function processSale() {
    const id = window._selectedProductId;
    const qtyInput = document.getElementById('sell-quantity');
    if (!id || !qtyInput) { showToast('Select a product first.', 'warning'); return; }

    const qty = parseInt(qtyInput.value, 10);
    if (isNaN(qty) || qty <= 0) { showToast('Enter a valid quantity.', 'warning'); return; }

    const product = await getProductById(id);
    if (!product) { 
        if (typeof playAudio === 'function') playAudio('error');
        showToast('Product not found.', 'error'); 
        return; 
    }
    if (qty > product.quantity) { 
        if (typeof playAudio === 'function') playAudio('error');
        showToast('Not enough stock. Only ' + product.quantity + ' available.', 'error'); 
        return; 
    }

    const result = await recordSale(id, product.name, qty, product.price, product.costPrice || 0);
    if (typeof playAudio === 'function') playAudio('success');
    showToast(`Sale recorded!\nProduct: ${product.name}\nQuantity: ${qty}\nTotal: ${result.total} ETB`, 'success');

    const selectedBox = document.getElementById('selected-product');
    const searchInput = document.getElementById('search-product');
    if (selectedBox) selectedBox.style.display = 'none';
    if (searchInput) searchInput.value = '';
    window._selectedProductId = null;
}
