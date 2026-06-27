import { toBSString } from "./nepaliDate";
import { parsePhone } from "./phone";

function escapeHtml(text: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return text.replace(/[&<>"']/g, (ch) => map[ch]);
}

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const convert = (m: number): string => {
    if (m < 20) return ones[m];
    if (m < 100) return tens[Math.floor(m / 10)] + (m % 10 ? " " + ones[m % 10] : "");
    if (m < 1000) return ones[Math.floor(m / 100)] + " Hundred" + (m % 100 ? " " + convert(m % 100) : "");
    if (m < 100000) return convert(Math.floor(m / 1000)) + " Thousand" + (m % 1000 ? " " + convert(m % 1000) : "");
    return convert(Math.floor(m / 100000)) + " Lakh" + (m % 100000 ? " " + convert(m % 100000) : "");
  };
  let result = convert(Math.floor(n));
  if (n % 1 !== 0) result += " and " + convert(Math.round((n % 1) * 100)) + "/100";
  return result;
}

function npr(amount: number): string {
  return `NPR ${amount.toLocaleString("en-NP")}`;
}

function fmtDate(ts: import("firebase/firestore").Timestamp): string {
  const d = new Date(ts.seconds * 1000);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function generateInvoiceHtml(
  order: import("../types").Order,
  settings: import("../types").StoreSettings,
  logoDataUri?: string,
): string {
  const invoiceDate = order.createdAt?.seconds
    ? toBSString(new Date(order.createdAt.seconds * 1000))
    : toBSString(new Date());

  const customerPhoneDisplay = (() => {
    if (!order.customerPhone) return "";
    const p = parsePhone(order.customerPhone);
    return `${p.countryCode} ${p.number}`;
  })();

  const contacts: { icon: string; text: string }[] = [];
  if (settings.address) contacts.push({ icon: "location_on", text: settings.address });
  if (settings.phone) contacts.push({ icon: "call", text: settings.phone });
  if (settings.email) contacts.push({ icon: "mail", text: settings.email });

  const itemRows = order.items
    .map(
      (item, i) => `
<tr class="hover:bg-surface-container-low transition-colors group">
  <td class="py-6 px-6 font-body-sm text-body-sm text-smoke-gray">${i + 1}</td>
  <td class="py-6 px-6">
    <div class="flex flex-col">
      <span class="font-body-md text-body-md font-semibold text-on-surface">${escapeHtml(item.productName)}</span>
    </div>
  </td>
  <td class="py-6 px-6 text-center font-body-md text-body-md">${escapeHtml(item.skuLabel)}</td>
  <td class="py-6 px-6 text-center font-body-md text-body-md">${item.quantity}</td>
  <td class="py-6 px-6 text-right font-body-md text-body-md text-smoke-gray">${npr(item.unitPrice)}</td>
  <td class="py-6 px-6 text-right font-body-md text-body-md font-bold text-forest-rich">${npr(item.subtotal)}</td>
</tr>`,
    )
    .join("\n");

  const isPaid = order.paymentStatus === "paid";
  const statusBg = isPaid ? "bg-forest-rich/10" : "bg-slate-gray/10";
  const statusText = isPaid ? "text-forest-rich" : "text-slate-gray";
  const statusBorder = isPaid ? "border-forest-rich/20" : "border-slate-gray/20";
  const statusIcon = isPaid ? "check_circle" : "schedule";

  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" alt="${escapeHtml(settings.storeName)}" class="h-16 w-auto mb-2" />`
    : "";

  const contactHtml = contacts
    .map(
      (c) => `
<div class="flex items-center justify-end gap-2 text-slate-gray">
  <span class="font-body-sm text-body-sm">${escapeHtml(c.text)}</span>
  <span class="material-symbols-outlined text-sm">${c.icon}</span>
</div>`,
    )
    .join("\n");

  const discountRow =
    order.discount > 0
      ? `
<div class="flex justify-between items-center text-slate-gray">
  <span class="font-body-md text-body-md">Discount${order.coupon?.code ? ` (${escapeHtml(order.coupon.code)})` : ""}</span>
  <span class="font-body-md text-body-md">-${npr(order.discount)}</span>
</div>`
      : "";

  const couponSection = order.issuedCoupon?.code
    ? (() => {
        const c = order.issuedCoupon!;
        const offText = c.type === "percentage" ? `${c.value}% off` : `${npr(c.value)} off`;
        const validStr = fmtDate(c.validUntil);
        const minStr = npr(c.minOrderAmount || 0);
        const site = settings.domain || "our website";
        return `
<div class="bg-secondary-fixed p-stack-md rounded relative border border-mustard-gold/20 overflow-hidden">
  <div class="absolute top-0 right-0 p-2 opacity-10">
    <span class="material-symbols-outlined text-6xl">local_activity</span>
  </div>
  <h3 class="font-label-caps text-label-caps text-on-secondary-fixed-variant uppercase mb-2">Next Purchase Reward</h3>
  <p class="font-body-sm text-body-sm text-on-secondary-fixed mb-2">Use coupon code below to get ${offText} on your next purchase.</p>
  <p class="font-body-sm text-body-sm text-on-secondary-fixed mb-1">Valid until ${validStr}. Minimum order: ${minStr}.</p>
  <p class="font-body-sm text-body-sm text-on-secondary-fixed mb-3">Usable on ${site} or in-store.</p>
  <div class="flex items-center gap-stack-sm">
    <code class="bg-white px-4 py-2 rounded font-label-caps text-label-caps text-forest-rich font-bold tracking-widest border border-mustard-gold/30">${escapeHtml(c.code || "")}</code>
  </div>
</div>`;
      })()
    : "";

  const termsSection = settings.invoiceTerms
    ? `
<div class="flex flex-col gap-2">
  <span class="font-label-caps text-label-caps text-forest-rich uppercase border-b border-forest-rich/20 pb-1">Terms &amp; Conditions</span>
  <p class="font-body-sm text-body-sm text-smoke-gray leading-relaxed">${escapeHtml(settings.invoiceTerms)}</p>
</div>`
    : "";

  const logoDisplay = settings.logoDisplay || "both";

  // Determine if we show logo image at top-left
  const showLogo = logoDisplay !== "name" && logoDataUri;
  const showName = logoDisplay !== "logo";

  return `<!DOCTYPE html>
<html class="light" lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(settings.storeName || "Invoice")}</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Work+Sans:wght@400;600&family=JetBrains+Mono:wght@600&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
<script>
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "on-tertiary-fixed": "#121c2a",
        "surface-container-high": "#e7e8e9",
        "primary-fixed-dim": "#95d5a8",
        "slate-gray": "#374151",
        "surface-tint": "#2c6a46",
        "on-secondary-container": "#705100",
        "smoke-gray": "#6B7280",
        "surface-dim": "#d9dadb",
        "error-container": "#ffdad6",
        "outline-variant": "#c0c9bf",
        "on-background": "#191c1d",
        "secondary-fixed-dim": "#f6be41",
        "primary-container": "#1f5e3b",
        "forest-rich": "#1F5E3B",
        "secondary-container": "#fcc346",
        "secondary-fixed": "#ffdea3",
        "inverse-surface": "#2e3132",
        "surface-variant": "#e1e3e4",
        "tertiary": "#323c4c",
        "on-secondary-fixed": "#261900",
        "on-tertiary": "#ffffff",
        "surface-container-low": "#f3f4f5",
        "primary-fixed": "#b0f1c3",
        "primary": "#004626",
        "surface-bright": "#f8f9fa",
        "on-primary-fixed-variant": "#0e5130",
        "on-tertiary-fixed-variant": "#3d4757",
        "outline": "#707971",
        "secondary": "#7a5900",
        "on-primary-fixed": "#00210f",
        "mustard-gold": "#D8A326",
        "surface": "#f8f9fa",
        "on-surface": "#191c1d",
        "on-surface-variant": "#404942",
        "error": "#ba1a1a",
        "on-secondary-fixed-variant": "#5c4200",
        "inverse-on-surface": "#f0f1f2",
        "on-error-container": "#93000a",
        "on-secondary": "#ffffff",
        "background": "#f8f9fa",
        "on-primary": "#ffffff",
        "tertiary-fixed-dim": "#bdc7db",
        "on-primary-container": "#95d5a9",
        "inverse-primary": "#95d5a8",
        "surface-container": "#edeeef",
        "tertiary-fixed": "#d9e3f7",
        "surface-container-lowest": "#ffffff",
        "on-error": "#ffffff",
        "surface-container-highest": "#e1e3e4"
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      spacing: {
        "margin-mobile": "16px",
        "section-gap": "64px",
        base: "4px",
        gutter: "24px",
        "stack-sm": "8px",
        "stack-md": "16px",
        "stack-lg": "32px",
        "container-max": "1200px"
      },
      fontFamily: {
        "label-caps": ["JetBrains Mono"],
        "headline-lg": ["Manrope"],
        "body-sm": ["Work Sans"],
        "headline-md": ["Manrope"],
        "display-lg": ["Manrope"],
        "price-display": ["Work Sans"],
        "body-lg": ["Work Sans"],
        "body-md": ["Work Sans"]
      },
      fontSize: {
        "label-caps": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600" }],
        "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
        "body-sm": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
        "headline-md": ["24px", { "lineHeight": "32px", "fontWeight": "600" }],
        "display-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "800" }],
        "price-display": ["20px", { "lineHeight": "24px", "fontWeight": "600" }],
        "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "400" }],
        "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }]
      }
    }
  }
};
<\/script>
<style>
.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
@media print {
  .no-print { display: none !important; }
  body { background-color: white !important; }
  .invoice-shadow { box-shadow: none !important; border: 1px solid #E5E7EB !important; }
  @page { margin: 8mm; }
}
.invoice-card {
  background-image: radial-gradient(circle at 2px 2px, #f1f1f1 1px, transparent 0);
  background-size: 24px 24px;
}
<\/style>
</head>
<body class="bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col items-center py-stack-lg">
<header class="bg-forest-rich fixed top-0 w-full z-50 no-print">
  <div class="flex justify-between items-center w-full px-gutter py-4 max-w-container-max mx-auto">
    <div class="font-headline-md text-headline-md font-bold text-on-primary">${escapeHtml(settings.storeName || "Invoice")}</div>
    <div class="flex items-center gap-stack-md text-on-primary">
      <button class="flex items-center gap-2 px-4 py-2 bg-on-primary-fixed-variant rounded hover:opacity-90 transition-opacity" onclick="window.print()">
        <span class="material-symbols-outlined">print</span>
        <span class="font-label-caps text-label-caps">Download PDF</span>
      </button>
    </div>
  </div>
</header>
<main class="mt-20 w-full max-w-container-max px-gutter mb-stack-lg">
  <div id="invoice-content" class="bg-white rounded-lg border border-outline-variant invoice-shadow overflow-hidden relative">
    <div class="absolute left-0 top-0 bottom-0 w-1 bg-forest-rich"></div>
    <div class="p-gutter md:p-stack-lg">
      <div class="flex flex-col md:flex-row justify-between items-start border-b border-outline-variant pb-stack-lg gap-stack-md">
        <div>
          ${showLogo ? logoHtml : ""}
          ${showName ? `<h1 class="font-headline-lg text-headline-lg text-forest-rich mb-2">${escapeHtml(settings.storeName || "Great Pickle Taste")}</h1>` : ""}
          ${settings.tagline && showName ? `<p class="font-label-caps text-label-caps text-forest-rich">${escapeHtml(settings.tagline)}</p>` : ""}
        </div>
        <div class="text-right flex flex-col gap-1">
          ${contactHtml}
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-stack-lg py-stack-lg">
        <div class="flex flex-col gap-2">
          <h2 class="font-headline-md text-headline-md text-slate-gray">INVOICE</h2>
          <div class="flex flex-col">
            <span class="font-label-caps text-label-caps text-smoke-gray uppercase">Invoice Number</span>
            <span class="font-body-lg text-body-lg font-semibold">${escapeHtml(order.orderNumber)}</span>
          </div>
          <div class="flex flex-col">
            <span class="font-label-caps text-label-caps text-smoke-gray uppercase">Invoice Date</span>
            <span class="font-body-md text-body-md">${invoiceDate}</span>
          </div>
        </div>
        <div class="flex flex-col gap-4">
          <div class="flex flex-col">
            <span class="font-label-caps text-label-caps text-smoke-gray uppercase mb-2">Payment Status</span>
            <div class="inline-flex w-fit items-center px-3 py-1 ${statusBg} ${statusText} border ${statusBorder} rounded-full">
              <span class="material-symbols-outlined text-sm mr-2" style="font-variation-settings: 'FILL' 1;">${statusIcon}</span>
              <span class="font-label-caps text-label-caps">${escapeHtml(order.paymentStatus.toUpperCase())}</span>
            </div>
          </div>
          <div class="flex flex-col">
            <span class="font-label-caps text-label-caps text-smoke-gray uppercase">Payment Method</span>
            <span class="font-body-md text-body-md font-medium">${escapeHtml(order.paymentMethod.toUpperCase())}</span>
          </div>
          <div class="flex flex-col">
            <span class="font-label-caps text-label-caps text-smoke-gray uppercase">Order Status</span>
            <span class="font-body-md text-body-md font-medium">${escapeHtml(order.status.toUpperCase())}</span>
          </div>
        </div>
        <div class="flex flex-col gap-2 bg-surface-container-low p-stack-md rounded">
          <span class="font-label-caps text-label-caps text-smoke-gray uppercase">Bill To</span>
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-forest-rich">person</span>
            <span class="font-headline-md text-headline-md text-on-surface">${escapeHtml(order.customerName)}</span>
          </div>
          ${order.customerPhone ? `<span class="font-body-sm text-body-sm text-smoke-gray">${escapeHtml(customerPhoneDisplay)}</span>` : ""}
          ${order.customerEmail ? `<span class="font-body-sm text-body-sm text-smoke-gray">${escapeHtml(order.customerEmail)}</span>` : ""}
          ${order.shippingAddress ? `<span class="font-body-sm text-body-sm text-smoke-gray">${escapeHtml(order.shippingAddress)}</span>` : ""}
        </div>
      </div>
      <div class="mt-stack-md overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-forest-rich text-on-primary">
              <th class="py-4 px-6 font-label-caps text-label-caps">#</th>
              <th class="py-4 px-6 font-label-caps text-label-caps">Item Description</th>
              <th class="py-4 px-6 font-label-caps text-label-caps text-center">SKU/Size</th>
              <th class="py-4 px-6 font-label-caps text-label-caps text-center">Qty</th>
              <th class="py-4 px-6 font-label-caps text-label-caps text-right">Unit Price</th>
              <th class="py-4 px-6 font-label-caps text-label-caps text-right">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant">
            ${itemRows}
          </tbody>
        </table>
      </div>
      <div class="flex flex-col md:flex-row justify-between items-start mt-stack-lg pt-stack-lg border-t-2 border-forest-rich">
        <div class="w-full md:w-1/2 mb-stack-lg md:mb-0">
          ${couponSection}
        </div>
        <div class="w-full md:w-1/3 flex flex-col gap-3">
          <div class="flex justify-between items-center text-slate-gray">
            <span class="font-body-md text-body-md">Subtotal</span>
            <span class="font-price-display text-price-display">${npr(order.subtotal)}</span>
          </div>
          ${discountRow}
          <div class="flex justify-between items-center text-slate-gray">
            <span class="font-body-md text-body-md">Delivery Fee</span>
            <span class="font-body-md text-body-md">${npr(order.deliveryCharge)}</span>
          </div>
          <div class="h-px bg-outline-variant w-full my-2"></div>
          <div class="flex justify-between items-center bg-forest-rich p-stack-md rounded text-on-primary">
            <span class="font-headline-md text-headline-md">Grand Total</span>
            <span class="font-headline-lg text-headline-lg">${npr(order.grandTotal)}</span>
          </div>
          <p class="text-right font-body-sm text-body-sm text-smoke-gray italic">Prices inclusive of all taxes.</p>
          <p class="mt-2 font-body-sm text-body-sm text-smoke-gray">Amount in Words: <span class="font-medium text-slate-gray">${numberToWords(order.grandTotal)} Rupees Only</span></p>
        </div>
      </div>
      <div class="mt-section-gap grid grid-cols-1 md:grid-cols-2 gap-stack-lg">
        ${termsSection}
        <div class="flex flex-col justify-end items-end">
          <div class="text-center">
            <p class="font-headline-md text-headline-md text-forest-rich italic mb-1">Thank you for shopping with us!</p>
            <p class="font-body-sm text-body-sm text-smoke-gray">We appreciate your support for local artisanal makers.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="mt-stack-lg flex justify-center no-print">
    <button class="px-8 py-3 bg-forest-rich text-on-primary font-label-caps text-label-caps rounded-full flex items-center gap-2 hover:bg-primary transition-all transform hover:scale-105 shadow-lg" onclick="window.print()">
      <span class="material-symbols-outlined">print</span>
      Download Invoice (PDF)
    </button>
  </div>
</main>
<footer class="w-full mt-auto bg-surface-container-low border-t border-outline-variant py-stack-lg px-gutter flex flex-col md:flex-row justify-between items-center max-w-container-max mx-auto no-print">
  <div>
    <span class="font-label-caps text-label-caps text-forest-rich">${escapeHtml(settings.storeName || "Great Pickle Taste")}</span>
    <p class="font-body-sm text-body-sm text-slate-gray mt-1">&copy; ${new Date().getFullYear()} ${escapeHtml(settings.storeName || "Great Pickle Taste")}. All rights reserved.</p>
    ${settings.panNumber ? `<p class="font-body-sm text-body-sm text-slate-gray mt-0.5">PAN: ${escapeHtml(settings.panNumber)}</p>` : ""}
  </div>
  <div class="flex gap-stack-md">
    ${settings.domain ? `<a class="font-body-sm text-body-sm text-slate-gray hover:text-mustard-gold transition-colors" href="https://${escapeHtml(settings.domain)}">${escapeHtml(settings.domain)}</a>` : ""}
  </div>
</footer>
</body>
</html>`;
}
