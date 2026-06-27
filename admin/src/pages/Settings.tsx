import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import { useStaff } from "../hooks/useStaff";
import { getDocument, setDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { toDirectDriveUrl } from "../utils/driveUrl";
import ImageUploader from "../components/ImageUploader";
import { Timestamp } from "firebase/firestore";
import type { StoreSettings, PaymentSettings, DeliverySettings, NotificationSettings, CreditSettings, BudgetSettings, BackupSettings, LoyaltySettings, FinanceSheetSettings } from "../types";
import { pushFinanceToSheets, fetchSheetUrl } from "../utils/sheets";

const tabs = ["Store", "Payments", "Delivery", "Notifications", "Credit", "Budgets", "Backup", "Loyalty", "Finance Sheet"];

type SettingsKey = "store" | "payments" | "delivery" | "notifications" | "credit" | "budgets" | "backup" | "loyalty" | "financeSheet";
type SettingsMap = {
  store: StoreSettings;
  payments: PaymentSettings;
  delivery: DeliverySettings;
  notifications: NotificationSettings;
  credit: CreditSettings;
  budgets: BudgetSettings;
  backup: BackupSettings;
  loyalty: LoyaltySettings;
  financeSheet: FinanceSheetSettings;
};

const defaultSettings = {
  store: {
    storeName: "", tagline: "", logoUrl: null, footerLogoUrl: null, logoDisplay: "both", primaryColor: "#1F5E3B", secondaryColor: "#D8A326",
    phone: "", email: "", address: "", socialLinks: { facebook: null, instagram: null, youtube: null },
    panNumber: null, invoiceTerms: "", invoiceFooter: "", domain: "", whatsappNumber: "",
  } as StoreSettings,
  payments: { esewa: { enabled: false, merchantId: "" }, khalti: { enabled: false, publicKey: "", secretKey: "" }, cod: { enabled: true, maxOrderAmount: 5000 } } as PaymentSettings,
  delivery: { deliveryChargeInside: 50, deliveryChargeOutside: 150, freeDeliveryThreshold: 500, serviceArea: [], maxDeliveryDays: 3 } as unknown as DeliverySettings,
  notifications: { whatsappBusinessNumber: "", emailNotifications: [], notifyOnNewOrder: true, notifyOnLowStock: true, lowStockThreshold: 10 } as unknown as NotificationSettings,
  credit: { creditEnabled: false, maxCreditPerCustomer: 5000, overdueWarningDays: 7, overdueDangerDays: 14 } as CreditSettings,
  budgets: { categories: {} } as BudgetSettings,
  backup: { gasUrl: "", driveFolderId: "", billsFolderId: "", lastBackupAt: null, autoBackupEnabled: false, updatedAt: null as unknown as Timestamp } as BackupSettings,
  loyalty: { enabled: true, pointsPerRupee: 100, redemptionRate: 1, minRedemption: 100, maxRedemptionPercent: 50, earnOnDeliveryOnly: false, updatedAt: null as unknown as Timestamp } as LoyaltySettings,
  financeSheet: { sheetId: null, sheetUrl: null, lastPushAt: null, updatedAt: null as unknown as Timestamp } as FinanceSheetSettings,
};

export default function Settings() {
  const { staff, can } = useStaff();
  const [tab, setTab] = useState<SettingsKey>("store");
  const [forms, setForms] = useState<SettingsMap>({ ...defaultSettings });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [backupTesting, setBackupTesting] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [pushingSheet, setPushingSheet] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      const keys: SettingsKey[] = ["store", "payments", "delivery", "notifications", "credit", "budgets", "backup", "loyalty", "financeSheet"];
      const results = await Promise.all(
        keys.map(async (k) => {
          const doc = await getDocument<SettingsMap[typeof k]>(`settings/${k}`);
          return [k, doc ?? defaultSettings[k]];
        })
      );
      setForms(Object.fromEntries(results) as SettingsMap);
      setLoading(false);
    };
    loadAll();
  }, []);

  const updateForm = <K extends SettingsKey>(key: K, value: Partial<SettingsMap[K]>) => {
    setForms((prev) => ({ ...prev, [key]: { ...prev[key], ...value } }));
  };

  const handleSave = async () => {
    if (!can("settings.write")) return;
    if (tab === "store") {
      const wa = (forms.store as StoreSettings).whatsappNumber?.replace(/\D/g, "") || "";
      if (wa.length > 0 && wa.length !== 10) { setError("WhatsApp Number must be exactly 10 digits"); setSaving(false); return; }
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await setDocument(`settings/${tab}`, forms[tab] as unknown as Record<string, unknown>);
      setSuccess("Settings saved");
      if (staff) logActivity({ action: "Updated settings", details: `Updated ${tab} settings`, module: "Settings", staffId: staff.id, staffName: staff.name });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
<div className="p-3 sm:p-6">
          <div className="mb-6 h-6 w-40 animate-pulse rounded bg-light-gray" />
          <div className="h-64 animate-pulse rounded-card bg-white shadow-card" />
        </div>
      </AdminLayout>
    );
  }

  const s = forms[tab];

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Settings</h1>
            <p className="text-sm text-text-light">Configure your store</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => { const key = (t === "Finance Sheet" ? "financeSheet" : t.toLowerCase()) as SettingsKey; setTab(key); setError(null); setSuccess(null); }}
              className={`rounded-btn border px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === (t === "Finance Sheet" ? "financeSheet" : t.toLowerCase()) ? "border-forest-green bg-forest-green text-white" : "border-border bg-white text-text hover:border-forest-green"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}
        {success && <div className="mb-4 rounded-btn bg-success/10 px-4 py-2 text-sm text-success">{success}</div>}

        <div className="rounded-card bg-white p-6 shadow-card">
          {tab === "store" && (
            <div className="space-y-4">
              <Field label="Store Name" value={(s as StoreSettings).storeName} onChange={(v) => updateForm("store", { storeName: v })} />
              <Field label="Tagline" value={(s as StoreSettings).tagline} onChange={(v) => updateForm("store", { tagline: v })} />
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Logo</label>
                <div className="mb-2">
                  <ImageUploader
                    images={(s as StoreSettings).logoUrl ? [(s as StoreSettings).logoUrl!] : []}
                    onChange={(images) => updateForm("store", { logoUrl: images[0] || null })}
                    max={1}
                    gasUrl={(forms.backup as BackupSettings).gasUrl}
                    driveFolderId={(forms.backup as BackupSettings).driveFolderId}
                  />
                </div>
                <input
                  value={(s as StoreSettings).logoUrl || ""}
                  onChange={(e) => updateForm("store", { logoUrl: e.target.value || null })}
                  className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none transition-colors focus:border-forest-green"
                  placeholder="Or paste image URL directly, e.g. /images/logo.png"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Footer Logo</label>
                <div className="mb-2">
                  <ImageUploader
                    images={(s as StoreSettings).footerLogoUrl ? [(s as StoreSettings).footerLogoUrl!] : []}
                    onChange={(images) => updateForm("store", { footerLogoUrl: images[0] || null })}
                    max={1}
                    gasUrl={(forms.backup as BackupSettings).gasUrl}
                    driveFolderId={(forms.backup as BackupSettings).driveFolderId}
                  />
                </div>
                <input
                  value={(s as StoreSettings).footerLogoUrl || ""}
                  onChange={(e) => updateForm("store", { footerLogoUrl: e.target.value || null })}
                  className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none transition-colors focus:border-forest-green"
                  placeholder="Or paste image URL directly"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Logo Display</label>
                <select
                  value={(s as StoreSettings).logoDisplay}
                  onChange={(e) => updateForm("store", { logoDisplay: e.target.value as "logo" | "name" | "both" })}
                  className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none transition-colors focus:border-forest-green"
                >
                  <option value="both">Show both logo and name</option>
                  <option value="logo">Show logo only</option>
                  <option value="name">Show name only</option>
                </select>
                <p className="mt-1 text-xs text-text-light">Supports square and horizontal logos. Max height constrained, width auto-scales.</p>
              </div>
              <div className="flex gap-4">
                <Field label="Primary Color" value={(s as StoreSettings).primaryColor} onChange={(v) => updateForm("store", { primaryColor: v })} />
                <Field label="Secondary Color" value={(s as StoreSettings).secondaryColor} onChange={(v) => updateForm("store", { secondaryColor: v })} />
              </div>
              <Field label="Email" value={(s as StoreSettings).email} onChange={(v) => updateForm("store", { email: v })} />
              <Field label="Address" value={(s as StoreSettings).address} onChange={(v) => updateForm("store", { address: v })} />
              <Field label="Domain" value={(s as StoreSettings).domain} onChange={(v) => updateForm("store", { domain: v })} />
              <Field label="Phone (landline or mobile)" value={(s as StoreSettings).phone} onChange={(v) => updateForm("store", { phone: v })} />
              <PhoneField label="WhatsApp Number" value={(s as StoreSettings).whatsappNumber} onChange={(v) => updateForm("store", { whatsappNumber: v })} />
              <Field label="PAN Number" value={(s as StoreSettings).panNumber || ""} onChange={(v) => updateForm("store", { panNumber: v || null })} />
              <Field label="Invoice Terms" value={(s as StoreSettings).invoiceTerms} onChange={(v) => updateForm("store", { invoiceTerms: v })} textarea />
              <Field label="Invoice Footer" value={(s as StoreSettings).invoiceFooter} onChange={(v) => updateForm("store", { invoiceFooter: v })} />
            </div>
          )}

          {tab === "payments" && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border p-4">
                <h3 className="mb-3 font-heading font-semibold text-text">eSewa</h3>
                <Toggle label="Enabled" checked={(s as PaymentSettings).esewa.enabled} onChange={(v) => updateForm("payments", { esewa: { ...(s as PaymentSettings).esewa, enabled: v } })} />
                <Field label="Merchant ID" value={(s as PaymentSettings).esewa.merchantId} onChange={(v) => updateForm("payments", { esewa: { ...(s as PaymentSettings).esewa, merchantId: v } })} />
              </div>
              <div className="rounded-lg border border-border p-4">
                <h3 className="mb-3 font-heading font-semibold text-text">Khalti</h3>
                <Toggle label="Enabled" checked={(s as PaymentSettings).khalti.enabled} onChange={(v) => updateForm("payments", { khalti: { ...(s as PaymentSettings).khalti, enabled: v } })} />
                <Field label="Public Key" value={(s as PaymentSettings).khalti.publicKey} onChange={(v) => updateForm("payments", { khalti: { ...(s as PaymentSettings).khalti, publicKey: v } })} />
                <Field label="Secret Key" value={(s as PaymentSettings).khalti.secretKey} onChange={(v) => updateForm("payments", { khalti: { ...(s as PaymentSettings).khalti, secretKey: v } })} type="password" />
              </div>
              <div className="rounded-lg border border-border p-4">
                <h3 className="mb-3 font-heading font-semibold text-text">Cash on Delivery</h3>
                <Toggle label="Enabled" checked={(s as PaymentSettings).cod.enabled} onChange={(v) => updateForm("payments", { cod: { ...(s as PaymentSettings).cod, enabled: v } })} />
                <Field label="Max Order Amount (NPR)" value={String((s as PaymentSettings).cod.maxOrderAmount)} onChange={(v) => updateForm("payments", { cod: { ...(s as PaymentSettings).cod, maxOrderAmount: Number(v) || 0 } })} type="number" />
              </div>
            </div>
          )}

          {tab === "delivery" && (
            <div className="space-y-4">
              <Field label="Delivery Charge — Inside Valley (NPR)" value={String((s as DeliverySettings).deliveryChargeInside)} onChange={(v) => updateForm("delivery", { deliveryChargeInside: Number(v) || 0 })} type="number" />
              <Field label="Delivery Charge — Outside Valley (NPR)" value={String((s as DeliverySettings).deliveryChargeOutside)} onChange={(v) => updateForm("delivery", { deliveryChargeOutside: Number(v) || 0 })} type="number" />
              <Field label="Free Delivery Threshold (NPR)" value={String((s as DeliverySettings).freeDeliveryThreshold)} onChange={(v) => updateForm("delivery", { freeDeliveryThreshold: Number(v) || 0 })} type="number" />
              <Field label="Service Area (comma-separated)" value={(s as DeliverySettings).serviceArea.join(", ")} onChange={(v) => updateForm("delivery", { serviceArea: v.split(",").map((x) => x.trim()).filter(Boolean) })} />
              <Field label="Max Delivery Days" value={String((s as DeliverySettings).maxDeliveryDays)} onChange={(v) => updateForm("delivery", { maxDeliveryDays: Number(v) || 1 })} type="number" />
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-4">
              <Field label="WhatsApp Business Number" value={(s as NotificationSettings).whatsappBusinessNumber} onChange={(v) => updateForm("notifications", { whatsappBusinessNumber: v })} />
              <Field label="Notification Emails (comma-separated)" value={(s as NotificationSettings).emailNotifications.join(", ")} onChange={(v) => updateForm("notifications", { emailNotifications: v.split(",").map((x) => x.trim()).filter(Boolean) })} />
              <Toggle label="Notify on New Order" checked={(s as NotificationSettings).notifyOnNewOrder} onChange={(v) => updateForm("notifications", { notifyOnNewOrder: v })} />
              <Toggle label="Notify on Low Stock" checked={(s as NotificationSettings).notifyOnLowStock} onChange={(v) => updateForm("notifications", { notifyOnLowStock: v })} />
              <Field label="Low Stock Threshold" value={String((s as NotificationSettings).lowStockThreshold)} onChange={(v) => updateForm("notifications", { lowStockThreshold: Number(v) || 1 })} type="number" />
            </div>
          )}

          {tab === "credit" && (
            <div className="space-y-4">
              <Toggle label="Enable Credit Sales" checked={(s as CreditSettings).creditEnabled} onChange={(v) => updateForm("credit", { creditEnabled: v })} />
              <Field label="Max Credit per Customer (NPR)" value={String((s as CreditSettings).maxCreditPerCustomer)} onChange={(v) => updateForm("credit", { maxCreditPerCustomer: Number(v) || 0 })} type="number" />
              <Field label="Overdue Warning Days" value={String((s as CreditSettings).overdueWarningDays)} onChange={(v) => updateForm("credit", { overdueWarningDays: Number(v) || 1 })} type="number" />
              <Field label="Overdue Danger Days" value={String((s as CreditSettings).overdueDangerDays)} onChange={(v) => updateForm("credit", { overdueDangerDays: Number(v) || 1 })} type="number" />
            </div>
          )}

          {tab === "backup" && (
            <div className="space-y-4">
              <p className="text-sm text-text-light">Configure Google Apps Script Web App for Drive backup and image uploads.</p>
              <Field label="GAS Web App URL" value={(s as BackupSettings).gasUrl} onChange={(v) => updateForm("backup", { gasUrl: v })} />
              <Field label="Google Drive Folder ID (for product photos)" value={(s as BackupSettings).driveFolderId} onChange={(v) => updateForm("backup", { driveFolderId: v })} />
              <Field label="Google Drive Folder ID (for purchase bills)" value={(s as BackupSettings).billsFolderId} onChange={(v) => updateForm("backup", { billsFolderId: v })} />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => updateForm("backup", { autoBackupEnabled: !(s as BackupSettings).autoBackupEnabled })}
                    className={`relative h-5 w-9 rounded-full transition-colors ${(s as BackupSettings).autoBackupEnabled ? "bg-forest-green" : "bg-border"}`}
                  >
                    <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${(s as BackupSettings).autoBackupEnabled ? "translate-x-4" : ""}`} />
                  </button>
                  Auto Backup (daily midnight)
                </label>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-text">Last Backup</p>
                <p className="text-sm text-text-light">{(s as BackupSettings).lastBackupAt ? (s as BackupSettings).lastBackupAt!.toDate().toLocaleString() : "Never"}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={async () => {
                    if (!(s as BackupSettings).gasUrl) { setError("Enter GAS URL first"); return; }
                    setBackupTesting(true); setError(null);
                    try {
                      await fetch((s as BackupSettings).gasUrl + "?action=getStatus", { method: "GET", mode: "no-cors" });
                      setSuccess("Connection successful (request sent)");
                    } catch (e) { setError(e instanceof Error ? e.message : "Connection failed"); }
                    finally { setBackupTesting(false); }
                  }}
                  disabled={backupTesting}
                  className="rounded-btn border border-forest-green px-4 py-2 text-sm font-medium text-forest-green transition-colors hover:bg-forest-green hover:text-white disabled:opacity-60"
                >
                  {backupTesting ? "Testing..." : "Test Connection"}
                </button>
                <button
                  onClick={async () => {
                    if (!(s as BackupSettings).gasUrl) { setError("Enter GAS URL first"); return; }
                    setBackupRunning(true); setError(null);
                    try {
                      const ts = Timestamp.now();
                      const payload = {
                        action: "backupCSV",
                        fileName: `backup-trigger-${ts.toMillis()}.csv`,
                        csvContent: `timestamp,source\n${ts.toMillis()},manual-settings\n`,
                      };
                      await fetch((s as BackupSettings).gasUrl, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
                      await setDocument("settings/backup", { ...forms.backup, lastBackupAt: ts, updatedAt: ts });
                      setForms((prev) => ({ ...prev, backup: { ...prev.backup, lastBackupAt: ts } }));
                      setSuccess("Manual backup completed");
                      if (staff) logActivity({ action: "Manual backup", details: "Manual backup via Settings", module: "Settings", staffId: staff.id, staffName: staff.name });
                    } catch (e) { setError(e instanceof Error ? e.message : "Backup failed"); }
                    finally { setBackupRunning(false); }
                  }}
                  disabled={backupRunning}
                  className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark disabled:opacity-60"
                >
                  {backupRunning ? "Running..." : "Run Manual Backup"}
                </button>
              </div>
            </div>
          )}

          {tab === "loyalty" && (
            <div className="space-y-4">
              <p className="text-sm text-text-light">Configure the loyalty points program. Customers earn points on purchases and redeem them for discounts.</p>
              <Toggle label="Enable Loyalty Program" checked={(s as LoyaltySettings).enabled} onChange={(v) => updateForm("loyalty", { enabled: v })} />
              <Field label="Points per Rs (amount to earn 1 point)" value={String((s as LoyaltySettings).pointsPerRupee)} onChange={(v) => updateForm("loyalty", { pointsPerRupee: Number(v) || 100 })} type="number" />
              <Field label="Redemption Rate (1 point = Rs X)" value={String((s as LoyaltySettings).redemptionRate)} onChange={(v) => updateForm("loyalty", { redemptionRate: Number(v) || 1 })} type="number" />
              <Field label="Minimum Points to Redeem" value={String((s as LoyaltySettings).minRedemption)} onChange={(v) => updateForm("loyalty", { minRedemption: Number(v) || 100 })} type="number" />
              <Field label="Max Redemption (% of order total)" value={String((s as LoyaltySettings).maxRedemptionPercent)} onChange={(v) => updateForm("loyalty", { maxRedemptionPercent: Number(v) || 50 })} type="number" />
            </div>
          )}

          {tab === "financeSheet" && (
            <div className="space-y-4">
              <p className="text-sm text-text-light">Manage Google Sheets integration for finance reports. Push chart of accounts, journal entries, trial balance, fixed assets, payroll, and daily register data to a Google Sheet.</p>

              <div className="rounded-lg border border-info/20 bg-info/5 p-3 text-xs text-info">
                <strong>Note:</strong> Due to browser CORS limits, the sheet URL can't be captured automatically after push.
                After the first push, find the sheet named <strong>"GPT Finance Report - YYYY-MM-DD"</strong> in your Google Drive,
                then paste its Sheet ID below so subsequent pushes reuse the same sheet.
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text">Sheet ID (from sheet URL)</label>
                <input
                  value={(s as FinanceSheetSettings).sheetId || ""}
                  onChange={(e) => updateForm("financeSheet", { sheetId: e.target.value || null })}
                  className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
                  placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                />
                <p className="mt-1 text-xs text-text-light">The long ID in your sheet URL: <span className="font-mono">https://docs.google.com/spreadsheets/d/<strong>1BxiMVs0XRA...</strong>/edit</span></p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Sheet URL</label>
                <input
                  value={(s as FinanceSheetSettings).sheetUrl || ""}
                  onChange={(e) => updateForm("financeSheet", { sheetUrl: e.target.value || null })}
                  className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
                  placeholder="Paste the full sheet URL here"
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-text">Last Push</p>
                <p className="text-sm text-text-light">{(s as FinanceSheetSettings).lastPushAt ? new Date((s as FinanceSheetSettings).lastPushAt!.seconds * 1000).toLocaleString() : "Never"}</p>
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  onClick={async () => {
                    const backup = forms.backup;
                    if (!backup.gasUrl) { setError("Configure GAS URL in Backup tab first"); return; }
                    setPushingSheet(true); setError(null);
                    try {
                      const result = await pushFinanceToSheets(backup.gasUrl, staff?.id || "");
                      updateForm("financeSheet", { sheetId: result.sheetId || (s as FinanceSheetSettings).sheetId, sheetUrl: result.sheetUrl || (s as FinanceSheetSettings).sheetUrl, lastPushAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any, updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any });
                      setSuccess("Finance data pushed to Google Sheets");
                      if (staff) logActivity({ action: "Pushed finance to Sheets", details: "Finance data pushed from Settings", module: "Settings", staffId: staff.id, staffName: staff.name });
                    } catch (e) { setError(e instanceof Error ? e.message : "Push failed"); }
                    finally { setPushingSheet(false); }
                  }}
                  disabled={pushingSheet}
                  className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark disabled:opacity-60"
                >
                  {pushingSheet ? "Pushing..." : "Push Finance Data to Sheets"}
                </button>
              </div>
            </div>
          )}

          {tab === "budgets" && (
            <div>
              <p className="mb-4 text-sm text-text-light">Set budget limits per expense category. Categories set to "Track" will show spending without a limit.</p>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs text-text-muted">
                  <tr><th className="px-4 py-2 font-medium">Category</th><th className="px-4 py-2 font-medium">Mode</th><th className="px-4 py-2 font-medium">Limit (NPR)</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries((s as BudgetSettings).categories).map(([cat, cfg]) => (
                    <tr key={cat}>
                      <td className="px-4 py-2 font-medium capitalize text-text">{cat}</td>
                      <td className="px-4 py-2">
                        <select
                          value={cfg.mode}
                          onChange={(e) => {
                            const mode = e.target.value as "limit" | "track";
                            updateForm("budgets", { categories: { ...(s as BudgetSettings).categories, [cat]: { ...cfg, mode } } });
                          }}
                          className="rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green"
                        >
                          <option value="track">Track</option>
                          <option value="limit">Limit</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={cfg.limit ?? ""}
                          onChange={(e) => updateForm("budgets", { categories: { ...(s as BudgetSettings).categories, [cat]: { ...cfg, limit: e.target.value ? Number(e.target.value) : null } } })}
                          className="w-32 rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green"
                          type="number"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {can("settings.write") && (
            <div className="mt-6 flex justify-end border-t border-border pt-4">
              <button onClick={handleSave} disabled={saving} className="rounded-btn bg-forest-green px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark disabled:opacity-60">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function Field({ label, value, onChange, textarea, type = "text" }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none transition-colors focus:border-forest-green" rows={3} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none transition-colors focus:border-forest-green" />
      )}
    </div>
  );
}

function PhoneField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))} type="text" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none transition-colors focus:border-forest-green" placeholder="98XXXXXXXX" />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mb-3 flex items-center gap-3 text-sm">
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-forest-green" : "bg-border"}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`} />
      </button>
      {label}
    </label>
  );
}
