import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import DataTable from "../components/DataTable";
import DebtorDetailModal from "../components/DebtorDetailModal";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { updateDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import type { Debtor, PaymentRecord } from "../types";

export default function DebtorsPage() {
  const { staff, can } = useStaff();
  const { data: debtors, loading } = useCollection<Debtor>("debtors");
  const [selected, setSelected] = useState<Debtor | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePayment = async (debtorId: string, amount: number, method: string) => {
    if (!staff) return;
    setSaving(true);
    try {
      const debtor = debtors.find((d) => d.id === debtorId);
      if (!debtor) return;
      const record: PaymentRecord = {
        method: method as any, amount, receivedBy: staff.id, receivedByName: staff.name,
        receivedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any, note: "Debtor payment",
      };
      const newOutstanding = Math.max(0, debtor.totalOutstanding - amount);
      let orders = debtor.orders.map((o) => ({ ...o }));
      let remaining = amount;
      for (const order of orders) {
        if (remaining <= 0) break;
        const dueOnOrder = order.amount - order.paidAmount;
        const payOnOrder = Math.min(remaining, dueOnOrder);
        order.paidAmount += payOnOrder;
        order.balance = order.amount - order.paidAmount;
        remaining -= payOnOrder;
      }
      await updateDocument(`debtors/${debtorId}`, {
        totalOutstanding: newOutstanding, orders, paymentHistory: [...(debtor.paymentHistory || []), record],
        clearedAt: newOutstanding <= 0 ? { seconds: Date.now() / 1000, nanoseconds: 0 } : null,
      } as any);
      logActivity({ action: "Debtor payment", details: `Received NPR ${amount} from '${debtor.customerName}'`, module: "Debtors", staffId: staff.id, staffName: staff.name, relatedDocId: debtorId });
      setSelected((prev) => prev ? { ...prev, totalOutstanding: newOutstanding, orders, paymentHistory: [...(prev.paymentHistory || []), record], clearedAt: newOutstanding <= 0 ? { seconds: Date.now() / 1000, nanoseconds: 0 } as any : null } : null);
    } finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6">
          <h1 className="font-heading text-xl font-bold text-text">Debtors</h1>
          <p className="text-sm text-text-light">Customer credit tracking — click a row to view details</p>
        </div>
        <DataTable
          columns={[
            { key: "name", header: "Name", render: (d: Debtor) => <span className="font-medium text-text">{d.customerName}</span>, sortable: true },
            { key: "phone", header: "Phone", render: (d: Debtor) => <span className="text-text-light">{d.customerPhone}</span> },
            { key: "due", header: "Due", render: (d: Debtor) => <span className="font-medium text-forest-green">NPR {d.totalOutstanding.toLocaleString()}</span> },
            { key: "status", header: "Status", render: (d: Debtor) => d.clearedAt ? <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Cleared</span> : <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">Active</span> },
            { key: "orders", header: "Orders", render: (d: Debtor) => <span className="text-text-light">{d.orders?.length || 0}</span> },
          ]}
          data={debtors}
          keyExtractor={(d) => d.id}
          loading={loading}
          emptyMessage="No debtors"
          emptyIcon="👤"
          onRowClick={(d) => setSelected(d)}
        />
        <DebtorDetailModal
          debtor={selected}
          onClose={() => setSelected(null)}
          onPayment={handlePayment}
          saving={saving}
          canWrite={can("debtors.write")}
        />
      </div>
    </AdminLayout>
  );
}
