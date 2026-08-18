// StockSafe Pro - CSV Export & Data Backup Utility

async function exportCSV() {
    try {
        const csv = await exportToCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `stocksafe-inventory-${dateStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('CSV Export Error:', err);
        showToast('Failed to export inventory CSV: ' + err.message, 'error');
    }
}

async function exportJSONBackup() {
    try {
        const jsonStr = await getDatabaseBackupJSON();
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `stocksafe-backup-${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('JSON Export Error:', err);
        showToast('Failed to export backup file: ' + err.message, 'error');
    }
}
