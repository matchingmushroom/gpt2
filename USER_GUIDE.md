# Great Pickle Taste — User Guide

## Overview

Great Pickle Taste is a full-featured e-commerce + POS web application for a pickle manufacturing business. It has two parts:

- **Admin Panel** (`http://localhost:5173/`) — Staff login to manage products, orders, POS, inventory, finance, and settings
- **Client Site** (`http://localhost:3000/`) — Public storefront for customers to browse products and place orders

---

# 1. Admin Panel

## 1.1 Login

1. Open `http://localhost:5173/` in your browser
2. Enter your email and password (staff accounts are created by Super Admin)
3. You'll land on the **Dashboard**

## 1.2 Dashboard

Shows KPIs: today's orders, pending orders, monthly revenue, active products, low stock items, cash breakdown, and recent activity.

- **Trigger Period Close** button — recomputes all cache documents (dashboard, P&L, Balance Sheet, Finance)
- Data refreshes on page load

---

## 2. Sales Module

### 2.1 Orders (Online Orders)

Shows customer orders placed from the client site.

**Status workflow:** `pending → confirmed → processing → shipped → delivered`

Actions:
- Click an order to view details (items, customer info, payment)
- **Update Status** — move order through workflow; cancellation locks stock
- **Record Payment** — mark unpaid orders as paid; earns loyalty points
- **Print Invoice** — generates a clean PDF invoice

### 2.2 Invoices (POS & Manual)

All invoices from POS and online orders with payment recorded.

Actions:
- Click an invoice to view details
- **Record Payment** — for unpaid invoices; also posts coupon discount to finance journal
- **Revert Invoice** — restores stock for all SKUs; reverses loyalty points
- **Print Invoice** — PDF with logo, order details, loyalty points, coupon info, amount in words
- **Migrate Phone** — in Settings, bulk-fixes phone numbers missing country code

### 2.3 Quick Sale (POS)

Point-of-sale interface for in-store purchases.

**How to use a sale:**
1. Select **Products** or **Combos** tab
2. Click products to add to cart (only in-stock items shown)
3. For walk-in customers, leave customer name blank (defaults to "Walk-in")
4. Enter phone with country code dropdown (e.g. +977 98XXXXXXXX) — enables loyalty lookup
5. Apply coupon code if applicable
6. **Loyalty redemption:** if customer has enough points, enter redemption amount for a discount
7. Select payment method (cash/bank/esewa/khalti/credit)
8. Click **Pay** — creates invoice, deducts stock, earns loyalty points, posts finance journal entry

### 2.4 Coupons

Create and manage discount coupons.

Types: `percentage`, `fixed`, `full_discount`, `variable_percentage`, `variable_fixed`

- Set value, min order amount, max uses, validity period
- Coupon usage is tracked; coupon discounts auto-post to Marketing Expense in finance

### 2.5 Combos

Create product bundles referencing existing product SKUs.

- Name, description, price, images (multi-image via Google Drive upload)
- Add items by selecting product → SKU → quantity
- Shows savings vs individual SKU prices
- Active combos appear on client homepage and POS

---

## 3. Inventory Module

### 3.1 Products

Manage product catalog.

- Name, slug, description, categories, tags, images (multi-image upload)
- Each product has **SKUs** (variants): label, weight, price, stock quantity, unit
- SKUs are stored in `products/{productId}/skus/{skuId}` subcollection
- Stock is tracked per-SKU with floor at 0

### 3.2 Categories

Organize products into categories (supports parent/child hierarchy).

### 3.3 Batches

Track production batches for manufacturing.

- Add items (SKUs + quantity + unit cost) and link raw materials/blend usage
- Status: `start → in_progress → completed`
- Tracks total production cost

### 3.4 Inventory

Overview of all SKUs with stock levels, batch tracking, and low-stock alerts.

### 3.5 Adjustments

Record stock loss or damage.

- Select product → SKU → enter quantity and description
- Creates an expense document under "Stock Loss" or "Stock Damage" category
- Deducts stock via Firestore transaction

### 3.6 Purchases

Record raw material purchases from suppliers.

- Create purchase with items, costs, payment (cash/credit/partial)
- Upload bill image to Google Drive
- Auto-posts finance journal entry on creation

### 3.7 Suppliers

Manage supplier records with purchase history.

---

## 4. Finance Module

The finance module implements **double-entry accounting** with a standard Nepali Chart of Accounts (35 accounts auto-seeded).

### 4.1 Chart of Accounts

35 standard Nepali accounts are auto-seeded when first accessed:

