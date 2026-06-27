import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toBSString } from "./nepaliDate";
import { parsePhone } from "./phone";
import { toDirectDriveUrl } from "./driveUrl";
import type { Order, StoreSettings } from "../types";

export function generateInvoice(order: Order, settings: StoreSettings, logoDataUri?: string, logoAspectRatio?: number): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  const pw = 210, ph = 297;
  const m = 12, cw = pw - m * 2;

  const gray = "#6B7280";
  const dark = "#1F2937";
  const green = "#1F5E3B";
  const white = "#FFFFFF";

  const npr = (v: number) => `NPR ${v.toLocaleString("en-NP")}`;
  const bsDate = (ts?: { seconds: number }) =>
    ts ? toBSString(new Date(ts.seconds * 1000)) : toBSString(new Date());

  // Header: logo (left), contact + PAN (right)
  let y = 18;
  if (logoDataUri) {
    try {
      const logoH = 16;
      const logoW = logoAspectRatio ? Math.round(logoH * logoAspectRatio) : 14;
      doc.addImage(logoDataUri, "PNG", m, y - logoH, logoW, logoH);
    } catch { /* skip */ }
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(dark);
  const contact = [settings.phone ? `Tel: ${settings.phone}` : "", settings.email, settings.address].filter(Boolean);
  contact.forEach((line, i) => {
    doc.text(line, m + cw - doc.getTextWidth(line), y - contact.length * 3 + i * 4 + 4);
  });
  if (settings.panNumber) {
    doc.setTextColor(green);
    doc.setFont("helvetica", "bold");
    doc.text(`PAN: ${settings.panNumber}`, m + cw - doc.getTextWidth(`PAN: ${settings.panNumber}`), y - contact.length * 3 - 4);
    doc.setTextColor(dark);
    doc.setFont("helvetica", "normal");
  }

  // Divider
  y = y + 8;
  doc.setDrawColor("#D1D5DB");
  doc.setLineWidth(0.3);
  doc.line(m, y, m + cw, y);
  y += 8;

  // Invoice info: number, date, customer
  doc.setTextColor(gray);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", m, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(dark);
  doc.setFontSize(10);
  doc.text(order.orderNumber, m + 16, y);

  y += 6;
  doc.setTextColor(gray);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("DATE", m, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(dark);
  doc.setFontSize(10);
  doc.text(bsDate(order.createdAt), m + 16, y);

  // Customer info (right side)
  const custX = m + cw * 0.55;
  doc.setTextColor(gray);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", custX, y - 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(dark);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(order.customerName, custX, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray);
  doc.setFontSize(9);
  const pf = parsePhone(order.customerPhone);
  let phoneLine = `${pf.countryCode} ${pf.number}`;
  if (order.customerEmail) phoneLine += `  |  ${order.customerEmail}`;
  doc.text(phoneLine, custX, y + 6);
  if (order.shippingAddress) {
    doc.text(order.shippingAddress, custX, y + 12);
  }

  // Payment info (left side, below DATE)
  const payLabels: Record<string, string> = { esewa: "eSewa", khalti: "Khalti", cod: "COD", cash: "Cash", bank: "Bank", credit: "Credit" };
  const payStatus = order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1);
  doc.setTextColor(gray);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT", m, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(dark);
  doc.setFontSize(10);
  doc.text(`${payLabels[order.paymentMethod] || order.paymentMethod}  |  ${payStatus}`, m + 18, y + 6);

  // Items table
  y = y + 22;
  const body = order.items.map((item, i) => [
    i + 1,
    item.productName,
    item.skuLabel,
    item.quantity,
    npr(item.unitPrice),
    npr(item.subtotal),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Product", "SKU", "Qty", "Unit Price", "Total"]],
    body,
    headStyles: { fillColor: green, textColor: white, fontStyle: "bold", fontSize: 9, font: "helvetica", cellPadding: { top: 4, bottom: 4, left: 4, right: 4 } },
    bodyStyles: { fontSize: 9, textColor: dark, font: "helvetica", cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } },
    alternateRowStyles: { fillColor: "#F9FAFB" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: cw - 10 - 24 - 12 - 28 - 28, halign: "left" },
      2: { cellWidth: 24, halign: "left", fontSize: 8 },
      3: { cellWidth: 12, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
    },
    margin: { left: m, right: m },
    tableLineColor: "#D1D5DB",
    tableLineWidth: 0.2,
  });

  // ── Two columns after items table ──
  const colY = (doc as any).lastAutoTable.finalY + 8;
  const totalsX = m + cw * 0.5;
  const rightW = m + cw - totalsX;

  // ── Right column: Totals ──
  let ry = colY;
  const lines = [
    { label: "Subtotal", val: npr(order.subtotal) },
    ...(order.discount > 0 ? [{ label: order.coupon?.code ? `Discount (${order.coupon.code})` : "Discount", val: `-${npr(order.discount)}` }] : []),
    { label: "Delivery", val: npr(order.deliveryCharge) },
  ];
  doc.setFontSize(10);
  lines.forEach((l, i) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(dark);
    doc.text(l.label, totalsX, ry + i * 7);
    doc.text(l.val, m + cw, ry + i * 7, { align: "right" });
  });
  ry = ry + lines.length * 7 + 6;
  doc.setFillColor(green);
  doc.rect(totalsX, ry, rightW, 14, "F");
  doc.setTextColor(white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("GRAND TOTAL", totalsX + 4, ry + 10);
  doc.setFontSize(12);
  doc.text(npr(order.grandTotal), m + cw - 4, ry + 10, { align: "right" });
  ry += 16;

  // ── Full-width section below grand total: Amount in words + Terms ──
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function toWords(n: number): string {
    if (n === 0) return "Zero";
    const c = (m: number): string => {
      if (m < 20) return ones[m];
      if (m < 100) return tens[Math.floor(m / 10)] + (m % 10 ? " " + ones[m % 10] : "");
      if (m < 1000) return ones[Math.floor(m / 100)] + " Hundred" + (m % 100 ? " " + c(m % 100) : "");
      if (m < 100000) return c(Math.floor(m / 1000)) + " Thousand" + (m % 1000 ? " " + c(m % 1000) : "");
      return c(Math.floor(m / 100000)) + " Lakh" + (m % 100000 ? " " + c(m % 100000) : "");
    };
    return c(Math.floor(n));
  }
  doc.setTextColor(gray);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text("Amount in Words:", m, ry);
  doc.setTextColor(dark);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const wordLines = doc.splitTextToSize(`${toWords(order.grandTotal)} Rupees Only`, cw);
  doc.text(wordLines, m, ry + 5);
  ry = ry + (wordLines.length * 4) + 8;

  const hasLoyalty = (order.loyaltyPointsEarned ?? 0) > 0;
  if (settings.invoiceTerms || hasLoyalty) {
    doc.setTextColor(gray);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Terms & Conditions", m, ry);
    ry += 5;
    doc.setTextColor(dark);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    if (settings.invoiceTerms) {
      const tl = doc.splitTextToSize(settings.invoiceTerms, cw);
      doc.text(tl, m, ry);
      ry += tl.length * 4 + 6;
    }
    if (hasLoyalty) {
      doc.setFont("helvetica", "bold");
      const domain = settings.domain || "greatpickle.com.np";
      const loyaltyUrl = `https://${domain}/loyalty`;
      const loyaltyLine = `You have earned ${order.loyaltyPointsEarned} loyalty points. Track and know more about our loyalty program visit at ${loyaltyUrl}`;
      const ll = doc.splitTextToSize(loyaltyLine, cw);
      doc.text(ll, m, ry);
      ry += ll.length * 4 + 6;
    }
  }

  // ── Left column: Next Purchase Reward ──
  let ly = colY;
  if (order.issuedCoupon?.code) {
    const cp = order.issuedCoupon;
    const offText = cp.type === "percentage" ? `${cp.value}% OFF` : `${npr(cp.value)} OFF`;
    const validStr = cp.validUntil ? new Date(cp.validUntil.seconds * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
    const minStr = npr(cp.minOrderAmount || 0);
    const code = cp.code || "";
    const boxW = totalsX - m - 4;
    const boxY = ly - 3;
    const boxH = 18;
    doc.setFillColor("#FFFBEB");
    doc.setDrawColor("#FCD34D");
    doc.roundedRect(m, boxY, boxW, boxH, 2, 2, "FD");
    doc.setTextColor(gray);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Next Purchase Reward", m + 3, ly);
    ly += 4;
    doc.setTextColor(dark);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Get ${offText}. Valid till ${validStr} (Min: ${minStr}).`, m + 3, ly);
    ly += 4;
    doc.setTextColor(green);
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(`Code: ${code}`, m + 3, ly);
    ly += 14;
  }

  // Footer (use whichever column is taller)
  y = Math.max(ry, ly, 248);
  doc.setFillColor(green);
  doc.rect(m, y, cw, 16, "F");
  doc.setTextColor(white);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Thank you for your order!", m + 3, y + 7);
  const domain = settings.domain || "";
  if (domain) doc.text(domain, m + cw - 3, y + 7, { align: "right" });

  return doc;
}

export async function loadImageAsBase64(url: string): Promise<string> {
  const resp = await fetch(url, { mode: "cors" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadLogo(url: string): Promise<{ dataUri: string; aspectRatio: number }> {
  const dataUri = await loadImageAsBase64(url);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Decode timeout")), 8000);
    img.onload = () => { clearTimeout(timer); resolve(); };
    img.onerror = (e) => { clearTimeout(timer); reject(e); };
    img.src = dataUri;
  });
  return { dataUri, aspectRatio: img.naturalWidth / img.naturalHeight };
}

async function loadLogoWithUrl(url: string): Promise<{ dataUri: string; aspectRatio: number } | null> {
  const candidates: string[] = [];
  if (url.startsWith("http")) {
    candidates.push(toDirectDriveUrl(url));
  } else {
    const path = url.startsWith("/") ? url : `/images/${url}`;
    const basePath = typeof window !== "undefined" ? window.location.pathname.replace(/\/[^/]*$/, "") : "";
    candidates.push(`${basePath}${path}`);
    candidates.push(`http://[::1]:3000${path}`);
    candidates.push(`http://localhost:3000${path}`);
  }
  for (const c of candidates) {
    try { return await loadLogo(c); } catch {}
  }
  return null;
}

export async function downloadInvoice(order: Order, settings: StoreSettings): Promise<void> {
  const logo = settings.logoUrl ? await loadLogoWithUrl(settings.logoUrl) : null;
  const doc = generateInvoice(order, settings, logo?.dataUri, logo?.aspectRatio);
  doc.save(`${order.orderNumber}.pdf`);
}

export async function previewInvoice(order: Order, settings: StoreSettings): Promise<string> {
  const logo = settings.logoUrl ? await loadLogoWithUrl(settings.logoUrl) : null;
  const doc = generateInvoice(order, settings, logo?.dataUri, logo?.aspectRatio);
  return doc.output("datauristring");
}

export function whatsappInvoice(order: Order, settings: StoreSettings): string {
  const message = encodeURIComponent(
    `Order Confirmation - ${settings.storeName || "Great Pickle Taste"}\n\n` +
    `Order #: ${order.orderNumber}\n` +
    `Total: NPR ${order.grandTotal.toLocaleString()}\n` +
    `Status: ${order.status}\n\n` +
    `Thank you for your order!`
  );
  const phone = settings.whatsappNumber?.replace(/[\s\-+]/g, "") || "";
  return `https://wa.me/${phone}?text=${message}`;
}

export async function shareInvoiceWhatsApp(order: Order, settings: StoreSettings): Promise<void> {
  const logo = settings.logoUrl ? await loadLogoWithUrl(settings.logoUrl) : null;
  const doc = generateInvoice(order, settings, logo?.dataUri, logo?.aspectRatio);
  const pdfBlob = doc.output("blob");
  const file = new File([pdfBlob], `${order.orderNumber}.pdf`, { type: "application/pdf" });
  const shareData: ShareData = {
    files: [file],
    title: `Invoice ${order.orderNumber}`,
    text: `Order Confirmation - ${settings.storeName || "Great Pickle Taste"}\n` +
      `Order #: ${order.orderNumber}\n` +
      `Total: NPR ${order.grandTotal.toLocaleString("en-NP")}\n` +
      `Status: ${order.status}\n\n` +
      `Thank you for your order!`,
  };
  if (navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.warn("shareInvoice navigator.share failed:", err);
    }
  }
  doc.save(`${order.orderNumber}.pdf`);
}
