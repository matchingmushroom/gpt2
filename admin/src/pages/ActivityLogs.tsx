import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import DataTable from "../components/DataTable";
import { useCollection } from "../hooks/useCollection";
import { orderBy, limit, where } from "firebase/firestore";
import type { ActivityLog } from "../types";

const MODULES = ["All", "Products", "Categories", "Orders", "Batches", "Purchases", "Expenses", "Staff", "Coupons", "Debtors", "Creditors", "Settings", "Reports", "POS"];

export default function ActivityLogs() {
  const [moduleFilter, setModuleFilter] = useState("All");
  const constraints = [
    ...(moduleFilter !== "All" ? [where("module", "==", moduleFilter)] : []),
    orderBy("timestamp", "desc"),
    limit(100),
  ] as const;

  const { data: logs, loading } = useCollection<ActivityLog>(
    "activityLog",
    ...constraints
  );

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6">
          <h1 className="font-heading text-xl font-bold text-text">Activity Logs</h1>
          <p className="text-sm text-text-light">Audit trail of all actions</p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {MODULES.map((m) => (
            <button key={m} onClick={() => setModuleFilter(m)} className={`rounded-btn border px-3 py-1.5 text-xs font-medium transition-colors ${
              moduleFilter === m ? "border-forest-green bg-forest-green text-white" : "border-border bg-white text-text hover:border-forest-green"
            }`}>{m}</button>
          ))}
        </div>

        <div className="rounded-card bg-white shadow-card">
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <div className="h-3 w-20 animate-pulse rounded bg-light-gray" />
                  <div className="h-3 w-16 animate-pulse rounded bg-light-gray" />
                  <div className="h-3 flex-1 animate-pulse rounded bg-light-gray" />
                  <div className="h-3 w-16 animate-pulse rounded bg-light-gray" />
                </div>
              ))
            ) : logs.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-text-muted">No activity logs yet</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-light-gray">
                  <span className="shrink-0 text-xs text-text-muted">
                    {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : "—"}
                  </span>
                  <span className="shrink-0 rounded-full bg-forest-green/10 px-2 py-0.5 text-xs font-medium text-forest-green">
                    {log.module}
                  </span>
                  <span className="flex-1 text-text-light">{log.details}</span>
                  <span className="text-xs text-text-muted">{log.performedByName}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
