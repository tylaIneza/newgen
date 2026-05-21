import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from './utils';
import type { ReportData } from '@/types';

export function exportReportPDF(report: ReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(20);
  doc.setTextColor(99, 102, 241);
  doc.text('ElectroShop MIS', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);
  doc.text(`${report.period.toUpperCase()} REPORT`, pageWidth / 2, 30, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Period: ${formatDate(report.start_date)} – ${formatDate(report.end_date)}`, pageWidth / 2, 38, { align: 'center' });

  doc.setFillColor(99, 102, 241);
  doc.rect(14, 45, pageWidth - 28, 0.5, 'F');

  const s = report.summary;
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);

  const summaryData = [
    ['Revenue', formatCurrency(s.revenue)],
    ['Total Expenses', formatCurrency(s.expenses)],
    ['Net Profit', formatCurrency(s.net_profit)],
    ['Profit Margin', `${s.profit_margin}%`],
    ['Transactions', s.transactions.toString()],
  ];

  autoTable(doc, {
    startY: 50,
    head: [['Financial Summary', 'Amount']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right' } },
  });

  if (report.top_products.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Product', 'Qty Sold', 'Revenue']],
      body: report.top_products.map(p => [
        p.product_name,
        p.qty_sold.toString(),
        formatCurrency(p.revenue),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
      didDrawPage: (data: any) => {
        if (data.pageNumber === 1) {
          doc.setFontSize(12);
          doc.text('Top Products', 14, (doc as any).lastAutoTable.finalY - 2);
        }
      },
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  doc.save(`report_${report.period}_${report.start_date}.pdf`);
}
