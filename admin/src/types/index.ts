import type { Timestamp } from "firebase/firestore";

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string;
  image: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryIds: string[];
  images: string[];
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SKU {
  id: string;
  skuCode: string;
  label: string;
  weightInGrams: number;
  price: number;
  unit: string;
  stock: number;
  isActive: boolean;
  createdAt: Timestamp;
}

export interface OrderItem {
  productId: string;
  skuId: string;
  productName: string;
  skuLabel: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  comboId?: string;
  comboName?: string;
}

export interface ComboItem {
  productId: string;
  productName: string;
  skuId: string;
  skuLabel: string;
  quantity: number;
}

export interface Combo {
  id: string;
  name: string;
  description: string;
  images: string[];
  price: number;
  items: ComboItem[];
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CouponUsageEntry {
  orderNumber: string;
  discountApplied: number;
  subtotalAtUse: number;
  rolledValue: number;
  usedAt: Timestamp;
}

export interface CouponApplication {
  code: string | null;
  type: "percentage" | "fixed" | "full_discount" | "variable_percentage" | "variable_fixed" | null;
  discountAmount: number;
  appliedBy: string | null;
  appliedByName: string | null;
}

export interface IssuedCoupon {
  code: string | null;
  type: "percentage" | "fixed" | "variable_percentage" | "variable_fixed" | null;
  value: number;
  validFrom: Timestamp;
  validUntil: Timestamp;
  minOrderAmount: number;
  description: string | null;
  issuedBy: string | null;
  issuedByName: string | null;
}

export interface PaymentRecord {
  method: "cash" | "bank" | "esewa" | "khalti";
  amount: number;
  receivedBy: string;
  receivedByName: string;
  receivedAt: Timestamp;
  note: string;
}

export interface StatusHistoryEntry {
  status: string;
  changedBy: string;
  changedByName: string;
  timestamp: Timestamp;
  note: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderNumber: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  deliveryNotes: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  comboDiscount: number;
  deliveryCharge: number;
  grandTotal: number;
  coupon: CouponApplication;
  issuedCoupon: IssuedCoupon | null;
  paymentMethod: "esewa" | "khalti" | "cod" | "cash" | "bank" | "credit";
  paymentStatus: "unpaid" | "paid" | "refunded" | "partial";
  paymentId: string | null;
  paidAt: Timestamp | null;
  paymentHistory: PaymentRecord[];
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "returned" | "reverted";
  statusHistory: StatusHistoryEntry[];
  deliveredAt: Timestamp | null;
  returnedAt: Timestamp | null;
  notes: string;
  source: "online" | "pos";
  createdBy: string;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  loyaltyDiscount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  deliveryNotes: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  comboDiscount: number;
  deliveryCharge: number;
  grandTotal: number;
  coupon: CouponApplication;
  issuedCoupon: IssuedCoupon | null;
  paymentMethod: "esewa" | "khalti" | "cod" | "cash" | "bank" | "credit";
  paymentStatus: "unpaid" | "paid" | "refunded" | "partial";
  paymentId: string | null;
  paidAt: Timestamp | null;
  paymentHistory: PaymentRecord[];
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "returned" | "reverted";
  statusHistory: StatusHistoryEntry[];
  deliveredAt: Timestamp | null;
  returnedAt: Timestamp | null;
  returnReason: string | null;
  deliveryPartner: string | null;
  trackingUrl: string | null;
  notes: string;
  createdBy: "customer" | string;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  loyaltyDiscount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BatchItem {
  skuId: string;
  skuCode: string;
  label: string;
  quantity: number;
  unitCost: number;
}

export interface RawMaterialUsage {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface BlendIngredient {
  materialId: string;
  materialName: string;
  qtyPerKg: number;
}

export interface BlendProductionRun {
  producedKg: number;
  totalCost: number;
  costPerKg: number;
  producedBy: string;
  producedByName: string;
  producedAt: Timestamp;
}

export interface Blend {
  id: string;
  name: string;
  quantity: number;
  avgCostPerKg: number;
  totalValue: number;
  recipe: BlendIngredient[];
  productionHistory: BlendProductionRun[];
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BlendUsage {
  blendId: string;
  blendName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface Batch {
  id: string;
  batchNumber: string;
  productId: string;
  productName: string;
  items: BatchItem[];
  totalCost: number;
  rawMaterialUsage: RawMaterialUsage[];
  blendUsage: BlendUsage[];
  linkedPurchaseId: string | null;
  notes: string;
  status: "start" | "in_progress" | "completed" | "cancelled";
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  avgUnitCost: number;
  totalValue: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Supplier ───
export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  panNumber: string;
  totalPurchased: number;
  lastPurchaseAt: Timestamp | null;
  isActive: boolean;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PurchaseItem {
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierAddress: string;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  cashPaid: number;
  due: number;
  paymentStatus: "paid" | "credit" | "partial";
  paymentHistory: PaymentRecord[];
  billImage: string;
  notes: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: Timestamp;
  paidBy: string;
  paidByName: string;
  billImage: string;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type StaffRole = "super_admin" | "manager" | "accountant" | "production_staff" | "sales_staff" | "staff" | "viewer";

export interface StaffPermissions {
  products: { read: boolean; write: boolean };
  categories: { read: boolean; write: boolean };
  orders: { read: boolean; write: boolean; delete: boolean };
  batches: { read: boolean; write: boolean };
  purchases: { read: boolean; write: boolean };
  suppliers: { read: boolean; write: boolean };
  expenses: { read: boolean; write: boolean };
  staff: { read: boolean; write: boolean };
  coupons: { read: boolean; write: boolean };
  debtors: { read: boolean; write: boolean };
  creditors: { read: boolean; write: boolean };
  reports: { read: boolean; write: boolean };
  settings: { read: boolean; write: boolean };
  logs: { read: boolean };
  accounts: { read: boolean; write: boolean };
  journal: { read: boolean; write: boolean };
  ledger: { read: boolean };
  fixedAssets: { read: boolean; write: boolean };
  employees: { read: boolean; write: boolean };
  payroll: { read: boolean; write: boolean };
  dailyRegister: { read: boolean; write: boolean };
}

export interface Staff {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  permissions: StaffPermissions;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Coupon {
  id: string;
  code: string;
  type: "percentage" | "fixed" | "full_discount" | "variable_percentage" | "variable_fixed";
  value: number;
  minValue?: number;
  maxValue?: number;
  minOrderAmount: number;
  maxUses: number;
  currentUses: number;
  totalDiscountGiven: number;
  usageHistory: CouponUsageEntry[];
  validFrom: Timestamp;
  validUntil: Timestamp;
  appliesTo: "all" | "category" | "product";
  applicableCategoryIds: string[];
  applicableProductIds: string[];
  applicableSkuIds: string[];
  isActive: boolean;
  createdBy: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DebtorOrderRef {
  orderId: string;
  orderNumber: string;
  amount: number;
  paidAmount: number;
  balance: number;
  date: Timestamp;
}

export interface Debtor {
  id: string;
  customerName: string;
  customerPhone: string;
  totalOutstanding: number;
  orders: DebtorOrderRef[];
  paymentHistory: PaymentRecord[];
  clearedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreditorPurchaseRef {
  purchaseId: string;
  purchaseNumber: string;
  amount: number;
  paidAmount: number;
  balance: number;
  date: Timestamp;
}

export interface Creditor {
  id: string;
  supplierName: string;
  supplierPhone: string;
  totalOutstanding: number;
  purchases: CreditorPurchaseRef[];
  paymentHistory: PaymentRecord[];
  clearedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  logoUrl: string | null;
  footerLogoUrl: string | null;
  logoDisplay: "logo" | "name" | "both";
  primaryColor: string;
  secondaryColor: string;
  phone: string;
  email: string;
  address: string;
  socialLinks: { facebook: string | null; instagram: string | null; youtube: string | null };
  panNumber: string | null;
  invoiceTerms: string;
  invoiceFooter: string;
  domain: string;
  whatsappNumber: string;
  updatedAt: Timestamp;
}

export interface PaymentSettings {
  esewa: { enabled: boolean; merchantId: string };
  khalti: { enabled: boolean; publicKey: string; secretKey: string };
  cod: { enabled: boolean; maxOrderAmount: number };
  updatedAt: Timestamp;
}

export interface DeliverySettings {
  deliveryChargeInside: number;
  deliveryChargeOutside: number;
  freeDeliveryThreshold: number;
  serviceArea: string[];
  maxDeliveryDays: number;
  updatedAt: Timestamp;
}

export interface NotificationSettings {
  whatsappBusinessNumber: string;
  emailNotifications: string[];
  notifyOnNewOrder: boolean;
  notifyOnLowStock: boolean;
  lowStockThreshold: number;
  updatedAt: Timestamp;
}

export interface CreditSettings {
  creditEnabled: boolean;
  maxCreditPerCustomer: number;
  overdueWarningDays: number;
  overdueDangerDays: number;
  updatedAt: Timestamp;
}

export interface BudgetSettings {
  categories: Record<string, { mode: "limit" | "track"; limit: number | null }>;
  updatedAt: Timestamp;
}

export interface BackupSettings {
  gasUrl: string;
  driveFolderId: string;
  billsFolderId: string;
  lastBackupAt: Timestamp | null;
  autoBackupEnabled: boolean;
  updatedAt: Timestamp;
}

export interface LoyaltySettings {
  enabled: boolean;
  pointsPerRupee: number;
  redemptionRate: number;
  minRedemption: number;
  maxRedemptionPercent: number;
  earnOnDeliveryOnly: boolean;
  updatedAt: Timestamp;
}

export interface LoyaltyAccount {
  phone: string;
  name: string;
  pointsBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  lastActivityAt: Timestamp;
  createdAt: Timestamp;
}

export interface LoyaltyTransaction {
  phone: string;
  type: "earn" | "redeem" | "adjust";
  points: number;
  referenceType: "invoice" | "order";
  referenceId: string;
  referenceNumber: string;
  description: string;
  createdAt: Timestamp;
}

export interface DashboardCache {
  todayOrders: number;
  pendingOrders: number;
  revenueThisMonth: number;
  lowStockItems: number;
  activeProducts: number;
  dueDebtors: number;
  dueCreditors: number;
  cashInHand: number;
  cashBreakdown: { cash: number; bank: number; esewa: number; khalti: number };
  recentActivity: { time: string; action: string; user: string }[];
  computedAt: Timestamp;
}

export interface PnlCache {
  periodStart: Timestamp;
  periodEnd: Timestamp;
  grossSales: number;
  discounts: number;
  returns: number;
  netSales: number;
  openingStock: number;
  purchases: number;
  closingStock: number;
  cogs: number;
  grossProfit: number;
  expenses: Record<string, number>;
  totalExpenses: number;
  netProfit: number;
  computedAt: Timestamp;
}

export interface BalanceSheetCache {
  assets: { cash: number; debtors: number; inventory: number; total: number };
  liabilities: { creditors: number; total: number };
  equity: { retainedEarnings: number; total: number };
  computedAt: Timestamp;
}

export interface PublicCatalogCache {
  updatedAt: Timestamp;
  version: number;
  products: {
    id: string;
    name: string;
    slug: string;
    description: string;
    images: string[];
    categoryIds: string[];
    categoryNames: string[];
    tags: string[];
    isFeatured: boolean;
    isActive: boolean;
    skus: {
      id: string;
      skuCode: string;
      label: string;
      weightInGrams: number;
      price: number;
      stock: number;
      isActive: boolean;
      isAvailable: boolean;
    }[];
    minPrice: number;
    maxPrice: number;
    isInStock: boolean;
  }[];
}

export interface StockSummaryCache {
  updatedAt: Timestamp;
  skus: {
    skuId: string;
    skuCode: string;
    productName: string;
    label: string;
    batched: number;
    sold: number;
    returned: number;
    available: number;
  }[];
}

export interface Counter {
  id: string;
  sequence: number;
  year: number;
  updatedAt: Timestamp;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  module: string;
  performedBy: string;
  performedByName: string;
  relatedDocId: string | null;
  undoable: boolean;
  undoData: Record<string, unknown> | null;
  timestamp: Timestamp;
}

// ─── Finance Module Types ────────────────────────────────────

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type NormalBalance = "debit" | "credit";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  description: string;
  isActive: boolean;
  parentCode: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export type ReferenceType = "sale" | "expense" | "purchase" | "asset" | "depreciation" | "payroll" | "coupon" | "manual" | "daily_register";

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: Timestamp;
  description: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  referenceType: ReferenceType;
  referenceId: string | null;
  posted: boolean;
  postedAt: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AssetType = "equipment" | "vehicle" | "furniture" | "computer" | "building" | "other";
export type DepreciationMethod = "straight_line" | "wdv";

export interface FixedAsset {
  id: string;
  name: string;
  assetType: AssetType;
  purchaseDate: Timestamp;
  cost: number;
  salvageValue: number;
  usefulLifeYears: number;
  depreciationMethod: DepreciationMethod;
  wdvRate: number | null;
  accumulatedDepreciation: number;
  currentBookValue: number;
  accountCode: string;
  depExpenseAccountCode: string;
  accDepAccountCode: string;
  notes: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  designation: string;
  baseSalary: number;
  taxPercent: number;
  pfPercent: number;
  bankName: string;
  bankAccount: string;
  joinedAt: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PayrollEntry {
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  workingDays: number;
  grossPay: number;
  taxDeduction: number;
  pfDeduction: number;
  otherDeductions: number;
  netPay: number;
}

export type PayrollStatus = "draft" | "approved" | "disbursed";

export interface PayrollRun {
  id: string;
  periodLabel: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  entries: PayrollEntry[];
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  status: PayrollStatus;
  disbursedAt: Timestamp | null;
  notes: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type RegisterStatus = "open" | "closed";

export interface DailyRegister {
  id: string;
  date: Timestamp;
  openingCash: number;
  openingBank: number;
  openingEsewa: number;
  openingKhalti: number;
  cashSales: number;
  bankSales: number;
  esewaSales: number;
  khaltiSales: number;
  creditSales: number;
  totalExpenses: number;
  totalPurchases: number;
  cashIn: number;
  cashOut: number;
  closingCash: number;
  closingBank: number;
  closingEsewa: number;
  closingKhalti: number;
  expectedClosingCash: number;
  cashDifference: number;
  notes: string;
  status: RegisterStatus;
  closedBy: string | null;
  closedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FinanceSheetSettings {
  sheetId: string | null;
  sheetUrl: string | null;
  lastPushAt: Timestamp | null;
  updatedAt: Timestamp;
}

export interface CashFlowCache {
  netProfit: number;
  addBackDepreciation: number;
  debtorsBalance: number;
  creditorsBalance: number;
  inventoryBalance: number;
  netOperatingCashFlow: number;
  fixedAssetCost: number;
  netInvestingCashFlow: number;
  shortLoanBalance: number;
  longLoanBalance: number;
  netFinancingCashFlow: number;
  netCashChange: number;
  openingCash: number;
  closingCash: number;
  computedAt: Timestamp;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  type: AccountType;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  normalBalance: NormalBalance;
}

export interface FinanceCache {
  trialBalance: TrialBalanceRow[];
  computedAt: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;
}

export interface FinancePnLCache {
  periodStart: Timestamp;
  periodEnd: Timestamp;
  incomeAccounts: { code: string; name: string; balance: number }[];
  expenseAccounts: { code: string; name: string; balance: number }[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  computedAt: Timestamp;
}

export interface FinanceBalanceSheetCache {
  asOfDate: Timestamp;
  assets: { code: string; name: string; balance: number }[];
  liabilities: { code: string; name: string; balance: number }[];
  equity: { code: string; name: string; balance: number }[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  computedAt: Timestamp;
}
