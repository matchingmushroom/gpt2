import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import DataTable from "../components/DataTable";
import CreditorDetailModal from "../components/CreditorDetailModal";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { updateDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import type { Creditor, PaymentRecord } from "../types";

export default function CreditorsPage() {
  const { staff, can } = useStaff();
  const { data: creditors, loading } = useCollection<Creditor>("creditors");
  const [selected, setSelected] = useState<Creditor | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePayment = async (creditorId: string, amount: number, method: string) => {
    if (!staff) return;
    setSaving(true);
    try {
      const creditor = creditors.find((c) => c.id === creditorId);
      if (!creditor) return;
      const record: PaymentRecord = {
        method: method as any, amount, receivedBy: staff.id, receivedByName: staff.name,
        receivedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any, note: "Creditor payment",
      };
      const newOutstanding = Math.max(0, creditor.totalOutstanding - amount);
      let purchases = creditor.purchases.map((p) => ({ ...p }));
      let remaining = amount;
      for (const purchase of purchases) {
        if (remaining <= 0) break;
        const dueOnPurchase = purchase.amount - purchase.paidAmount;
        const payOnPurchase = Math.min(remaining, dueOnPurchase);
        purchase.paidAmount += payOnPurchase;
        purchase.balance = purchase.amount - purchase.paidAmount;
        remaining -= payOnPurchase;
      }
      await updateDocument(`creditors/${creditorId}`, {
        totalOutstanding: newOutstanding, purchases, paymentHistory: [...(creditor.paymentHistory || []), record],
        clearedAt: newOutstanding <= 0 ? { seconds: Date.now() / 1000, nanoseconds: 0 } : null,
      } as any);
      logActivity({ action: "Creditor payment", details: `Paid NPR ${amount} to '${creditor.supplierName}'`, module: "Creditors", staffId: staff.id, staffName: staff.name, relatedDocId: creditorId });
      setSelected((prev) => prev ? { ...prev, totalOutstanding: newOutstanding, purchases, paymentHistory: [...(prev.paymentHistory || []), record], clearedAt: newOutstanding <= 0 ? { seconds: Date.now() / 1000, nanoseconds: 0 } as any : null } : null);
    } finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6">
          <h1 className="font-heading text-xl font-bold text-text">Creditors</h1>
          <p className="text-sm text-text-light">Supplier credit tracking — click a row to view details</p>
        </div>
        <DataTable
          columns={[
            { key: "name", header: "Supplier", render: (c: Creditor) => <span className="font-medium text-text">{c.supplierName}</span>, sortable: true },
            { key: "phone", header: "Contact", render: (c: Creditor) => <span className="text-text-light">{c.supplierPhone}</span> },
            { key: "balance", header: "Balance", render: (c: Creditor) => <span className="font-medium text-warning">NPR {c.totalOutstanding.toLocaleString()}</span> },
            { key: "purchases", header: "Purchases", render: (c: Creditor) => <span className="text-text-light">{c.purchases?.length || 0}</span> },
            { key: "status", header: "Status", render: (c: Creditor) => c.clearedAt ? <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Cleared</span> : <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">Due</span> },
          ]}
          data={creditors}
          keyExtractor={(c) => c.id}
          loading={loading}
          emptyMessage="No creditors"
          emptyIcon="🤝"
          onRowClick={(c) => setSelected(c)}
        />
        <CreditorDetailModal
          creditor={selected}
          onClose={() => setSelected(null)}
          onPayment={handlePayment}
          saving={saving}
          canWrite={can("creditors.write")}
        />
      </div>
    </AdminLayout>
  );
}
