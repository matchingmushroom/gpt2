import { Timestamp } from "firebase/firestore";
import { setDocument } from "../lib/firestore";
import type { Account } from "../types";

interface SeedAccount {
  code: string;
  name: string;
  type: Account["type"];
  normalBalance: Account["normalBalance"];
  description: string;
  parentCode: string | null;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  { code: "10100", name: "Cash in Hand", type: "asset", normalBalance: "debit", description: "Physical cash on premises", parentCode: null },
  { code: "10200", name: "Bank Accounts", type: "asset", normalBalance: "debit", description: "All business bank accounts", parentCode: null },
  { code: "10300", name: "Accounts Receivable", type: "asset", normalBalance: "debit", description: "Customer credit / debtors", parentCode: null },
  { code: "10400", name: "Inventory", type: "asset", normalBalance: "debit", description: "Finished goods stock value", parentCode: null },
  { code: "10500", name: "Fixed Assets (Cost)", type: "asset", normalBalance: "debit", description: "Fixed assets at purchase cost", parentCode: null },
  { code: "10501", name: "Accumulated Depreciation", type: "asset", normalBalance: "credit", description: "Total depreciation charged to date", parentCode: "10500" },
  { code: "10600", name: "Prepaid Expenses", type: "asset", normalBalance: "debit", description: "Prepaid rents, insurance, etc.", parentCode: null },
  { code: "10700", name: "Advances & Deposits", type: "asset", normalBalance: "debit", description: "Advance payments and security deposits", parentCode: null },
  { code: "20100", name: "Accounts Payable", type: "liability", normalBalance: "credit", description: "Supplier credit / creditors", parentCode: null },
  { code: "20200", name: "Short-term Loans", type: "liability", normalBalance: "credit", description: "Loans due within 12 months", parentCode: null },
  { code: "20300", name: "Long-term Loans", type: "liability", normalBalance: "credit", description: "Loans due beyond 12 months", parentCode: null },
  { code: "20400", name: "Tax Payable", type: "liability", normalBalance: "credit", description: "TDS, VAT, and other tax liabilities", parentCode: null },
  { code: "20500", name: "Provident Fund Payable", type: "liability", normalBalance: "credit", description: "PF contributions not yet remitted", parentCode: null },
  { code: "20600", name: "Accrued Expenses", type: "liability", normalBalance: "credit", description: "Expenses incurred but not yet paid", parentCode: null },
  { code: "20700", name: "Owner's Capital", type: "liability", normalBalance: "credit", description: "Owner's equity / capital invested", parentCode: null },
  { code: "30100", name: "Retained Earnings", type: "equity", normalBalance: "credit", description: "Accumulated retained profits", parentCode: null },
  { code: "30200", name: "Current Year Profit/Loss", type: "equity", normalBalance: "credit", description: "Current fiscal year net result", parentCode: null },
  { code: "40100", name: "Sales Revenue", type: "income", normalBalance: "credit", description: "Revenue from product sales", parentCode: null },
  { code: "40200", name: "Discount Allowed", type: "income", normalBalance: "debit", description: "Discounts given to customers (contra-revenue)", parentCode: null },
  { code: "40300", name: "Sales Returns", type: "income", normalBalance: "debit", description: "Goods returned by customers (contra-revenue)", parentCode: null },
  { code: "40400", name: "Other Income", type: "income", normalBalance: "credit", description: "Miscellaneous income (interest, etc.)", parentCode: null },
  { code: "50100", name: "Cost of Goods Sold", type: "expense", normalBalance: "debit", description: "Cost of products sold", parentCode: null },
  { code: "50200", name: "Opening Stock", type: "expense", normalBalance: "debit", description: "Stock value at period start", parentCode: null },
  { code: "50300", name: "Purchases", type: "expense", normalBalance: "debit", description: "Raw material and product purchases", parentCode: null },
  { code: "50400", name: "Closing Stock", type: "expense", normalBalance: "credit", description: "Stock value at period end (negative COGS)", parentCode: null },
  { code: "50500", name: "Rent Expense", type: "expense", normalBalance: "debit", description: "Office/factory rent", parentCode: null },
  { code: "50600", name: "Utilities Expense", type: "expense", normalBalance: "debit", description: "Electricity, water, internet, phone", parentCode: null },
  { code: "50700", name: "Marketing Expense", type: "expense", normalBalance: "debit", description: "Advertising, promotions, coupon discounts", parentCode: null },
  { code: "50800", name: "Salary & Wages", type: "expense", normalBalance: "debit", description: "Employee salaries and wages", parentCode: null },
  { code: "50900", name: "Transport & Delivery", type: "expense", normalBalance: "debit", description: "Delivery charges and transport costs", parentCode: null },
  { code: "51000", name: "Packaging Expense", type: "expense", normalBalance: "debit", description: "Packaging materials and supplies", parentCode: null },
  { code: "51100", name: "Maintenance & Repairs", type: "expense", normalBalance: "debit", description: "Equipment and facility maintenance", parentCode: null },
  { code: "51200", name: "Depreciation Expense", type: "expense", normalBalance: "debit", description: "Periodic depreciation charge", parentCode: null },
  { code: "51300", name: "Miscellaneous Expense", type: "expense", normalBalance: "debit", description: "Other small expenses", parentCode: null },
  { code: "51400", name: "Bank Charges", type: "expense", normalBalance: "debit", description: "Bank fees and charges", parentCode: null },
  { code: "51500", name: "Tax Expense", type: "expense", normalBalance: "debit", description: "Income tax and other taxes", parentCode: null },
  { code: "51600", name: "Stock Adjustments", type: "expense", normalBalance: "debit", description: "Stock loss, damage, and write-offs", parentCode: null },
];

export async function seedAccounts(): Promise<number> {
  let count = 0;
  for (const acc of SEED_ACCOUNTS) {
    await setDocument(`accounts/${acc.code}`, {
      ...acc,
      isActive: true,
      createdAt: Timestamp.now(),
    });
    count++;
  }
  return count;
}

export function getDefaultAccounts() {
  return SEED_ACCOUNTS;
}
