// StockSafe Pro - Auto-Sync Engine with Multi-Store Isolation Support

async function syncData() {
    if (!navigator.onLine) {
        console.log('[StockSafe Sync] Device offline - sync deferred.');
        updateSyncStatusUI();
        return;
    }

    const pending = await getPendingSync();
    if (pending.length === 0) {
        console.log('[StockSafe Sync] Nothing to sync.');
        updateSyncStatusUI();
        return;
    }

    console.log(`[StockSafe Sync] Syncing ${pending.length} pending operations...`);
    updateSyncStatusUI(true, pending.length);

    // Retrieve or initialize cloud backup storage grouped by storeName
    let cloudData = [];
    try {
        cloudData = JSON.parse(localStorage.getItem('cloudBackup') || '[]');
    } catch (e) {
        cloudData = [];
    }

    for (let item of pending) {
        // Record cloud sync payload with explicit store isolation tagging
        cloudData.push({
            syncId: item.id,
            action: item.action,
            storeName: item.storeName || item.data.storeName || 'Main Store',
            payload: item.data,
            timestamp: item.timestamp,
            syncedAt: new Date().toISOString()
        });

        // Mark local item as synced
        await markSynced(item.id);
    }

    localStorage.setItem('cloudBackup', JSON.stringify(cloudData));
    console.log('[StockSafe Sync] Sync complete successfully with store isolation!');
    updateSyncStatusUI();
}

async function updateSyncStatusUI(isSyncing = false, count = 0) {
    const statusElem = document.getElementById('sync-status');
    if (!statusElem) return;

    const pending = await getPendingSync();
    const pendingCount = pending.length;

    if (isSyncing) {
        statusElem.textContent = `📡 Syncing (${count})`;
        statusElem.className = 'sync-status sync-offline';
    } else if (navigator.onLine) {
        if (pendingCount > 0) {
            statusElem.textContent = `📡 Online (${pendingCount} pending)`;
            statusElem.className = 'sync-status sync-offline';
        } else {
            statusElem.textContent = '✅ Online';
            statusElem.className = 'sync-status sync-online';
        }
    } else {
        statusElem.textContent = `📡 Offline (${pendingCount} pending)`;
        statusElem.className = 'sync-status sync-offline';
    }
}

// Global Network Event Listeners
window.addEventListener('online', () => {
    console.log('[StockSafe Network] Connection restored!');
    updateSyncStatusUI();
    syncData();
});

window.addEventListener('offline', () => {
    console.log('[StockSafe Network] Device went offline.');
    updateSyncStatusUI();
});

// Periodic Sync Interval (Every 30 seconds when online)
setInterval(() => {
    if (navigator.onLine) {
        syncData();
    }
}, 30000);

document.addEventListener('DOMContentLoaded', () => {
    updateSyncStatusUI();
    if (navigator.onLine) {
        syncData();
    }
});
