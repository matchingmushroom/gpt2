import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument, getCollection } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { seedAccounts } from "../utils/seedAccounts";
import type { Account, AccountType, NormalBalance } from "../types";

const ACCOUNT_TYPES: AccountType[] = ["asset", "liability", "equity", "income", "expense"];

export default function AccountsPage() {
  const { staff, can } = useStaff();
  const { data: accounts, loading } = useCollection<Account>("accounts");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<AccountType>("asset");
  const [formNormalBalance, setFormNormalBalance] = useState<NormalBalance>("debit");
  const [formDescription, setFormDescription] = useState("");

  useEffect(() => {
    if (!loading && accounts.length === 0 && !seeding && can("accounts.write")) {
      setSeeding(true);
      seedAccounts().then((count) => {
        logActivity({ action: "Seeded chart of accounts", details: `Auto-seeded ${count} standard accounts`, module: "Finance", staffId: staff?.id || "", staffName: staff?.name || "" });
      }).catch(console.error);
    }
  }, [loading, accounts.length]);

  const handleAdd = () => {
    setEditing(null);
    setFormCode(""); setFormName(""); setFormType("asset"); setFormNormalBalance("debit"); setFormDescription("");
    setError(null);
    setModalOpen(true);
  };

  const handleEdit = (acc: Account) => {
    setEditing(acc);
    setFormCode(acc.code); setFormName(acc.name); setFormType(acc.type);
    setFormNormalBalance(acc.normalBalance); setFormDescription(acc.description);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!staff || !can("accounts.write")) return;
    if (!formCode.trim() || !formName.trim()) { setError("Code and name required"); return; }
    setSaving(true); setError(null);
    try {
      const data = { code: formCode.trim(), name: formName.trim(), type: formType, normalBalance: formNormalBalance, description: formDescription.trim(), isActive: true, parentCode: null };
      if (editing) {
        await setDocument(`accounts/${editing.id}`, data);
        logActivity({ action: "Updated account", details: `Updated account '${formName}' (${formCode})`, module: "Finance", staffId: staff.id, staffName: staff.name });
      } else {
        await addDocument("accounts", data);
        logActivity({ action: "Created account", details: `Created account '${formName}' (${formCode})`, module: "Finance", staffId: staff.id, staffName: staff.name });
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleReSeed = async () => {
    if (!staff || !can("accounts.write")) return;
    setSeeding(true);
    try {
      const count = await seedAccounts();
      logActivity({ action: "Re-seeded chart of accounts", details: `Seeded ${count} accounts`, module: "Finance", staffId: staff.id, staffName: staff.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed");
    } finally { setSeeding(false); }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Chart of Accounts</h1>
            <p className="text-sm text-text-light">Manage your chart of accounts — {accounts.length} accounts</p>
          </div>
          <div className="flex gap-2">
            {can("accounts.write") && (
              <button onClick={handleReSeed} disabled={seeding} className="rounded-btn border border-border px-3 py-2 text-sm font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">
                {seeding ? "Seeding..." : "Re-seed Default"}
              </button>
            )}
            {can("accounts.write") && (
              <button onClick={handleAdd} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white">+ Add Account</button>
            )}
          </div>
        </div>
        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={[
            { key: "code", header: "Code", render: (a: Account) => <span className="font-mono text-xs font-medium text-text">{a.code}</span>, sortable: true },
            { key: "name", header: "Name", render: (a: Account) => <span className="font-medium text-text">{a.name}</span>, sortable: true },
            { key: "type", header: "Type", render: (a: Account) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                a.type === "asset" ? "bg-info/10 text-info" :
                a.type === "liability" ? "bg-warning/10 text-warning" :
                a.type === "equity" ? "bg-success/10 text-success" :
                a.type === "income" ? "bg-forest-green/10 text-forest-green" :
                "bg-error/10 text-error"
              }`}>{a.type}</span>
            ), sortable: true },
            { key: "normalBalance", header: "Normal", render: (a: Account) => <span className="text-xs text-text-light">{a.normalBalance}</span> },
            { key: "actions", header: "", render: (a: Account) => can("accounts.write") ? (
              <button onClick={(e) => { e.stopPropagation(); handleEdit(a); }} className="text-xs text-info">Edit</button>
            ) : null, width: "60px" },
          ]}
          data={accounts}
          onRowClick={setSelectedAccount}
          keyExtractor={(a) => a.id}
          loading={loading}
          emptyMessage="No accounts yet — they will be seeded automatically"
          emptyIcon="📒"
        />

        {selectedAccount && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setSelectedAccount(null)}>
            <div className="mx-4 w-full max-w-sm rounded-card bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-text">{selectedAccount.name}</h2>
                <button onClick={() => setSelectedAccount(null)} className="text-xl text-text-light">&times;</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-text-light">Code</span><span className="font-mono font-medium text-text">{selectedAccount.code}</span></div>
                <div className="flex justify-between">
                  <span className="text-text-light">Type</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    selectedAccount.type === "asset" ? "bg-info/10 text-info" :
                    selectedAccount.type === "liability" ? "bg-warning/10 text-warning" :
                    selectedAccount.type === "equity" ? "bg-success/10 text-success" :
                    selectedAccount.type === "income" ? "bg-forest-green/10 text-forest-green" :
                    "bg-error/10 text-error"
                  }`}>{selectedAccount.type}</span>
                </div>
                <div className="flex justify-between"><span className="text-text-light">Normal Balance</span><span className="font-medium text-text">{selectedAccount.normalBalance}</span></div>
                {selectedAccount.description && <div className="flex justify-between"><span className="text-text-light">Description</span><span className="text-text">{selectedAccount.description}</span></div>}
              </div>
            </div>
          </div>
        )}

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Account" : "Add Account"} onSave={handleSave} saving={saving} size="sm">
          <div className="space-y-4">
            <div><label className="mb-1 block text-sm font-medium text-text">Code *</label><input value={formCode} onChange={(e) => setFormCode(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" placeholder="e.g., 10100" /></div>
            <div><label className="mb-1 block text-sm font-medium text-text">Name *</label><input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value as AccountType)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
                  {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Normal Balance</label>
                <select value={formNormalBalance} onChange={(e) => setFormNormalBalance(e.target.value as NormalBalance)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
            </div>
            <div><label className="mb-1 block text-sm font-medium text-text">Description</label><textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" rows={2} /></div>
          </div>
        </FormModal>
      </div>
    </AdminLayout>
  );
}
