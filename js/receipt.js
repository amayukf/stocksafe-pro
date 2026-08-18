// StockSafe Pro - Offline Thermal PDF Receipt Generator (80mm POS Precision Layout)

async function generateReceiptPDF(saleId) {
    const sale = await getSaleById(saleId);
    if (!sale) {
        showToast('Sale record not found!', 'error');
        return;
    }

    const storeName = sale.storeName || await getCurrentStore();

    // Support both UMD bundle (window.jspdf.jsPDF) and standard window.jsPDF
    let jsPDFClass = null;
    if (window.jspdf && window.jspdf.jsPDF) {
        jsPDFClass = window.jspdf.jsPDF;
    } else if (window.jsPDF) {
        jsPDFClass = window.jsPDF;
    }

    if (typeof window.jspdf === 'undefined') {
        console.warn('[Receipt] jsPDF not loaded.');
        showToast('PDF generator library not ready. Generating text receipt fallback.', 'warning');
        generateTextReceipt(sale, storeName);
        return;
    }

    try {
        // Standard 80mm thermal receipt dimensions: 80mm x 180mm
        // Margin: 3mm left/right to ensure 0 right-side text cutoff on thermal printer heads
        const doc = new jsPDFClass({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, 180]
        });

        const leftMargin = 4;
        const rightMargin = 76;
        const centerX = 40;

        const customLogo = localStorage.getItem('stocksafe_receipt_logo');
        let currentY = 10;

        if (customLogo) {
            try {
                // Approximate 30x15 size, centered on the receipt
                doc.addImage(customLogo, 'JPEG', centerX - 15, currentY, 30, 15);
                currentY += 18;
            } catch (e) {
                console.warn('Could not add receipt logo', e);
            }
        }

        // Header Styling
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('STOCKSAFE PRO', centerX, currentY, { align: 'center' });
        currentY += 5;

        doc.setFontSize(9);
        doc.setFont('Helvetica', 'normal');
        doc.text(String(storeName).toUpperCase(), centerX, currentY, { align: 'center' });
        currentY += 4;
        doc.text('Official Sales Receipt', centerX, currentY, { align: 'center' });
        currentY += 3;

        // Divider Line
        doc.setLineWidth(0.2);
        doc.line(leftMargin, currentY, rightMargin, currentY);
        currentY += 5;

        // Transaction Details
        doc.setFontSize(8);
        const formattedDate = new Date(sale.dateSold).toLocaleString();
        doc.text(`Receipt #: REC-${String(sale.id).padStart(5, '0')}`, leftMargin, currentY);
        currentY += 5;
        doc.text(`Date: ${formattedDate}`, leftMargin, currentY);
        currentY += 3;

        // Divider Line
        doc.line(leftMargin, currentY, rightMargin, currentY);
        currentY += 5;

        // Table Header
        doc.setFont('Helvetica', 'bold');
        doc.text('Item Description', leftMargin, currentY);
        doc.text('Qty x Price', 42, currentY);
        doc.text('Total', rightMargin, currentY, { align: 'right' });
        currentY += 6;

        doc.setFont('Helvetica', 'normal');
        // Item Details Row
        const truncatedName = sale.productName.length > 17 ? sale.productName.substring(0, 17) + '..' : sale.productName;
        doc.text(truncatedName, leftMargin, currentY);
        const unitPriceStr = (sale.unitPrice || (sale.totalPrice / sale.quantitySold)).toFixed(2);
        doc.text(`${sale.quantitySold} x ${unitPriceStr}`, 42, currentY);
        doc.text(`${sale.totalPrice.toFixed(2)} ETB`, rightMargin, currentY, { align: 'right' });
        currentY += 5;

        // Divider Line
        doc.line(leftMargin, currentY, rightMargin, currentY);
        currentY += 7;

        // Total Summary
        doc.setFontSize(10);
        doc.setFont('Helvetica', 'bold');
        doc.text('GRAND TOTAL:', leftMargin, currentY);
        doc.text(`${sale.totalPrice.toFixed(2)} ETB`, rightMargin, currentY, { align: 'right' });
        currentY += 4;

        // Divider Line
        doc.line(leftMargin, currentY, rightMargin, currentY);
        currentY += 6;

        // Footer Message
        const customFooter = localStorage.getItem('stocksafe_receipt_footer');
        const footerMsg = customFooter && customFooter.trim() !== '' ? customFooter : 'Thank you for your business!';
        doc.setFontSize(7.5);
        doc.setFont('Helvetica', 'italic');
        doc.text(footerMsg, centerX, currentY, { align: 'center' });
        currentY += 4;
        doc.text('Powered by StockSafe Pro (Offline PWA)', centerX, currentY, { align: 'center' });

        // Save PDF receipt file
        const fileName = `Receipt-REC-${String(sale.id).padStart(5, '0')}.pdf`;
        doc.save(fileName);

    } catch (error) {
        console.error('[Receipt] PDF Generation failed', error);
        showToast('Fallback text receipt download triggered due to PDF rendering error.', 'warning');
        generateTextReceipt(sale, storeName);
    }
}

function generateTextReceipt(sale, storeName) {
    const formattedDate = new Date(sale.dateSold).toLocaleString();
    const customFooter = localStorage.getItem('stocksafe_receipt_footer');
    const footerMsg = customFooter && customFooter.trim() !== '' ? customFooter : 'Thank you for your business!';

    const textContent = `
=================================
       STOCKSAFE PRO
       ${storeName}
   Official Sales Receipt
=================================
Receipt #: REC-${String(sale.id).padStart(5, '0')}
Date: ${formattedDate}
---------------------------------
Item: ${sale.productName}
Quantity: ${sale.quantitySold}
Unit Price: ${sale.unitPrice || (sale.totalPrice / sale.quantitySold).toFixed(2)} ETB
Total Amount: ${sale.totalPrice.toFixed(2)} ETB
---------------------------------
GRAND TOTAL: ${sale.totalPrice.toFixed(2)} ETB
=================================
 ${footerMsg}
 Powered by StockSafe Pro (Offline)
=================================
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt-REC-${String(sale.id).padStart(5, '0')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
}
