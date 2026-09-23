import { money } from "@/lib/i18n";
import type { UserOptions } from "jspdf-autotable";

interface PdfOpts {
  title: string;
  period: string;
  branchName: string;
  sales: Array<{
    date: string;
    branch: string;
    product: string;
    customer: string;
    qty: number;
    price: number;
    profit: number;
  }>;
  purchases: Array<{
    date: string;
    branch: string;
    product: string;
    supplier: string;
    qty: number;
    price: number;
    transport: number;
  }>;
  expenses: Array<{ date: string; branch: string; description: string; amount: number }>;
  inventory?: Array<{
    branch: string;
    product: string;
    quantity: number;
    unit: string;
    status: string;
  }>;
  totals: {
    sales: number;
    profit: number;
    purchases: number;
    expenses: number;
    net: number;
    customers: number;
  };
  branchPerformance?: Array<{ branch: string; sales: number; revenue: number; profit: number }>;
}

export async function generateReportPdf(opts: PdfOpts) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const lastY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFillColor(10, 87, 42);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("UFBC AGRODEALER", 14, 15);
  doc.setFontSize(11);
  doc.text(opts.title, 14, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`${opts.period}  |  ${opts.branchName}`, 14, 29);

  const summary = [
    [
      `Sales: ${money(opts.totals.sales)}`,
      `Profit: ${money(opts.totals.profit)}`,
      `Net profit: ${money(opts.totals.net)}`,
    ],
    [
      `Purchases: ${money(opts.totals.purchases)}`,
      `Expenses: ${money(opts.totals.expenses)}`,
      `Customers: ${opts.totals.customers}`,
    ],
  ];
  autoTable(doc, {
    startY: 41,
    body: summary,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 3, fillColor: [246, 250, 247], textColor: [24, 48, 32] },
    tableLineColor: [205, 220, 209],
    tableLineWidth: 0.15,
  });
  let y = lastY() + 9;
  const section = (title: string) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(10, 87, 42);
    doc.setFontSize(11);
    doc.text(title, 14, y);
    doc.setTextColor(25, 25, 25);
    y += 3;
  };
  const base: UserOptions = {
    theme: "striped" as const,
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    headStyles: { fillColor: [10, 87, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [247, 250, 248] },
    margin: { left: 14, right: 14 },
  };

  if (opts.branchPerformance) {
    section("Branch performance");
    autoTable(doc, {
      ...base,
      startY: y,
      head: [["Branch", "Sales", "Revenue", "Profit"]],
      body: opts.branchPerformance.map((row) => [
        row.branch,
        String(row.sales),
        money(row.revenue),
        money(row.profit),
      ]),
    });
    y = lastY() + 9;
  }
  if (opts.inventory) {
    section("Available stock");
    autoTable(doc, {
      ...base,
      startY: y,
      head: [["Branch", "Product", "Available quantity", "Status"]],
      body: opts.inventory.map((item) => [
        item.branch,
        item.product,
        `${item.quantity.toLocaleString("en-US")} ${item.unit}`,
        item.status,
      ]),
    });
    y = lastY() + 9;
  }
  section("Sales details");
  autoTable(doc, {
    ...base,
    startY: y,
    head: [["Date", "Branch", "Product", "Customer", "Qty", "Value", "Profit"]],
    body: opts.sales.map((sale) => [
      sale.date,
      sale.branch,
      sale.product,
      sale.customer,
      String(sale.qty),
      money(sale.qty * sale.price),
      money(sale.profit),
    ]),
  });
  y = lastY() + 9;
  section("Purchase details");
  autoTable(doc, {
    ...base,
    startY: y,
    head: [["Date", "Branch", "Product", "Supplier", "Qty", "Unit cost", "Transport"]],
    body: opts.purchases.map((purchase) => [
      purchase.date,
      purchase.branch,
      purchase.product,
      purchase.supplier,
      String(purchase.qty),
      money(purchase.price),
      money(purchase.transport),
    ]),
  });
  y = lastY() + 9;
  section("Expenses");
  autoTable(doc, {
    ...base,
    startY: y,
    head: [["Date", "Branch", "Description", "Amount"]],
    body: opts.expenses.map((expense) => [
      expense.date,
      expense.branch,
      expense.description,
      money(expense.amount),
    ]),
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(100, 110, 105);
    doc.text(`UFBC Agrodealer | Page ${page} of ${pages}`, 14, 290);
  }
  doc.save(`${opts.title.replace(/\s+/g, "_")}.pdf`);
}

export function generateCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
