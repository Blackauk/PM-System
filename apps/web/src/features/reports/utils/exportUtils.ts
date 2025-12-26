import * as XLSX from 'xlsx';

// Export table data to CSV
export function exportToCSV(data: any[], filename: string, headers?: string[]) {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first row if not provided
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    csvHeaders.join(','),
    ...data.map(row => 
      csvHeaders.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Export table data to Excel
export function exportToExcel(data: any[], filename: string, sheetName: string = 'Data') {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Convert data to worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  const maxWidths: number[] = [];
  const headers = Object.keys(data[0]);
  headers.forEach((header, colIndex) => {
    const maxLength = Math.max(
      header.length,
      ...data.map(row => String(row[header] || '').length)
    );
    maxWidths[colIndex] = Math.min(maxLength + 2, 50);
  });
  ws['!cols'] = maxWidths.map(w => ({ wch: w }));
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Download
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// Export page as PDF (simple HTML to PDF using browser print)
export function exportPageAsPDF(filename: string, elementId?: string) {
  const element = elementId ? document.getElementById(elementId) : document.body;
  if (!element) {
    alert('Element not found for PDF export');
    return;
  }

  // Create a new window with the content
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export PDF');
    return;
  }

  // Get styles
  const styles = Array.from(document.styleSheets)
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules)
          .map(rule => rule.cssText)
          .join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        <style>
          ${styles}
          body { margin: 20px; }
          @media print {
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  
  // Wait for content to load, then print
  setTimeout(() => {
    printWindow.print();
    // Close after print dialog
    setTimeout(() => printWindow.close(), 100);
  }, 250);
}


