import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { logActivity } from "../utils/activityLog";
import { postJournalEntry } from "../utils/accountingEngine";
import type { JournalEntry, JournalLine, Account, ReferenceType } from "../types";

const REF_TYPES: ReferenceType[] = ["sale", "expense", "purchase", "asset", "depreciation", "payroll", "coupon", "manual", "daily_register"];

export default function JournalEntriesPage() {
  const { staff, can } = useStaff();
  const { data: entries, loading } = useCollection<JournalEntry>("journalEntries");
  const { data: accounts } = useCollection<Account>("accounts");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDescription, setFormDescription] = useState("");
  const [formLines, setFormLines] = useState<JournalLine[]>([{ accountCode: "", accountName: "", debit: 0, credit: 0 }]);
  const [formRefType, setFormRefType] = useState<ReferenceType>("manual");
  const [formRefId, setFormRefId] = useState("");

  const totalDebit = Math.round(formLines.reduce((s, l) => s + (l.debit || 0), 0) * 100) / 100;
  const totalCredit = Math.round(formLines.reduce((s, l) => s + (l.credit || 0), 0) * 100) / 100;
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleAddLine = () => setFormLines([...formLines, { accountCode: "", accountName: "", debit: 0, credit: 0 }]);

  const handleUpdateLine = (i: number, field: keyof JournalLine, value: string | number) => {
    const next = [...formLines];
    if (field === "accountCode") {
      const acc = accounts.find((a) => a.code === value);
      next[i] = { ...next[i], accountCode: value as string, accountName: acc?.name || "" };
    } else {
      next[i] = { ...next[i], [field]: Number(value) || 0 };
    }
    setFormLines(next);
  };

  const handleRemoveLine = (i: number) => {
    if (formLines.length <= 1) return;
    setFormLines(formLines.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (!staff || !can("journal.write")) return;
    if (!formDescription.trim() || formLines.length === 0) { setError("Description and at least one line required"); return; }
    if (!balanced) { setError(`Debits (${totalDebit}) must equal credits (${totalCredit})`); return; }
    setSaving(true); setError(null);
    try {
      await postJournalEntry({
        entryDate: new Date(formDate),
        description: formDescription.trim(),
        lines: formLines.filter((l) => l.accountCode && (l.debit || l.credit)),
        referenceType: formRefType,
        referenceId: formRefId || undefined,
        createdBy: staff.id,
      });
      logActivity({ action: "Created journal entry", details: `Manual journal entry: '${formDescription}'`, module: "Finance", staffId: staff.id, staffName: staff.name });
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormDescription("");
    setFormLines([{ accountCode: "", accountName: "", debit: 0, credit: 0 }]);
    setFormRefType("manual");
    setFormRefId("");
    setError(null);
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Journal Entries</h1>
            <p className="text-sm text-text-light">{entries.length} entries recorded</p>
          </div>
          {can("journal.write") && (
            <button onClick={() => { resetForm(); setModalOpen(true); }} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white">+ New Entry</button>
          )}
        </div>
        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={[
            { key: "entryNumber", header: "Entry #", render: (e: JournalEntry) => <span className="font-mono text-xs font-medium text-text">{e.entryNumber}</span>, sortable: true },
            { key: "date", header: "Date", render: (e: JournalEntry) => <span className="text-text-light">{new Date(e.entryDate.seconds * 1000).toLocaleDateString()}</span> },
            { key: "description", header: "Description", render: (e: JournalEntry) => <span className="text-text-light">{e.description}</span> },
            { key: "lines", header: "Lines", render: (e: JournalEntry) => <span className="text-text-light">{e.lines.length}</span> },
            { key: "total", header: "Total", render: (e: JournalEntry) => <span className="font-medium text-forest-green">NPR {e.totalDebit.toLocaleString()}</span> },
            { key: "type", header: "Type", render: (e: JournalEntry) => (
              <span className="rounded-full bg-beige px-2 py-0.5 text-xs font-medium capitalize text-text">{e.referenceType}</span>
            )},
          ]}
          data={entries}
          keyExtractor={(e) => e.id}
          onRowClick={setSelectedEntry}
          loading={loading}
          emptyMessage="No journal entries yet"
          emptyIcon="📝"
        />

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="New Journal Entry" onSave={handleSave} saving={saving} size="lg">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div><label className="mb-1 block text-sm font-medium text-text">Date</label><input value={formDate} onChange={(e) => setFormDate(e.target.value)} type="date" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div><label className="mb-1 block text-sm font-medium text-text">Reference Type</label>
                <select value={formRefType} onChange={(e) => setFormRefType(e.target.value as ReferenceType)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
                  {REF_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="mb-1 block text-sm font-medium text-text">Reference ID</label><input value={formRefId} onChange={(e) => setFormRefId(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" placeholder="Optional" /></div>
            </div>
            <div><label className="mb-1 block text-sm font-medium text-text">Description *</label><input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">Journal Lines</h3>
                <button type="button" onClick={handleAddLine} className="text-xs text-info">+ Add Line</button>
              </div>
              <div className={`rounded-lg border ${balanced ? "border-border" : "border-error"} p-2`}>
                {formLines.map((line, i) => (
                  <div key={i} className="mb-2 flex items-center gap-2">
                    <select value={line.accountCode} onChange={(e) => handleUpdateLine(i, "accountCode", e.target.value)} className="flex-1 rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green">
                      <option value="">Select account...</option>
                      {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                    </select>
                    <input value={line.debit || ""} onChange={(e) => handleUpdateLine(i, "debit", e.target.value)} type="number" className="w-20 rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green" placeholder="Dr" />
                    <input value={line.credit || ""} onChange={(e) => handleUpdateLine(i, "credit", e.target.value)} type="number" className="w-20 rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green" placeholder="Cr" />
                    {formLines.length > 1 && (
                      <button onClick={() => handleRemoveLine(i)} className="text-xs text-error">✕</button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
                  <span>Total</span>
                  <span className={balanced ? "text-forest-green" : "text-error"}>
                    Dr: NPR {totalDebit.toLocaleString()} / Cr: NPR {totalCredit.toLocaleString()}
                    {!balanced && " (Not balanced!)"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </FormModal>

        {selectedEntry && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setSelectedEntry(null)}>
            <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-text">{selectedEntry.entryNumber}</h2>
                <button onClick={() => setSelectedEntry(null)} className="text-2xl text-text-muted">✕</button>
              </div>
              <div className="mb-4 text-sm text-text-light">
                <p>Date: {new Date(selectedEntry.entryDate.seconds * 1000).toLocaleDateString()}</p>
                <p>Description: {selectedEntry.description}</p>
                <p>Type: {selectedEntry.referenceType}{selectedEntry.referenceId ? ` (${selectedEntry.referenceId})` : ""}</p>
              </div>
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-border"><th className="py-1 font-medium text-text-muted">Account</th><th className="py-1 text-right font-medium text-text-muted">Debit</th><th className="py-1 text-right font-medium text-text-muted">Credit</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {selectedEntry.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-1 text-text">{l.accountCode} — {l.accountName}</td>
                      <td className="py-1 text-right text-forest-green">{l.debit ? `NPR ${l.debit.toLocaleString()}` : ""}</td>
                      <td className="py-1 text-right text-error">{l.credit ? `NPR ${l.credit.toLocaleString()}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t border-border font-bold"><td className="py-1 text-text">Total</td><td className="py-1 text-right text-forest-green">NPR {selectedEntry.totalDebit.toLocaleString()}</td><td className="py-1 text-right text-error">NPR {selectedEntry.totalCredit.toLocaleString()}</td></tr></tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
