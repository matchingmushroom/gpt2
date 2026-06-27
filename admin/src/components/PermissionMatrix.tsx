import type { StaffPermissions, StaffRole } from "../types";

interface PermissionMatrixProps {
  permissions: StaffPermissions;
  onChange: (perms: StaffPermissions) => void;
  readonly?: boolean;
}

const MODULES: { key: keyof StaffPermissions; label: string; actions: string[] }[] = [
  { key: "products", label: "Products", actions: ["read", "write"] },
  { key: "categories", label: "Categories", actions: ["read", "write"] },
  { key: "orders", label: "Orders", actions: ["read", "write", "delete"] },
  { key: "batches", label: "Batches", actions: ["read", "write"] },
  { key: "purchases", label: "Purchases", actions: ["read", "write"] },
  { key: "suppliers", label: "Suppliers", actions: ["read", "write"] },
  { key: "expenses", label: "Expenses", actions: ["read", "write"] },
  { key: "staff", label: "Staff", actions: ["read", "write"] },
  { key: "coupons", label: "Coupons", actions: ["read", "write"] },
  { key: "debtors", label: "Debtors", actions: ["read", "write"] },
  { key: "creditors", label: "Creditors", actions: ["read", "write"] },
  { key: "reports", label: "Reports", actions: ["read", "write"] },
  { key: "settings", label: "Settings", actions: ["read", "write"] },
  { key: "logs", label: "Activity Logs", actions: ["read"] },
  { key: "accounts", label: "Chart of Accounts", actions: ["read", "write"] },
  { key: "journal", label: "Journal Entries", actions: ["read", "write"] },
  { key: "ledger", label: "General Ledger", actions: ["read"] },
  { key: "fixedAssets", label: "Fixed Assets", actions: ["read", "write"] },
  { key: "employees", label: "Employees", actions: ["read", "write"] },
  { key: "payroll", label: "Payroll", actions: ["read", "write"] },
  { key: "dailyRegister", label: "Daily Register", actions: ["read", "write"] },
];

function toggle(perms: StaffPermissions, module: keyof StaffPermissions, action: string): StaffPermissions {
  const mod = perms[module] as Record<string, boolean>;
  return { ...perms, [module]: { ...mod, [action]: !mod[action] } };
}

export default function PermissionMatrix({ permissions, onChange, readonly }: PermissionMatrixProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 font-medium text-text-muted">Module</th>
            {["read", "write", "delete"].map((a) => <th key={a} className="px-3 py-2 text-center font-medium capitalize text-text-muted">{a}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {MODULES.map((mod) => (
            <tr key={mod.key}>
              <td className="px-3 py-2 font-medium text-text">{mod.label}</td>
              {["read", "write", "delete"].map((action) => {
                const modPerms = permissions[mod.key] as Record<string, boolean>;
                const checked = modPerms[action] === true;
                const disabled = readonly || !mod.actions.includes(action);
                return (
                  <td key={action} className="px-3 py-2 text-center">
                    {mod.actions.includes(action) ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onChange(toggle(permissions, mod.key, action))}
                        className="h-4 w-4 accent-forest-green"
                      />
                    ) : (
                      <span className="text-border">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
