'use client';

export type KpiItem    = { label: string; value: string };
export type TableSheet = { title: string; headers: string[]; rows: (string | number)[][] };

export async function exportToExcel(
  filename:    string,
  reportTitle: string,
  kpis:        KpiItem[],
  tables:      TableSheet[],
) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'iCarDealership';

  // Summary sheet
  const summaryWs = wb.addWorksheet('Summary');
  const titleRow = summaryWs.addRow([reportTitle]);
  titleRow.font = { bold: true, size: 14 };
  summaryWs.addRow([]);
  const hdrRow = summaryWs.addRow(['Metric', 'Value']);
  hdrRow.font = { bold: true };
  hdrRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1E4FF' } };
  kpis.forEach((k) => summaryWs.addRow([k.label, k.value]));
  summaryWs.getColumn(1).width = 30;
  summaryWs.getColumn(2).width = 20;

  for (const t of tables) {
    const ws  = wb.addWorksheet(t.title.slice(0, 31));
    const hdr = ws.addRow(t.headers);
    hdr.font  = { bold: true };
    hdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1E4FF' } };
    hdr.alignment = { horizontal: 'center' };
    t.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? '').length;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 3, 50);
    });
  }

  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportToPdf(
  filename:    string,
  reportTitle: string,
  kpis:        KpiItem[],
  tables:      TableSheet[],
) {
  const { default: jsPDF }    = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle, 14, 16);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-EG', { dateStyle: 'long' })}`, pageW - 14, 16, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // KPI cards (up to 5 per row)
  let y = 24;
  if (kpis.length > 0) {
    const rows = Math.ceil(kpis.length / 5);
    for (let row = 0; row < rows; row++) {
      const rowKpis = kpis.slice(row * 5, row * 5 + 5);
      const colW    = (pageW - 28) / rowKpis.length;
      rowKpis.forEach((k, i) => {
        const x = 14 + i * colW;
        doc.setFillColor(238, 246, 255);
        doc.roundedRect(x, y, colW - 2, 14, 1.5, 1.5, 'F');
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(k.label.toUpperCase(), x + 3, y + 5);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(k.value, x + 3, y + 11);
      });
      y += 18;
    }
  }

  // Tables
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    if (i > 0 || kpis.length > 0) y += 2;

    if (table.title) {
      if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 14; }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(table.title, 14, y);
      y += 5;
    }

    autoTable(doc, {
      head:        [table.headers],
      body:        table.rows.map((r) => r.map((v) => String(v))),
      startY:      y,
      styles:      { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles:  { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin:      { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  doc.save(`${filename}.pdf`);
}