| Code | Name | Type | Normal |
|------|------|------|--------|
| 10100 | Cash in Hand | Asset | Debit |
| 10200 | Bank Accounts | Asset | Debit |
| 10300 | Accounts Receivable | Asset | Debit |
| 10400 | Inventory | Asset | Debit |
| 10500 | Fixed Assets (Cost) | Asset | Debit |
| 10501 | Accumulated Depreciation | Asset | Credit |
| 20100 | Accounts Payable | Liability | Credit |
| 20400 | Tax Payable | Liability | Credit |
| 20500 | Provident Fund Payable | Liability | Credit |
| 30100 | Retained Earnings | Equity | Credit |
| 30200 | Current Year Profit/Loss | Equity | Credit |
| 40100 | Sales Revenue | Income | Credit |
| 40200 | Discount Allowed | Income | Debit |
| 50100 | Cost of Goods Sold | Expense | Debit |
| 50500 | Rent Expense | Expense | Debit |
| 50600 | Utilities Expense | Expense | Debit |
| 50700 | Marketing Expense | Expense | Debit |
| 50800 | Salary & Wages | Expense | Debit |
| 51200 | Depreciation Expense | Expense | Debit |
| ... | *(26 more)* | | |

Actions:
- **Add Account** — create custom accounts
- **Re-seed Default** — re-run auto-seeding (won't overwrite existing)

### 4.2 Journal Entries

Records all double-entry transactions with debits = credits enforced.

Entries are created two ways:
1. **Auto-posted** — Sales, Expenses, Purchases, Coupon discounts post automatically
2. **Manual** — Click "+ New Entry" to create custom entries

Each entry has:
- Entry number (format: `JE-2082-0001`)
- Date, description, reference type
- Lines with account selection, debit/credit amounts
- Totals must balance (debits = credits)

### 4.3 General Ledger

View all transactions for any account.

1. Select an account from the dropdown
2. Shows all journal entries affecting that account with running balance
3. Running balance follows normal balance direction (debit-normal: +debit -credit)

### 4.4 Trial Balance

Shows all accounts with their total debits, total credits, and net balance.

- Accounts grouped by type (Assets, Liabilities, Equity, Income, Expenses)
- Footer shows grand total (debits should equal credits)
- Click **Refresh** to re-compute

### 4.5 Fixed Assets

Manage fixed assets and run depreciation.

**Add an asset:**
1. Click "+ Add Asset"
2. Enter: name, type (equipment/vehicle/furniture/computer/building/other), purchase date, cost, salvage value, useful life (years)
3. Select depreciation method: **Straight Line** (SL) or **Written Down Value** (WDV)
4. For WDV, set the rate (e.g. 0.15 = 15%)
5. COA mapping selects which accounts are affected

**Run Depreciation:**
1. Click "Run Depreciation"
2. Enter period start and end dates
3. System creates journal entries: Dr Depreciation Expense, Cr Accumulated Depreciation
4. Updates each asset's accumulated depreciation and book value

**Important:** SL depreciation calculates the period increment (total from purchase minus already-accumulated). WDV applies the rate to the declining book value.

### 4.6 Employees

Manage employee records for payroll.

- Name, code, phone, email, designation, base salary, join date
- Tax percentage (%) and PF percentage (%)
- Bank name and account number for salary transfer
- Active/Inactive toggle

### 4.7 Payroll

Generate and process payroll runs.

**Workflow:** `Draft → Approved → Disbursed`

1. Click **"+ Generate Payroll"**
2. Enter period label (e.g. "2082-04"), start/end dates
3. Click **Preview** — calculates pro-rata salaries based on working days
4. Shows each employee: working days, gross pay, tax deduction, PF deduction, net pay
5. Click **Save Payroll Run** (Draft status)
6. In the table, click **Approve** to move to Approved
7. Click **Disburse** — creates a journal entry (Dr Salary, Cr Bank/Tax Payable/PF Payable) and marks as Disbursed
8. For disbursed runs, click **View > Payslip** to see per-employee payslip

**Pro-rata calculation:** If an employee joined mid-period, salary is prorated based on working days (Mon-Sat) vs total working days in the period.

### 4.8 Daily Register

Track daily cash movements.

**How to use:**
1. Select a date
2. Click **Open Register** — auto-populates opening balances from previous day's closing
3. View today's transactions (cash sales, bank sales, eSewa, Khalti, credit sales, expenses, purchases)
4. Enter actual cash count, manual cash in/out
5. System shows expected closing cash and cash difference
6. Add notes, then click **Close Register** — creates a summary journal entry

### 4.9 Reports

**Reports available:**

| Report | Description |
|--------|-------------|
| Profit & Loss | Revenue, COGS, gross profit, expenses, net profit (from cache) |
| Balance Sheet | Assets, liabilities, equity snapshot (from cache) |
| Finance P&L | Double-entry P&L from journal entries |
| Finance Balance Sheet | Double-entry BS from journal entries |
| COGS Detail | Opening stock, raw materials, closing stock |
| Expenses | Expenses grouped by category |
| Aging Summary | Overdue debtors and creditors |
| KPI Snapshot | Current dashboard KPI values |

**Buttons:**
- **Migrate Transactions** — one-time: creates journal entries for all existing paid invoices, expenses, and purchases
- **Compute Finance Cache** — computes Finance P&L and Balance Sheet cache documents
- **Push to Sheets** — sends all finance data to Google Sheets (see Section 6)
- **Trigger Period Close** — recomputes all caches

### 4.10 Debtors & Creditors

Track customers with outstanding credit and suppliers with outstanding payables.

- Shows total outstanding, per-order breakdown, payment history
- Record payments against specific invoices/purchases

---

## 5. Admin Section

### 5.1 Staff

Manage team members.

**Roles:**
| Role | Access |
|------|--------|
| Super Admin | Full access |
| Manager | Most modules (no staff write, no settings write) |
| Accountant | Finance-only (accounts, journal, ledger, fixed assets, employees, payroll, daily register, expenses, debtors, creditors, reports) |
| Production Staff | Products read, batches, purchases, expenses |
| Sales Staff | Products read, orders, coupons, debtors |
| Staff | Limited read/write |
| Viewer | Read-only |

- Permissions can be customized per-staff via the permission matrix
- Phone must be exactly 10 digits

### 5.2 Settings

Configure the store.

**Tabs:**
- **Store** — Name, tagline, logo, footer logo, colors, contact info, PAN, invoice terms
- **Payments** — eSewa, Khalti, COD configuration
- **Delivery** — Charges, free delivery threshold, service area
- **Notifications** — WhatsApp business number, email notifications
- **Credit** — Enable credit sales, max credit, overdue warnings
- **Budgets** — Expense category budgets (track or limit mode)
- **Backup** — GAS Web App URL, Drive folder IDs, manual/auto backup
- **Loyalty** — Points per rupee, redemption rate, min redemption, max %
- **Finance Sheet** — Google Sheet ID/URL for finance push (see Section 6)

### 5.3 Activity Logs

Audit trail of all actions performed in the admin panel.

---

## 6. Google Sheets Integration

Push finance data to Google Sheets for reporting/analysis.

### Setup

1. Open your GAS project at https://script.google.com
2. Copy the entire contents of `gas/Backup.gs` into the editor
3. Deploy as Web App: **Deploy → New Deployment** → Type: Web App, Execute as: Me, Access: Anyone
4. Copy the deployment URL
5. In Admin → Settings → Backup, paste the URL in **GAS Web App URL**

### First Push

1. Go to Admin → Settings → **Finance Sheet**
2. Ensure GAS URL is configured in Backup tab
3. Click **Push Finance Data to Sheets**
4. GAS creates a new sheet named `GPT Finance Report - YYYY-MM-DD` in your Google Drive
5. **Due to browser CORS limits, the URL cannot be captured automatically**
6. Go to Google Drive → find the sheet → open it
7. Copy the **Sheet ID** from the URL: `https://docs.google.com/spreadsheets/d/`**`1BxiMVs0XRA...`**`/edit`
8. Paste it in the **Sheet ID** field in Settings → Finance Sheet
9. Also paste the full sheet URL
10. Click **Save Changes**

### Subsequent Pushes

Data is **overwritten** in all 6 tabs:
1. **ChartOfAccounts** — All accounts
2. **JournalEntries** — All journal entries
3. **TrialBalance** — Current trial balance
4. **FixedAssets** — All assets with depreciation
5. **Payroll** — All payroll runs
6. **DailyRegister** — All daily registers

---

## 7. Client Site

The client site (`http://localhost:3000/`) is the public storefront.

### Pages
- **Home** — Hero section, Combo carousel, Featured products
- **Products** — Browse by category, search, filter
- **Product Detail** — SKU selection, add to cart
- **Cart** — Review items, apply coupon
- **Checkout** — Enter details, place order (COD/eSewa/Khalti)
- **Loyalty** — Look up points balance by phone number

### Loyalty Program

- Rs 100 spend → 1 point
- 1 point = Rs 1 discount
- Minimum 100 points to redeem
- Max 50% of order total redeemable
- Points earned when payment is received
- Look up balance at `/loyalty` with phone number (country code + 10 digits)

---

## 8. Troubleshooting

### "Failed to write accounts/10100"
**Cause:** Firestore security rules block the write.
**Fix:** Publish `firestore.rules` in Firebase Console:
1. Go to https://console.firebase.google.com/project/great-pickle-taste/firestore/rules
2. Paste the content from `firestore.rules` file
3. Click **Publish**

### Sheet not created after Push
**Cause:** GAS web app not updated.
**Fix:** Re-deploy the GAS project with the latest `Backup.gs` code.

### Logo not showing in sidebar
**Fix:** Set the logo URL in Settings → Store (upload via ImageUploader or paste URL). Ensure the file exists at the path.

### Phone migration needed
In Invoices page, use the migration utility to prepend `+977` to bare phone numbers.

### "Debits must equal credits"
A journal entry or auto-posting failed because debits ≠ credits. Check the entry lines for errors.

---

## 9. Architecture Notes

- **Stock:** Stored in `products/{productId}/skus/{skuId}` subcollection
- **Loyalty:** Zero-read upsert pattern using `setDoc` + `{merge: true}` + `increment()`
- **Phone format:** Always `+9779812345678` (country code + 10 digits)
- **Invoice PDF:** Generated client-side with jsPDF, logo loaded from same origin
- **Cache:** Finance P&L/BS cached to reduce Firestore reads (~97% reduction)
- **Finance:** Double-entry enforced; auto-posting idempotent (checks existing reference)
