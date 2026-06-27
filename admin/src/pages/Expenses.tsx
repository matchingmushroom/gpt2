import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { invalidateCache } from "../utils/cacheInvalidate";
import type { Expense } from "../types";

const CATEGORIES = ["rent", "utilities", "marketing", "salary", "transport", "packaging", "maintenance", "miscellaneous"];

export default function ExpensesPage() {
  const { staff, can } = useStaff();
  const { data: expenses, loading } = useCollection<Expense>("expenses");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formCat, setFormCat] = useState("miscellaneous");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState(0);
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSave = async () => {
    if (!staff || !can("expenses.write")) return;
    if (!formDesc.trim() || formAmount <= 0) { setError("Description and amount required"); return; }
    setSaving(true); setError(null);
    try {
      const id = await addDocument("expenses", {
        category: formCat, description: formDesc.trim(), amount: formAmount,
        date: new Date(formDate), paidBy: staff.id, paidByName: staff.name, billImage: "", notes: "",
      });
      logActivity({ action: "Created expense", details: `Recorded expense '${formDesc}' — NPR ${formAmount} (${formCat})`, module: "Expenses", staffId: staff.id, staffName: staff.name, relatedDocId: id });
      invalidateCache(["pnl"]);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Expenses</h1>
            <p className="text-sm text-text-light">Track business expenses</p>
          </div>
          {can("expenses.write") && <button onClick={() => { setError(null); setFormDesc(""); setFormAmount(0); setFormCat("miscellaneous"); setModalOpen(true); }} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white">+ Add Expense</button>}
        </div>
        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={[
            { key: "category", header: "Category", render: (e: Expense) => <span className="rounded-full bg-beige px-2 py-0.5 text-xs font-medium capitalize text-text">{e.category}</span>, sortable: true },
            { key: "description", header: "Description", render: (e: Expense) => <span className="text-text-light">{e.description}</span> },
            { key: "amount", header: "Amount", render: (e: Expense) => <span className="font-medium text-chili-red">NPR {e.amount.toLocaleString()}</span>, sortable: true },
            { key: "date", header: "Date", render: (e: Expense) => <span className="text-text-light">{new Date(e.date?.seconds * 1000).toLocaleDateString()}</span> },
            { key: "by", header: "Recorded By", render: (e: Expense) => <span className="text-text-light">{e.paidByName}</span> },
          ]}
          data={expenses}
          keyExtractor={(e) => e.id}
          loading={loading}
          emptyMessage="No expenses recorded"
          emptyIcon="💰"
        />

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Expense" onSave={handleSave} saving={saving} size="sm">
          <div className="space-y-4">
            <div><label className="mb-1 block text-sm font-medium text-text">Category</label>
              <select value={formCat} onChange={(e) => setFormCat(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="mb-1 block text-sm font-medium text-text">Description *</label><input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Amount (NPR) *</label><input value={formAmount || ""} onChange={(e) => setFormAmount(Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Date</label><input value={formDate} onChange={(e) => setFormDate(e.target.value)} type="date" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            </div>
          </div>
        </FormModal>
      </div>
    </AdminLayout>
  );
}
