import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import AuthGuard from "./components/AuthGuard";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Invoices from "./pages/Invoices";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Batches from "./pages/Batches";
import Inventory from "./pages/Inventory";
import Purchases from "./pages/Purchases";
import Suppliers from "./pages/Suppliers";
import Expenses from "./pages/Expenses";
import Debtors from "./pages/Debtors";
import Creditors from "./pages/Creditors";
import POS from "./pages/POS";
import Coupons from "./pages/Coupons";
import Combos from "./pages/Combos";
import StockAdjustments from "./pages/StockAdjustments";
import Staff from "./pages/Staff";
import Reports from "./pages/Reports";
import ActivityLogs from "./pages/ActivityLogs";
import Settings from "./pages/Settings";
import Accounts from "./pages/Accounts";
import JournalEntries from "./pages/JournalEntries";
import Ledger from "./pages/Ledger";
import TrialBalance from "./pages/TrialBalance";
import FixedAssets from "./pages/FixedAssets";
import Employees from "./pages/Employees";
import Payroll from "./pages/Payroll";
import DailyRegister from "./pages/DailyRegister";

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-cream text-text font-body antialiased">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/batches" element={<Batches />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/purchases" element={<Purchases />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/debtors" element={<Debtors />} />
                  <Route path="/creditors" element={<Creditors />} />
                  <Route path="/pos" element={<POS />} />
                  <Route path="/coupons" element={<Coupons />} />
                  <Route path="/combos" element={<Combos />} />
                  <Route path="/adjustments" element={<StockAdjustments />} />
                  <Route path="/staff" element={<Staff />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/logs" element={<ActivityLogs />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/journal" element={<JournalEntries />} />
                  <Route path="/ledger" element={<Ledger />} />
                  <Route path="/trial-balance" element={<TrialBalance />} />
                  <Route path="/fixed-assets" element={<FixedAssets />} />
                  <Route path="/employees" element={<Employees />} />
                  <Route path="/payroll" element={<Payroll />} />
                  <Route path="/daily-register" element={<DailyRegister />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AuthGuard>
            }
          />
        </Routes>
      </div>
    </AuthProvider>
  );
}
