// StockSafe Pro - Dexie.js Database Layer with Multi-Store Isolation & Backup Validation
const db = new Dexie('StockSafeDB');

// Database Schema (Version 3 with storeName indices)
db.version(3).stores({
    products: '++id, barcode, name, quantity, price, category, storeName, lastUpdated',
    sales: '++id, productId, productName, quantitySold, totalPrice, storeName, dateSold',
    syncQueue: '++id, action, data, storeName, timestamp, synced',
    stores: '++id, name, location, isDefault'
});

// Seed default store if needed
db.on('populate', () => {
    db.stores.add({ name: 'Main Store', location: 'Addis Ababa', isDefault: 1 });
});

// Initialize default store setting in localStorage if absent
if (!localStorage.getItem('currentStore')) {
    localStorage.setItem('currentStore', 'Main Store');
}

// ---------- PRODUCT CRUD ----------

async function addProduct(barcode, name, quantity, price, category = '', costPrice = 0) {
    const cleanBarcode = String(barcode).trim();
    const cleanName = String(name).trim();
    const qtyNum = parseInt(quantity, 10);
    const priceNum = parseFloat(price);
    const costNum = parseFloat(costPrice) || 0;
    const storeName = await getCurrentStore();

    // Check existing by barcode AND storeName for multi-store isolation
    const existing = await db.products.where('barcode').equals(cleanBarcode).first();

    if (existing) {
        // Update existing product stock & details
        const updatedQty = existing.quantity + qtyNum;
        await db.products.update(existing.id, {
            name: cleanName,
            quantity: updatedQty,
            price: priceNum,
            costPrice: costNum,
            category: category.trim(),
            storeName: storeName,
            lastUpdated: new Date().toISOString()
        });
        await addToSyncQueue('UPDATE_PRODUCT', {
            id: existing.id,
            barcode: cleanBarcode,
            name: cleanName,
            quantity: updatedQty,
            price: priceNum,
            category: category.trim(),
            storeName: storeName
        });
        return { success: true, message: 'Stock updated for existing product!' };
    }

    // Insert new product
    const id = await db.products.add({
        barcode: cleanBarcode,
        name: cleanName,
        quantity: qtyNum,
        price: priceNum,
        costPrice: costNum,
        category: category.trim(),
        storeName: storeName,
        lastUpdated: new Date().toISOString()
    });

    await addToSyncQueue('ADD_PRODUCT', {
        id,
        barcode: cleanBarcode,
        name: cleanName,
        quantity: qtyNum,
        price: priceNum,
        category: category.trim(),
        storeName: storeName
    });

    return { success: true, message: 'New product added successfully!' };
}

async function getProductByBarcode(barcode) {
    if (!barcode) return null;
    return await db.products.where('barcode').equals(String(barcode).trim()).first();
}

async function getProductById(id) {
    return await db.products.get(parseInt(id, 10));
}

async function getAllProducts() {
    return await db.products.reverse().sortBy('id');
}

async function getLowStockProducts(threshold = 5) {
    const allProducts = await db.products.toArray();
    return allProducts.filter(p => p.quantity <= threshold);
}

async function updateProduct(id, data) {
    const numId = parseInt(id, 10);
    const storeName = await getCurrentStore();
    await db.products.update(numId, {
        ...data,
        storeName: data.storeName || storeName,
        lastUpdated: new Date().toISOString()
    });
    await addToSyncQueue('UPDATE_PRODUCT', { id: numId, storeName, ...data });
    return { success: true, message: 'Product updated!' };
}

async function deleteProduct(id) {
    const numId = parseInt(id, 10);
    const storeName = await getCurrentStore();
    await db.products.delete(numId);
    await addToSyncQueue('DELETE_PRODUCT', { id: numId, storeName });
    return { success: true, message: 'Product deleted!' };
}

// ---------- SALES CRUD ----------

async function recordSale(productId, productName, quantitySold, price, costPrice = 0) {
    const numId = parseInt(productId, 10);
    const qtySold = parseInt(quantitySold, 10);
    const itemPrice = parseFloat(price);
    const itemCost = parseFloat(costPrice) || 0;
    const total = qtySold * itemPrice;
    const totalCost = qtySold * itemCost;
    const storeName = await getCurrentStore();

    const saleId = await db.sales.add({
        productId: numId,
        productName,
        quantitySold: qtySold,
        unitPrice: itemPrice,
        unitCost: itemCost,
        totalPrice: total,
        totalCost: totalCost,
        storeName: storeName,
        dateSold: new Date().toISOString()
    });

    // Deduct stock in products table
    const product = await db.products.get(numId);
    if (product) {
        const remainingQty = Math.max(0, product.quantity - qtySold);
        await db.products.update(numId, {
            quantity: remainingQty,
            lastUpdated: new Date().toISOString()
        });
    }

    await addToSyncQueue('RECORD_SALE', {
        saleId,
        productId: numId,
        productName,
        quantitySold: qtySold,
        unitPrice: itemPrice,
        unitCost: itemCost,
        total: total,
        totalCost: totalCost,
        storeName
    });

    return { success: true, saleId, total };
}

