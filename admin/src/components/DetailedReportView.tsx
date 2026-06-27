import { useState, useEffect } from "react";
import { getCollection } from "../lib/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Invoice, Purchase, Batch, OrderItem, BatchItem, PurchaseItem } from "../types";

type Tab = "sales" | "purchases" | "inventory";

const today = () => new Date().toISOString().split("T")[0];

export default function DetailedReportView() {
  const [tab, setTab] = useState<Tab>("sales");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCollection<Invoice>("invoices"),
      getCollection<Purchase>("purchases"),
      getCollection<Batch>("batches"),
    ]).then(([inv, pur, bat]) => {
      setInvoices(inv);
      setPurchases(pur);
      setBatches(bat);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => n.toLocaleString();
  const fmtDate = (t: { seconds: number } | undefined) =>
    t ? new Date(t.seconds * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

  const inRange = (t: { seconds: number } | undefined) => {
    if (!t) return false;
    const d = new Date(t.seconds * 1000);
    const s = new Date(startDate + "T00:00:00");
    const e = new Date(endDate + "T23:59:59");
    return d >= s && d <= e;
  };

  const filteredInvoices = invoices.filter(
    (i) =>
      inRange(i.createdAt) &&
      (i.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      i.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      i.orderNumber?.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredPurchases = purchases.filter(
    (p) =>
      inRange(p.createdAt) &&
      (p.purchaseNumber?.toLowerCase().includes(search.toLowerCase()) ||
      p.supplierName?.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredBatches = batches.filter(
    (b) =>
      inRange(b.createdAt) &&
      (b.batchNumber?.toLowerCase().includes(search.toLowerCase()) ||
      b.productName?.toLowerCase().includes(search.toLowerCase()))
  );

  const downloadCSV = () => {
    const rows: string[][] = [["ID", "Customer", "Items", "Subtotal", "Discount", "Delivery", "Grand Total", "Payment", "Status", "Date"]];
    filteredInvoices.forEach((i) => {
      rows.push([
        i.invoiceNumber || i.orderNumber || i.id,
        i.customerName,
        String(i.items?.length || 0),
        String(i.subtotal),
        String(i.discount),
        String(i.deliveryCharge),
        String(i.grandTotal),
        i.paymentMethod || "",
        i.status,
        fmtDate(i.createdAt),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    doc.setFontSize(16);
    doc.text("Sales Transactions Report", 140, 20, { align: "center" });
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 140, 27, { align: "center" });
    autoTable(doc, {
      startY: 33,
      head: [["Invoice #", "Customer", "Items", "Subtotal", "Discount", "Delivery", "Grand Total", "Payment", "Status", "Date"]],
      body: filteredInvoices.map((i) => [
        i.invoiceNumber || i.orderNumber || i.id,
        i.customerName,
        String(i.items?.length || 0),
        fmt(i.subtotal),
        fmt(i.discount),
        fmt(i.deliveryCharge),
        fmt(i.grandTotal),
        i.paymentMethod || "",
        i.status,
        fmtDate(i.createdAt),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [31, 94, 59], textColor: 255, fontSize: 7 },
      theme: "striped",
    });
    doc.save(`sales-report-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const purchaseCSV = () => {
    const rows: string[][] = [["Purchase #", "Supplier", "Items", "Subtotal", "Discount", "Grand Total", "Paid", "Due", "Status", "Date"]];
    filteredPurchases.forEach((p) => {
      rows.push([
        p.purchaseNumber || p.id,
        p.supplierName,
        String(p.items?.length || 0),
        String(p.subtotal),
        String(p.discount),
        String(p.grandTotal),
        String(p.cashPaid),
        String(p.due),
        p.paymentStatus,
        fmtDate(p.createdAt),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchases-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const purchasePDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    doc.setFontSize(16);
    doc.text("Purchase Transactions Report", 140, 20, { align: "center" });
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 140, 27, { align: "center" });
    autoTable(doc, {
      startY: 33,
      head: [["Purchase #", "Supplier", "Items", "Subtotal", "Discount", "Grand Total", "Paid", "Due", "Status", "Date"]],
      body: filteredPurchases.map((p) => [
        p.purchaseNumber || p.id,
        p.supplierName,
        String(p.items?.length || 0),
        fmt(p.subtotal),
        fmt(p.discount),
        fmt(p.grandTotal),
        fmt(p.cashPaid),
        fmt(p.due),
        p.paymentStatus,
        fmtDate(p.createdAt),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [31, 94, 59], textColor: 255, fontSize: 7 },
      theme: "striped",
    });
    doc.save(`purchases-report-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const inventoryCSV = () => {
    const rows: string[][] = [["Batch #", "Product", "Items", "Total Cost", "Status", "Date"]];
    filteredBatches.forEach((b) => {
      rows.push([
        b.batchNumber || b.id,
        b.productName,
        String(b.items?.length || 0),
        String(b.totalCost),
        b.status,
        fmtDate(b.createdAt),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inventoryPDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    doc.setFontSize(16);
    doc.text("Inventory / Batch Report", 140, 20, { align: "center" });
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 140, 27, { align: "center" });
    autoTable(doc, {
      startY: 33,
      head: [["Batch #", "Product", "Items", "Total Cost", "Status", "Date"]],
      body: filteredBatches.map((b) => [
        b.batchNumber || b.id,
        b.productName,
        String(b.items?.length || 0),
        fmt(b.totalCost),
        b.status,
        fmtDate(b.createdAt),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [31, 94, 59], textColor: 255, fontSize: 7 },
      theme: "striped",
    });
    doc.save(`inventory-report-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const TabButton = ({ t, label }: { t: Tab; label: string }) => (
    <button onClick={() => { setTab(t); setSearch(""); }} className={`rounded-btn px-4 py-2 text-sm font-medium transition-colors ${tab === t ? "bg-forest-green text-white" : "border border-border text-text-light hover:border-forest-green hover:text-forest-green"}`}>{label}</button>
  );

  if (loading) return <div className="py-10 text-center text-text-muted">Loading transactions...</div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TabButton t="sales" label={`Sales (${invoices.length})`} />
        <TabButton t="purchases" label={`Purchases (${purchases.length})`} />
        <TabButton t="inventory" label={`Inventory / Batches (${batches.length})`} />
        <div className="ml-auto flex gap-2">
          {tab === "sales" && (
            <>
              <button onClick={downloadCSV} className="rounded-btn border border-border px-3 py-2 text-xs font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">CSV</button>
              <button onClick={downloadPDF} className="rounded-btn border border-border px-3 py-2 text-xs font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">PDF</button>
            </>
          )}
          {tab === "purchases" && (
            <>
              <button onClick={purchaseCSV} className="rounded-btn border border-border px-3 py-2 text-xs font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">CSV</button>
              <button onClick={purchasePDF} className="rounded-btn border border-border px-3 py-2 text-xs font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">PDF</button>
            </>
          )}
          {tab === "inventory" && (
            <>
              <button onClick={inventoryCSV} className="rounded-btn border border-border px-3 py-2 text-xs font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">CSV</button>
              <button onClick={inventoryPDF} className="rounded-btn border border-border px-3 py-2 text-xs font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">PDF</button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-text-light">
          <span>From:</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-input border border-border px-2 py-1.5 text-sm outline-none focus:border-forest-green" />
        </div>
        <div className="flex items-center gap-1 text-xs text-text-light">
          <span>To:</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-input border border-border px-2 py-1.5 text-sm outline-none focus:border-forest-green" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search by ${tab === "sales" ? "invoice #, order #, or customer" : tab === "purchases" ? "purchase # or supplier" : "batch # or product"}...`}
          className="ml-auto w-full max-w-xs rounded-input border border-border px-4 py-1.5 text-sm outline-none focus:border-forest-green"
        />
      </div>

      {tab === "sales" && (
        <div className="rounded-card bg-white shadow-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-border bg-beige/30">
              <th className="px-3 py-2 font-medium text-text-muted">Invoice #</th>
              <th className="px-3 py-2 font-medium text-text-muted">Customer</th>
              <th className="px-3 py-2 font-medium text-text-muted">Items</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Subtotal</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Discount</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Delivery</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Grand Total</th>
              <th className="px-3 py-2 font-medium text-text-muted">Payment</th>
              <th className="px-3 py-2 font-medium text-text-muted">Status</th>
              <th className="px-3 py-2 font-medium text-text-muted">Date</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.map((i) => (
                <tr key={i.id} onClick={() => setSelectedInvoice(i)} className="cursor-pointer transition-colors hover:bg-beige/30">
                  <td className="px-3 py-2 font-mono text-text">{i.invoiceNumber || i.orderNumber || i.id}</td>
                  <td className="px-3 py-2 text-text">{i.customerName}</td>
                  <td className="px-3 py-2 text-text-light">{i.items?.length || 0}</td>
                  <td className="px-3 py-2 text-right text-text">{fmt(i.subtotal)}</td>
                  <td className="px-3 py-2 text-right text-error">{fmt(i.discount)}</td>
                  <td className="px-3 py-2 text-right text-text">{fmt(i.deliveryCharge)}</td>
                  <td className="px-3 py-2 text-right font-medium text-forest-green">{fmt(i.grandTotal)}</td>
                  <td className="px-3 py-2"><span className="rounded-full bg-beige px-2 py-0.5 text-xs">{i.paymentMethod || "—"}</span></td>
                  <td className="px-3 py-2"><StatusBadge status={i.status} /></td>
                  <td className="px-3 py-2 text-text-light">{fmtDate(i.createdAt)}</td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && <tr><td colSpan={10} className="px-3 py-10 text-center text-text-muted">No invoices match your search</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "purchases" && (
        <div className="rounded-card bg-white shadow-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-border bg-beige/30">
              <th className="px-3 py-2 font-medium text-text-muted">Purchase #</th>
              <th className="px-3 py-2 font-medium text-text-muted">Supplier</th>
              <th className="px-3 py-2 font-medium text-text-muted">Items</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Subtotal</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Discount</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Grand Total</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Paid</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Due</th>
              <th className="px-3 py-2 font-medium text-text-muted">Payment</th>
              <th className="px-3 py-2 font-medium text-text-muted">Date</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {filteredPurchases.map((p) => (
                <tr key={p.id} onClick={() => setSelectedPurchase(p)} className="cursor-pointer transition-colors hover:bg-beige/30">
                  <td className="px-3 py-2 font-mono text-text">{p.purchaseNumber || p.id}</td>
                  <td className="px-3 py-2 text-text">{p.supplierName}</td>
                  <td className="px-3 py-2 text-text-light">{p.items?.length || 0}</td>
                  <td className="px-3 py-2 text-right text-text">{fmt(p.subtotal)}</td>
                  <td className="px-3 py-2 text-right text-error">{fmt(p.discount)}</td>
                  <td className="px-3 py-2 text-right font-medium text-forest-green">{fmt(p.grandTotal)}</td>
                  <td className="px-3 py-2 text-right text-success">{fmt(p.cashPaid)}</td>
                  <td className="px-3 py-2 text-right text-error">{fmt(p.due)}</td>
                  <td className="px-3 py-2"><span className="rounded-full bg-beige px-2 py-0.5 text-xs">{p.paymentStatus}</span></td>
                  <td className="px-3 py-2 text-text-light">{fmtDate(p.createdAt)}</td>
                </tr>
              ))}
              {filteredPurchases.length === 0 && <tr><td colSpan={10} className="px-3 py-10 text-center text-text-muted">No purchases match your search</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "inventory" && (
        <div className="rounded-card bg-white shadow-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-border bg-beige/30">
              <th className="px-3 py-2 font-medium text-text-muted">Batch #</th>
              <th className="px-3 py-2 font-medium text-text-muted">Product</th>
              <th className="px-3 py-2 font-medium text-text-muted">SKUs</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Total Cost</th>
              <th className="px-3 py-2 font-medium text-text-muted">Status</th>
              <th className="px-3 py-2 font-medium text-text-muted">Date</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {filteredBatches.map((b) => (
                <tr key={b.id} onClick={() => setSelectedBatch(b)} className="cursor-pointer transition-colors hover:bg-beige/30">
                  <td className="px-3 py-2 font-mono text-text">{b.batchNumber || b.id}</td>
                  <td className="px-3 py-2 text-text">{b.productName}</td>
                  <td className="px-3 py-2 text-text-light">{b.items?.length || 0}</td>
                  <td className="px-3 py-2 text-right font-medium text-forest-green">{fmt(b.totalCost)}</td>
                  <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                  <td className="px-3 py-2 text-text-light">{fmtDate(b.createdAt)}</td>
                </tr>
              ))}
              {filteredBatches.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-text-muted">No batches match your search</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {selectedInvoice && (
        <DetailModal title={selectedInvoice.invoiceNumber || selectedInvoice.orderNumber || selectedInvoice.id} onClose={() => setSelectedInvoice(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-text-light">Customer</span><span className="font-medium text-text">{selectedInvoice.customerName}</span></div>
            {selectedInvoice.customerPhone && <div className="flex justify-between"><span className="text-text-light">Phone</span><span className="text-text">{selectedInvoice.customerPhone}</span></div>}
            <div className="flex justify-between"><span className="text-text-light">Payment</span><span className="capitalize text-text">{selectedInvoice.paymentMethod} · {selectedInvoice.paymentStatus}</span></div>
            <div className="flex justify-between"><span className="text-text-light">Status</span><StatusBadge status={selectedInvoice.status} /></div>
            <div className="flex justify-between"><span className="text-text-light">Date</span><span className="text-text">{fmtDate(selectedInvoice.createdAt)}</span></div>
            <div className="border-t border-border pt-2">
              <p className="mb-1 text-xs font-semibold text-text">Items</p>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border"><th className="py-1 text-left text-text-light">Item</th><th className="py-1 text-right text-text-light">Qty</th><th className="py-1 text-right text-text-light">Price</th><th className="py-1 text-right text-text-light">Total</th></tr></thead>
                <tbody>
                  {selectedInvoice.items?.map((item: OrderItem, idx: number) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-1 text-text">{item.productName}{item.skuLabel ? ` (${item.skuLabel})` : ""}</td>
                      <td className="py-1 text-right text-text">{item.quantity}</td>
                      <td className="py-1 text-right text-text">{fmt(item.unitPrice)}</td>
                      <td className="py-1 text-right font-medium text-forest-green">{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border pt-2 space-y-1">
              <div className="flex justify-between text-text-light"><span>Subtotal</span><span>{fmt(selectedInvoice.subtotal)}</span></div>
              <div className="flex justify-between text-error"><span>Discount</span><span>-{fmt(selectedInvoice.discount)}</span></div>
              <div className="flex justify-between text-text-light"><span>Delivery</span><span>{fmt(selectedInvoice.deliveryCharge)}</span></div>
              <div className="flex justify-between font-bold text-forest-green text-base"><span>Grand Total</span><span>{fmt(selectedInvoice.grandTotal)}</span></div>
            </div>
          </div>
        </DetailModal>
      )}

      {selectedPurchase && (
        <DetailModal title={selectedPurchase.purchaseNumber || selectedPurchase.id} onClose={() => setSelectedPurchase(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-text-light">Supplier</span><span className="font-medium text-text">{selectedPurchase.supplierName}</span></div>
            <div className="flex justify-between"><span className="text-text-light">Payment</span><span className="capitalize text-text">{selectedPurchase.paymentStatus}</span></div>
            <div className="border-t border-border pt-2">
              <p className="mb-1 text-xs font-semibold text-text">Items</p>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border"><th className="py-1 text-left text-text-light">Material</th><th className="py-1 text-right text-text-light">Qty</th><th className="py-1 text-right text-text-light">Unit Price</th><th className="py-1 text-right text-text-light">Total</th></tr></thead>
                <tbody>
                  {selectedPurchase.items?.map((item: PurchaseItem, idx: number) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-1 text-text">{item.materialName}</td>
                      <td className="py-1 text-right text-text">{item.quantity} {item.unit}</td>
                      <td className="py-1 text-right text-text">{fmt(item.unitPrice)}</td>
                      <td className="py-1 text-right font-medium text-forest-green">{fmt(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border pt-2 space-y-1">
              <div className="flex justify-between text-text-light"><span>Subtotal</span><span>{fmt(selectedPurchase.subtotal)}</span></div>
              <div className="flex justify-between text-error"><span>Discount</span><span>-{fmt(selectedPurchase.discount)}</span></div>
              <div className="flex justify-between font-bold text-forest-green text-base"><span>Grand Total</span><span>{fmt(selectedPurchase.grandTotal)}</span></div>
              <div className="flex justify-between text-success"><span>Paid</span><span>{fmt(selectedPurchase.cashPaid)}</span></div>
              {selectedPurchase.due > 0 && <div className="flex justify-between text-error"><span>Due</span><span>{fmt(selectedPurchase.due)}</span></div>}
            </div>
          </div>
        </DetailModal>
      )}

      {selectedBatch && (
        <DetailModal title={selectedBatch.batchNumber || selectedBatch.id} onClose={() => setSelectedBatch(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-text-light">Product</span><span className="font-medium text-text">{selectedBatch.productName}</span></div>
            <div className="flex justify-between"><span className="text-text-light">Status</span><StatusBadge status={selectedBatch.status} /></div>
            <div className="border-t border-border pt-2">
              <p className="mb-1 text-xs font-semibold text-text">SKUs</p>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border"><th className="py-1 text-left text-text-light">SKU</th><th className="py-1 text-right text-text-light">Qty</th><th className="py-1 text-right text-text-light">Unit Cost</th><th className="py-1 text-right text-text-light">Total</th></tr></thead>
                <tbody>
                  {selectedBatch.items?.map((item: BatchItem, idx: number) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-1 text-text">{item.label || item.skuCode}</td>
                      <td className="py-1 text-right text-text">{item.quantity}</td>
                      <td className="py-1 text-right text-text">{fmt(item.unitCost)}</td>
                      <td className="py-1 text-right font-medium text-forest-green">{fmt(item.quantity * item.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border pt-2">
              <div className="flex justify-between font-bold text-forest-green text-base"><span>Total Cost</span><span>{fmt(selectedBatch.totalCost)}</span></div>
            </div>
          </div>
        </DetailModal>
      )}
    </div>
  );
}

function DetailModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-card bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-text">{title}</h2>
          <button onClick={onClose} className="text-xl text-text-light">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "delivered" || status === "completed" || status === "paid" ? "bg-success/10 text-success" :
    status === "cancelled" || status === "returned" ? "bg-error/10 text-error" :
    status === "pending" || status === "start" || status === "credit" || status === "partial" ? "bg-warning/10 text-warning" :
    "bg-info/10 text-info";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>;
}
