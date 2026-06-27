import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getDocument } from "../lib/firestore";
import { toDirectDriveUrl } from "../utils/driveUrl";
import GlassIcon from "./GlassIcon";
import type { StoreSettings } from "../types";

interface NavGroup {
  label: string;
  items: { to: string; label: string; icon: string }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: "dashboard" }],
  },
  {
    label: "Sales",
    items: [
      { to: "/orders", label: "Orders", icon: "orders" },
      { to: "/invoices", label: "Invoices", icon: "invoices" },
      { to: "/pos", label: "Quick Sale", icon: "pos" },
      { to: "/coupons", label: "Coupons", icon: "coupons" },
      { to: "/combos", label: "Combos", icon: "batches" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { to: "/products", label: "Products", icon: "products" },
      { to: "/categories", label: "Categories", icon: "categories" },
      { to: "/batches", label: "Batches", icon: "batches" },
      { to: "/inventory", label: "Inventory", icon: "inventory" },
      { to: "/adjustments", label: "Adjustments", icon: "expenses" },
      { to: "/purchases", label: "Purchases", icon: "purchases" },
      { to: "/suppliers", label: "Suppliers", icon: "suppliers" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/accounts", label: "Chart of Accounts", icon: "accounts" },
      { to: "/journal", label: "Journal Entries", icon: "journal" },
      { to: "/ledger", label: "General Ledger", icon: "ledger" },
      { to: "/trial-balance", label: "Trial Balance", icon: "reports" },
      { to: "/fixed-assets", label: "Fixed Assets", icon: "batches" },
      { to: "/employees", label: "Employees", icon: "staff" },
      { to: "/payroll", label: "Payroll", icon: "expenses" },
      { to: "/daily-register", label: "Daily Register", icon: "reports" },
      { to: "/expenses", label: "Expenses", icon: "expenses" },
      { to: "/debtors", label: "Debtors", icon: "debtors" },
      { to: "/creditors", label: "Creditors", icon: "creditors" },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/staff", label: "Staff", icon: "staff" },
      { to: "/reports", label: "Reports", icon: "reports" },
      { to: "/logs", label: "Activity Logs", icon: "logs" },
      { to: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [store, setStore] = useState<StoreSettings | null>(null);

  useEffect(() => {
    getDocument<StoreSettings>("settings/store").then((d) => {
      console.log("AdminLayout got doc:", d);
      setStore(d);
    }).catch((e) => {
      console.error("AdminLayout getDocument failed:", e);
    });
  }, []);

  const [logoError, setLogoError] = useState(false);
  const storeName = store?.storeName || "GPT Admin";
  const display = store?.logoDisplay || "both";
  const rawLogo = store?.logoUrl || "";
  const logoUrl = rawLogo ? toDirectDriveUrl(
    rawLogo.startsWith("http") ? rawLogo : `${window.location.origin}${import.meta.env.BASE_URL}images/${rawLogo.replace(/^\/?(images\/)?/, "")}`
  ) : null;

  useEffect(() => { setLogoError(false); }, [logoUrl]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile hamburger */}
      <div className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between border-b border-[#D8A326] bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <button onClick={() => setSidebarOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-text-light transition-colors hover:bg-light-gray">
            ☰
          </button>
          {(logoUrl && !logoError && display !== "name") ? (
            <span className="inline-flex shrink-0 items-center">
              <img src={logoUrl} alt="" style={{ maxWidth: "none", height: 50, width: "auto", display: "inline" }} onError={() => { console.warn("Logo failed to load:", logoUrl); setLogoError(true); }} />
            </span>
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-forest-green text-xs text-white">🥒</span>
          )}
          {display !== "logo" && <span className="font-heading text-sm font-bold text-text">{storeName}</span>}
        </div>
        <span className="truncate text-xs text-text-muted">{user?.email}</span>
      </div>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-56 shrink-0 flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 border-b border-[#D8A326] bg-white px-4 py-4">
          {(logoUrl && !logoError && display !== "name") ? (
            <span className="inline-flex shrink-0 items-center">
              <img src={logoUrl} alt="" style={{ maxWidth: "none", height: 50, width: "auto", display: "inline" }} onError={() => { console.warn("Logo failed to load:", logoUrl); setLogoError(true); }} />
            </span>
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1F5E3B] text-base text-white">🥒</span>
          )}
          {display !== "logo" && <span className="font-heading text-sm font-bold text-[#1F5E3B]">{storeName}</span>}
          <button onClick={() => setSidebarOpen(false)} className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-sm text-gray-400 hover:text-gray-600 lg:hidden">
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto bg-forest-green px-2 py-4 text-white scrollbar-thin">
          {navGroups.map((group) => (
            <NavGroupSection key={group.label} group={group} onNavigate={() => setSidebarOpen(false)} />
          ))}
        </nav>

        <div className="border-t border-white/10 bg-forest-green p-4 text-white">
          <div className="mb-2 hidden truncate text-xs text-white/40 lg:block">{user?.email}</div>
          <button onClick={handleSignOut} className="w-full rounded-btn bg-white/10 px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white">
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-light-gray pt-14 lg:pt-0">{children}</main>
    </div>
  );
}

function NavGroupSection({ group, onNavigate }: { group: NavGroup; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/40 transition-colors hover:text-white/70"
      >
        <span className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}>▶</span>
        {group.label}
      </button>
      {open && (
        <div className="ml-1 mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]"
                    : "text-white/50 hover:bg-white/5 hover:text-white/80"
                }`
              }
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/70 backdrop-blur-sm ring-1 ring-white/10">
                <GlassIcon name={item.icon} size={14} />
              </span>
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
