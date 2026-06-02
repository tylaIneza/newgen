import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from './utils';
import type { ReportData } from '@/types';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export function exportReportPDF(report: ReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(99, 102, 241);
  doc.text('Tyla Shop MIS', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);
  doc.text(`${report.period.toUpperCase()} REPORT`, pageWidth / 2, 30, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Period: ${formatDate(report.start_date)} – ${formatDate(report.end_date)}`, pageWidth / 2, 38, { align: 'center' });

  doc.setFillColor(99, 102, 241);
  doc.rect(14, 44, pageWidth - 28, 0.5, 'F');

  // Financial Summary table
  const s = report.summary;
  autoTable(doc, {
    startY: 50,
    head: [['Financial Summary', 'Amount']],
    body: [
      ['Revenue',         formatCurrency(s.revenue)],
      ['Operating Expenses', formatCurrency(s.expenses)],
      ['Savings',         formatCurrency(s.savings ?? 0)],
      ['Net Profit',      formatCurrency(s.net_profit)],
      ['Profit Margin',   `${s.profit_margin}%`],
      ['Transactions',    s.transactions.toString()],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right' } },
  });

  // Monthly Savings Breakdown
  if (report.monthly_savings && report.monthly_savings.length > 0) {
    const year = report.start_date.slice(0, 4);
    const yearTotal = report.monthly_savings.reduce((sum, m) => sum + m.total_saved, 0);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [['Month', 'Days Saved', 'Total Saved']],
      body: [
        ...report.monthly_savings.map(m => [
          MONTH_NAMES[m.month - 1],
          m.days_saved.toString(),
          formatCurrency(m.total_saved),
        ]),
        ['TOTAL', report.monthly_savings.reduce((s, m) => s + m.days_saved, 0).toString(), formatCurrency(yearTotal)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 10 },
      columnStyles: { 2: { halign: 'right' } },
      didParseCell: (data: any) => {
        if (data.row.index === report.monthly_savings.length) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: (data: any) => {
        if (data.pageNumber === 1) {
          doc.setFontSize(12);
          doc.setTextColor(50, 50, 50);
          doc.text(`Monthly Savings — ${year}`, 14, (doc as any).lastAutoTable.finalY + 8);
        }
      },
    });
  }

  // Top Products table
  if (report.top_products.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [['Product', 'Qty Sold', 'Revenue']],
      body: report.top_products.map(p => [
        p.product_name,
        p.qty_sold.toString(),
        formatCurrency(p.revenue),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: 'right' } },
    });
  }

  // Seller Performance table
  if (report.seller_performance.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [['Seller', 'Transactions', 'Revenue']],
      body: report.seller_performance.map(sp => [
        sp.seller_name,
        sp.transactions.toString(),
        formatCurrency(sp.revenue),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: 'right' } },
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated on ${new Date().toLocaleString()}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' },
  );

  doc.save(`report_${report.period}_${report.start_date}.pdf`);
}
