import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { runDepreciationForPeriod } from "../utils/depreciation";
import type { FixedAsset, AssetType, DepreciationMethod, Account } from "../types";

const ASSET_TYPES: AssetType[] = ["equipment", "vehicle", "furniture", "computer", "building", "other"];
const DEP_METHODS: { value: DepreciationMethod; label: string }[] = [
  { value: "straight_line", label: "Straight Line" },
  { value: "wdv", label: "Written Down Value (WDV)" },
];

export default function FixedAssetsPage() {
  const { staff, can } = useStaff();
  const { data: assets, loading } = useCollection<FixedAsset>("fixedAssets");
  const { data: accounts } = useCollection<Account>("accounts");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FixedAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depRunning, setDepRunning] = useState(false);
  const [depResult, setDepResult] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);

  const [formName, setFormName] = useState("");
  const [formAssetType, setFormAssetType] = useState<AssetType>("equipment");
  const [formPurchaseDate, setFormPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [formCost, setFormCost] = useState(0);
  const [formSalvage, setFormSalvage] = useState(0);
  const [formUsefulLife, setFormUsefulLife] = useState(5);
  const [formDepMethod, setFormDepMethod] = useState<DepreciationMethod>("straight_line");
  const [formWdvRate, setFormWdvRate] = useState(0.15);
  const [formAccountCode, setFormAccountCode] = useState("10500");
  const [formDepExpenseCode, setFormDepExpenseCode] = useState("51200");
  const [formAccDepCode, setFormAccDepCode] = useState("10501");
  const [formNotes, setFormNotes] = useState("");

  const handleAdd = () => {
    setEditing(null);
    resetForm();
    setError(null);
    setModalOpen(true);
  };

  const handleEdit = (a: FixedAsset) => {
    setEditing(a);
    setFormName(a.name);
    setFormAssetType(a.assetType);
    setFormPurchaseDate(new Date(a.purchaseDate.seconds * 1000).toISOString().split("T")[0]);
    setFormCost(a.cost);
    setFormSalvage(a.salvageValue);
    setFormUsefulLife(a.usefulLifeYears);
    setFormDepMethod(a.depreciationMethod);
    setFormWdvRate(a.wdvRate || 0.15);
    setFormAccountCode(a.accountCode);
    setFormDepExpenseCode(a.depExpenseAccountCode);
    setFormAccDepCode(a.accDepAccountCode);
    setFormNotes(a.notes);
    setError(null);
    setModalOpen(true);
  };

  const resetForm = () => {
    setFormName("");
    setFormAssetType("equipment");
    setFormPurchaseDate(new Date().toISOString().split("T")[0]);
    setFormCost(0);
    setFormSalvage(0);
    setFormUsefulLife(5);
    setFormDepMethod("straight_line");
    setFormWdvRate(0.15);
    setFormAccountCode("10500");
    setFormDepExpenseCode("51200");
    setFormAccDepCode("10501");
    setFormNotes("");
  };

  const handleSave = async () => {
    if (!staff || !can("fixedAssets.write")) return;
    if (!formName.trim() || formCost <= 0) { setError("Name and cost required"); return; }
    setSaving(true); setError(null);
    try {
      const data = {
        name: formName.trim(), assetType: formAssetType,
        purchaseDate: new Date(formPurchaseDate),
        cost: formCost, salvageValue: formSalvage, usefulLifeYears: formUsefulLife,
        depreciationMethod: formDepMethod, wdvRate: formDepMethod === "wdv" ? formWdvRate : null,
        accumulatedDepreciation: 0, currentBookValue: formCost,
        accountCode: formAccountCode,
        depExpenseAccountCode: formDepExpenseCode,
        accDepAccountCode: formAccDepCode,
        notes: formNotes, isActive: true,
      };
      if (editing) {
        await setDocument(`fixedAssets/${editing.id}`, data);
        logActivity({ action: "Updated fixed asset", details: `Updated asset '${formName}'`, module: "Finance", staffId: staff.id, staffName: staff.name });
      } else {
        const id = await addDocument("fixedAssets", data);
        logActivity({ action: "Created fixed asset", details: `Added asset '${formName}' (NPR ${formCost})`, module: "Finance", staffId: staff.id, staffName: staff.name, relatedDocId: id });
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleRunDepreciation = async () => {
    if (!staff || !can("fixedAssets.write")) return;
    const from = prompt("Period start date (YYYY-MM-DD):") || "";
    const to = prompt("Period end date (YYYY-MM-DD):") || "";
    if (!from || !to) return;
    setDepRunning(true); setDepResult(null);
    try {
      const result = await runDepreciationForPeriod(new Date(from), new Date(to), staff.id);
      setDepResult(`Depreciation run complete: ${result.length} assets processed`);
      logActivity({ action: "Ran depreciation", details: `Depreciation for ${from} to ${to}: ${result.length} assets`, module: "Finance", staffId: staff.id, staffName: staff.name });
    } catch (err) {
      setDepResult("Depreciation failed: " + (err instanceof Error ? err.message : "Unknown"));
    } finally { setDepRunning(false); }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Fixed Assets</h1>
            <p className="text-sm text-text-light">{assets.length} assets registered</p>
          </div>
          <div className="flex gap-2">
            {can("fixedAssets.write") && (
              <button onClick={handleRunDepreciation} disabled={depRunning} className="rounded-btn border border-border px-3 py-2 text-sm font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">
                {depRunning ? "Running..." : "Run Depreciation"}
              </button>
            )}
            {can("fixedAssets.write") && (
              <button onClick={handleAdd} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white">+ Add Asset</button>
            )}
          </div>
        </div>

        {depResult && (
          <div className="mb-4 rounded-btn bg-info/10 px-4 py-2 text-sm text-info">{depResult}</div>
        )}
        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={[
            { key: "name", header: "Asset", render: (a: FixedAsset) => <span className="font-medium text-text">{a.name}</span>, sortable: true },
            { key: "type", header: "Type", render: (a: FixedAsset) => <span className="rounded-full bg-beige px-2 py-0.5 text-xs capitalize text-text">{a.assetType}</span> },
            { key: "cost", header: "Cost", render: (a: FixedAsset) => <span className="text-text-light">NPR {a.cost.toLocaleString()}</span> },
            { key: "bookValue", header: "Book Value", render: (a: FixedAsset) => <span className="font-medium text-forest-green">NPR {a.currentBookValue.toLocaleString()}</span> },
            { key: "dep", header: "Acc. Dep.", render: (a: FixedAsset) => <span className="text-text-light">NPR {a.accumulatedDepreciation.toLocaleString()}</span> },
            { key: "method", header: "Method", render: (a: FixedAsset) => <span className="text-xs text-text-light">{a.depreciationMethod === "straight_line" ? "SL" : "WDV"}</span> },
            { key: "actions", header: "", render: (a: FixedAsset) => can("fixedAssets.write") ? (
              <button onClick={(e) => { e.stopPropagation(); handleEdit(a); }} className="text-xs text-info">Edit</button>
            ) : null, width: "60px" },
          ]}
          data={assets}
          keyExtractor={(a) => a.id}
          onRowClick={setSelectedAsset}
          loading={loading}
          emptyMessage="No fixed assets registered"
          emptyIcon="🏗️"
        />

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Asset" : "Add Asset"} onSave={handleSave} saving={saving} size="lg">
          <div className="space-y-4">
            <div><label className="mb-1 block text-sm font-medium text-text">Asset Name *</label><input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Type</label>
                <select value={formAssetType} onChange={(e) => setFormAssetType(e.target.value as AssetType)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
                  {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Purchase Date</label><input value={formPurchaseDate} onChange={(e) => setFormPurchaseDate(e.target.value)} type="date" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Cost (NPR) *</label><input value={formCost || ""} onChange={(e) => setFormCost(Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Salvage Value</label><input value={formSalvage || ""} onChange={(e) => setFormSalvage(Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Useful Life (years)</label><input value={formUsefulLife} onChange={(e) => setFormUsefulLife(Number(e.target.value) || 1)} type="number" min="1" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Method</label>
                <select value={formDepMethod} onChange={(e) => setFormDepMethod(e.target.value as DepreciationMethod)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
                  {DEP_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              {formDepMethod === "wdv" && (
                <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">WDV Rate</label><input value={formWdvRate} onChange={(e) => setFormWdvRate(Number(e.target.value) || 0)} type="number" step="0.01" min="0" max="1" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              )}
            </div>
            <div className="border-t border-border pt-3">
              <h3 className="mb-2 text-sm font-semibold text-text">COA Mapping</h3>
              <div className="flex gap-4">
                <div className="flex-1"><label className="mb-1 block text-xs font-medium text-text-light">Asset Account</label>
                  <select value={formAccountCode} onChange={(e) => setFormAccountCode(e.target.value)} className="w-full rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green">
                    {accounts.filter((a) => a.code.startsWith("105")).map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
                <div className="flex-1"><label className="mb-1 block text-xs font-medium text-text-light">Dep. Expense</label>
                  <select value={formDepExpenseCode} onChange={(e) => setFormDepExpenseCode(e.target.value)} className="w-full rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green">
                    {accounts.filter((a) => a.code === "51200").map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
                <div className="flex-1"><label className="mb-1 block text-xs font-medium text-text-light">Acc. Depreciation</label>
                  <select value={formAccDepCode} onChange={(e) => setFormAccDepCode(e.target.value)} className="w-full rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green">
                    {accounts.filter((a) => a.code === "10501").map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div><label className="mb-1 block text-sm font-medium text-text">Notes</label><textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" rows={2} /></div>
          </div>
        </FormModal>

        {selectedAsset && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setSelectedAsset(null)}>
            <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-text">{selectedAsset.name}</h2>
                <button onClick={() => setSelectedAsset(null)} className="text-2xl text-text-muted">✕</button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-light">Type</span><span className="font-medium capitalize text-text">{selectedAsset.assetType}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Purchase Date</span><span className="text-text">{new Date(selectedAsset.purchaseDate.seconds * 1000).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Cost</span><span className="font-medium text-text">NPR {selectedAsset.cost.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Salvage Value</span><span className="text-text">NPR {selectedAsset.salvageValue.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Useful Life</span><span className="text-text">{selectedAsset.usefulLifeYears} years</span></div>
                <div className="flex justify-between"><span className="text-text-light">Method</span><span className="text-text">{selectedAsset.depreciationMethod === "straight_line" ? "Straight Line" : `WDV (${((selectedAsset.wdvRate || 0) * 100).toFixed(0)}%)`}</span></div>
                <div className="border-t border-border pt-2"><div className="flex justify-between text-base font-bold"><span className="text-text">Accumulated Depreciation</span><span className="text-error">NPR {selectedAsset.accumulatedDepreciation.toLocaleString()}</span></div></div>
                <div className="flex justify-between text-base font-bold"><span className="text-text">Current Book Value</span><span className="text-forest-green">NPR {selectedAsset.currentBookValue.toLocaleString()}</span></div>
                {selectedAsset.notes && <div className="border-t border-border pt-2"><p className="text-xs text-text-light">{selectedAsset.notes}</p></div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