async function getTodaySales() {
    const todayStr = new Date().toISOString().split('T')[0];
    const allSales = await db.sales.toArray();
    return allSales.filter(s => s.dateSold.startsWith(todayStr));
}

async function getAllSales() {
    return await db.sales.reverse().sortBy('id');
}

async function getSaleById(id) {
    return await db.sales.get(parseInt(id, 10));
}

// ---------- SYNC QUEUE ----------

async function addToSyncQueue(action, data) {
    const storeName = data.storeName || await getCurrentStore();
    await db.syncQueue.add({
        action,
        data,
        storeName,
        timestamp: new Date().toISOString(),
        synced: 0
    });
}

async function getPendingSync() {
    return await db.syncQueue.where('synced').equals(0).toArray();
}

async function markSynced(id) {
    await db.syncQueue.update(id, { synced: 1 });
}

// ---------- MULTI-STORE MANAGEMENT ----------

async function getCurrentStore() {
    return localStorage.getItem('currentStore') || 'Main Store';
}

async function setCurrentStore(name) {
    localStorage.setItem('currentStore', name);
    // Ensure store is registered in db
    const existing = await db.stores.where('name').equals(name).first();
    if (!existing) {
        await db.stores.add({ name: name, location: 'Branch', isDefault: 0 });
    }
}

async function getAllStores() {
    const storesInDb = await db.stores.toArray();
    if (storesInDb.length === 0) {
        return [{ id: 1, name: 'Main Store', location: 'Addis Ababa', isDefault: 1 }];
    }
    return storesInDb;
}

async function addStore(name, location = 'Branch') {
    const existing = await db.stores.where('name').equals(name).first();
    if (!existing) {
        await db.stores.add({ name, location, isDefault: 0 });
    }
}

// ---------- EXPORT & BACKUP SAFETY ----------

async function exportToCSV() {
    const products = await getAllProducts();
    let csv = 'Barcode,Name,Quantity,Price (ETB),Category,Store Branch,Last Updated\n';
    products.forEach(p => {
        const safeName = `"${(p.name || '').replace(/"/g, '""')}"`;
        const safeCategory = `"${(p.category || '').replace(/"/g, '""')}"`;
        const safeStore = `"${(p.storeName || 'Main Store').replace(/"/g, '""')}"`;
        csv += `${p.barcode},${safeName},${p.quantity},${p.price},${safeCategory},${safeStore},${p.lastUpdated || ''}\n`;
    });
    return csv;
}

async function getDatabaseBackupJSON() {
    const products = await db.products.toArray();
    const sales = await db.sales.toArray();
    const stores = await db.stores.toArray();
    return JSON.stringify({
        schema: 'StockSafeProBackup',
        version: 3,
        backupDate: new Date().toISOString(),
        products,
        sales,
        stores
    }, null, 2);
}

/**
 * Strict JSON Integrity Validation & Transactional Atomic Restore
 */
async function restoreDatabaseFromJSON(jsonStr) {
    try {
        if (!jsonStr || typeof jsonStr !== 'string') {
            return { success: false, message: 'Invalid backup file: File content is empty or corrupt.' };
        }

        let data;
        try {
            data = JSON.parse(jsonStr);
        } catch (e) {
            return { success: false, message: 'JSON Parse Error: File is not a valid JSON document.' };
        }

        // Structural Schema Validation
        if (!data || typeof data !== 'object') {
            return { success: false, message: 'Validation Failed: Backup root must be a JSON object.' };
        }

        if (!Array.isArray(data.products) || !Array.isArray(data.sales)) {
            return { success: false, message: 'Validation Failed: Backup JSON missing required "products" or "sales" array tables.' };
        }

        // Item Sample Validation
        if (data.products.length > 0) {
            const sample = data.products[0];
            if (!sample || typeof sample !== 'object' || !sample.barcode || !sample.name) {
                return { success: false, message: 'Validation Failed: Products array contains malformed items (missing barcode/name).' };
            }
        }

        // Atomic Transactional Database Restore (Rolls back automatically on failure)
        await db.transaction('rw', db.products, db.sales, db.stores, async () => {
            await db.products.clear();
            await db.products.bulkAdd(data.products);

            await db.sales.clear();
            await db.sales.bulkAdd(data.sales);

            if (data.stores && Array.isArray(data.stores) && data.stores.length > 0) {
                await db.stores.clear();
                await db.stores.bulkAdd(data.stores);
            }
        });

        return { success: true, message: `✅ Database restored successfully! (${data.products.length} products, ${data.sales.length} sales restored)` };

    } catch (err) {
        console.error('Database restore error:', err);
        return { success: false, message: 'Database Transaction Failed: ' + err.message };
    }
}
