import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { listenDocument } from "../lib/firestore";
import type { Staff } from "../types";

const PERMISSION_MAP: Record<string, string> = {
  "products.read": "products.read",
  "products.write": "products.write",
  "categories.read": "categories.read",
  "categories.write": "categories.write",
  "orders.read": "orders.read",
  "orders.write": "orders.write",
  "orders.delete": "orders.delete",
  "batches.read": "batches.read",
  "batches.write": "batches.write",
  "purchases.read": "purchases.read",
  "purchases.write": "purchases.write",
  "expenses.read": "expenses.read",
  "expenses.write": "expenses.write",
  "staff.read": "staff.read",
  "staff.write": "staff.write",
  "coupons.read": "coupons.read",
  "coupons.write": "coupons.write",
  "debtors.read": "debtors.read",
  "debtors.write": "debtors.write",
  "creditors.read": "creditors.read",
  "creditors.write": "creditors.write",
  "reports.read": "reports.read",
  "reports.write": "reports.write",
  "settings.read": "settings.read",
  "settings.write": "settings.write",
  "logs.read": "logs.read",
  "accounts.read": "accounts.read",
  "accounts.write": "accounts.write",
  "journal.read": "journal.read",
  "journal.write": "journal.write",
  "ledger.read": "ledger.read",
  "fixedAssets.read": "fixedAssets.read",
  "fixedAssets.write": "fixedAssets.write",
  "employees.read": "employees.read",
  "employees.write": "employees.write",
  "payroll.read": "payroll.read",
  "payroll.write": "payroll.write",
  "dailyRegister.read": "dailyRegister.read",
  "dailyRegister.write": "dailyRegister.write",
};

export function useStaff() {
  const [uid, setUid] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      if (!user) {
        setStaff(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;

    setLoading(true);
    const unsub = listenDocument<Staff>(`staff/${uid}`, (doc) => {
      setStaff(doc);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const can = (permission: string): boolean => {
    if (!staff || !staff.isActive) return false;
    if (staff.role === "super_admin") return true;

    const [module, action] = permission.split(".");
    const perms = staff.permissions as unknown as Record<string, Record<string, boolean>>;
    return perms[module]?.[action] === true;
  };

  return { staff, uid, loading, error, can, staffId: staff?.id ?? null };
}
