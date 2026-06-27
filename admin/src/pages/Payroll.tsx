import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { calculatePayrollEntries } from "../utils/payroll";
import { generatePayslipHtml } from "../utils/payslip";
import { postJournalEntry } from "../utils/accountingEngine";
import type { PayrollRun, PayrollEntry, Employee, PayrollStatus } from "../types";

export default function PayrollPage() {
  const { staff, can } = useStaff();
  const { data: runs, loading } = useCollection<PayrollRun>("payrollRuns");
  const { data: employees } = useCollection<Employee>("employees");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [payslipHtml, setPayslipHtml] = useState<string | null>(null);

  const [formPeriodLabel, setFormPeriodLabel] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formEntries, setFormEntries] = useState<PayrollEntry[]>([]);
  const [formNotes, setFormNotes] = useState("");

  const handleGenerate = () => {
    setFormPeriodLabel("");
    setFormStart("");
    setFormEnd("");
    setFormEntries([]);
    setFormNotes("");
    setError(null);
    setModalOpen(true);
  };

  const handlePreview = () => {
    if (!formStart || !formEnd || !formPeriodLabel) { setError("Period dates and label required"); return; }
    const results = calculatePayrollEntries(
      employees.filter((e) => e.isActive),
      new Date(formStart),
      new Date(formEnd),
    );
    if (results.length === 0) { setError("No active employees found for this period"); return; }
    setFormEntries(results);
  };

  const handleSave = async () => {
    if (!staff || !can("payroll.write")) return;
    if (formEntries.length === 0) { setError("Generate preview first"); return; }
    setSaving(true); setError(null);
    try {
      const totalGross = formEntries.reduce((s, e) => s + e.grossPay, 0);
      const totalDed = formEntries.reduce((s, e) => s + e.taxDeduction + e.pfDeduction + e.otherDeductions, 0);
      const totalNet = formEntries.reduce((s, e) => s + e.netPay, 0);

      await addDocument("payrollRuns", {
        periodLabel: formPeriodLabel,
        periodStart: new Date(formStart),
        periodEnd: new Date(formEnd),
        entries: formEntries,
        totalGrossPay: Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDed * 100) / 100,
        totalNetPay: Math.round(totalNet * 100) / 100,
        status: "draft",
        disbursedAt: null,
        notes: formNotes,
        createdBy: staff.id,
      });
      logActivity({ action: "Created payroll run", details: `Payroll for ${formPeriodLabel}: ${formEntries.length} employees, NPR ${totalNet.toLocaleString()} net`, module: "Finance", staffId: staff.id, staffName: staff.name });
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleApprove = async (run: PayrollRun) => {
    if (!staff || !can("payroll.write")) return;
    if (!confirm(`Approve payroll for ${run.periodLabel}?`)) return;
    setSaving(true);
    try {
      await setDocument(`payrollRuns/${run.id}`, { status: "approved" });
      logActivity({ action: "Approved payroll", details: `Approved payroll for ${run.periodLabel}`, module: "Finance", staffId: staff.id, staffName: staff.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally { setSaving(false); }
  };

  const handleDisburse = async (run: PayrollRun) => {
    if (!staff || !can("payroll.write")) return;
    if (!confirm(`Disburse payroll for ${run.periodLabel}? A journal entry will be created.`)) return;
    setSaving(true);
    try {
      const salaryAccount = "50800";
      const cashAccount = "10100";
      const taxPayableAccount = "20400";
      const pfPayableAccount = "20500";

      const lines: { accountCode: string; accountName: string; debit: number; credit: number }[] = [];
      lines.push({ accountCode: salaryAccount, accountName: "", debit: run.totalGrossPay, credit: 0 });
      lines.push({ accountCode: cashAccount, accountName: "", debit: 0, credit: run.totalNetPay });
      const totalTax = run.entries.reduce((s, e) => s + e.taxDeduction, 0);
      const totalPf = run.entries.reduce((s, e) => s + e.pfDeduction, 0);
      if (totalTax > 0) lines.push({ accountCode: taxPayableAccount, accountName: "", debit: 0, credit: totalTax });
      if (totalPf > 0) lines.push({ accountCode: pfPayableAccount, accountName: "", debit: 0, credit: totalPf });

      await postJournalEntry({
        entryDate: new Date(),
        description: `Payroll disbursement — ${run.periodLabel}`,
        lines,
        referenceType: "payroll",
        referenceId: run.id,
        createdBy: staff.id,
      });

      await setDocument(`payrollRuns/${run.id}`, { status: "disbursed", disbursedAt: new Date() });
      logActivity({ action: "Disbursed payroll", details: `Disbursed payroll for ${run.periodLabel}: NPR ${run.totalNetPay.toLocaleString()}`, module: "Finance", staffId: staff.id, staffName: staff.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disburse");
    } finally { setSaving(false); }
  };

  const handleViewPayslip = (run: PayrollRun, entry: PayrollEntry) => {
    const emp = employees.find((e) => e.id === entry.employeeId);
    if (!emp) return;
    const html = generatePayslipHtml(emp, entry, run.periodLabel);
    setPayslipHtml(html);
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Payroll</h1>
            <p className="text-sm text-text-light">{runs.length} payroll runs</p>
          </div>
          {can("payroll.write") && (
            <button onClick={handleGenerate} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white">+ Generate Payroll</button>
          )}
        </div>
        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={[
            { key: "period", header: "Period", render: (r: PayrollRun) => <span className="font-medium text-text">{r.periodLabel}</span>, sortable: true },
            { key: "employees", header: "Employees", render: (r: PayrollRun) => <span className="text-text-light">{r.entries.length}</span> },
            { key: "gross", header: "Gross", render: (r: PayrollRun) => <span className="text-text-light">NPR {r.totalGrossPay.toLocaleString()}</span> },
            { key: "net", header: "Net Pay", render: (r: PayrollRun) => <span className="font-medium text-forest-green">NPR {r.totalNetPay.toLocaleString()}</span> },
            { key: "status", header: "Status", render: (r: PayrollRun) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                r.status === "disbursed" ? "bg-success/10 text-success" :
                r.status === "approved" ? "bg-info/10 text-info" :
                "bg-warning/10 text-warning"
              }`}>{r.status}</span>
            )},
            { key: "actions", header: "", render: (r: PayrollRun) => (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {r.status === "draft" && can("payroll.write") && (
                  <button onClick={() => handleApprove(r)} className="text-xs text-info">Approve</button>
                )}
                {r.status === "approved" && can("payroll.write") && (
                  <button onClick={() => handleDisburse(r)} className="text-xs text-success">Disburse</button>
                )}
                {r.status === "disbursed" && (
                  <button onClick={() => setSelectedRun(r)} className="text-xs text-info">View</button>
                )}
              </div>
            ), width: "120px" },
          ]}
          data={runs}
          keyExtractor={(r) => r.id}
          onRowClick={(r) => setSelectedRun(r)}
          loading={loading}
          emptyMessage="No payroll runs yet"
          emptyIcon="💰"
        />

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="Generate Payroll" onSave={handleSave} saving={saving} size="lg" saveLabel={formEntries.length > 0 ? "Save Payroll Run" : "Preview"}>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div><label className="mb-1 block text-sm font-medium text-text">Period Label</label><input value={formPeriodLabel} onChange={(e) => setFormPeriodLabel(e.target.value)} placeholder="e.g., 2082-04" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div><label className="mb-1 block text-sm font-medium text-text">From</label><input value={formStart} onChange={(e) => setFormStart(e.target.value)} type="date" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div><label className="mb-1 block text-sm font-medium text-text">To</label><input value={formEnd} onChange={(e) => setFormEnd(e.target.value)} type="date" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div className="flex items-end">
                <button type="button" onClick={handlePreview} className="rounded-btn border border-border px-3 py-2 text-sm font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">Preview</button>
              </div>
            </div>
            {formEntries.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-text">Calculated Entries ({formEntries.length})</h3>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead><tr className="bg-beige/50"><th className="px-2 py-1 font-medium text-text-muted">Employee</th><th className="px-2 py-1 text-right font-medium text-text-muted">Days</th><th className="px-2 py-1 text-right font-medium text-text-muted">Gross</th><th className="px-2 py-1 text-right font-medium text-text-muted">Tax</th><th className="px-2 py-1 text-right font-medium text-text-muted">PF</th><th className="px-2 py-1 text-right font-medium text-text-muted">Net</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {formEntries.map((e, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1 text-text">{e.employeeName}</td>
                          <td className="px-2 py-1 text-right text-text-light">{e.workingDays}</td>
                          <td className="px-2 py-1 text-right text-text">{e.grossPay.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right text-error">({e.taxDeduction.toFixed(2)})</td>
                          <td className="px-2 py-1 text-right text-error">({e.pfDeduction.toFixed(2)})</td>
                          <td className="px-2 py-1 text-right font-medium text-forest-green">{e.netPay.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border font-bold">
                        <td className="px-2 py-1 text-text">Total</td>
                        <td className="px-2 py-1 text-right">{formEntries.reduce((s, e) => s + e.workingDays, 0)}</td>
                        <td className="px-2 py-1 text-right">{formEntries.reduce((s, e) => s + e.grossPay, 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right text-error">({formEntries.reduce((s, e) => s + e.taxDeduction, 0).toFixed(2)})</td>
                        <td className="px-2 py-1 text-right text-error">({formEntries.reduce((s, e) => s + e.pfDeduction, 0).toFixed(2)})</td>
                        <td className="px-2 py-1 text-right text-forest-green">{formEntries.reduce((s, e) => s + e.netPay, 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
            <div><label className="mb-1 block text-sm font-medium text-text">Notes</label><textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" rows={2} /></div>
          </div>
        </FormModal>

        {selectedRun && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setSelectedRun(null)}>
            <div className="mx-4 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-text">Payroll — {selectedRun.periodLabel}</h2>
                <button onClick={() => setSelectedRun(null)} className="text-2xl text-text-muted">✕</button>
              </div>
              <div className="mb-4 text-sm text-text-light">
                <p>Status: <span className="font-medium">{selectedRun.status}</span></p>
                <p>Total Gross: NPR {selectedRun.totalGrossPay.toLocaleString()} | Net: NPR {selectedRun.totalNetPay.toLocaleString()}</p>
                {selectedRun.disbursedAt && <p>Disbursed: {new Date(selectedRun.disbursedAt.seconds * 1000).toLocaleDateString()}</p>}
              </div>
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b border-border"><th className="py-1 font-medium text-text-muted">Employee</th><th className="py-1 text-right font-medium text-text-muted">Gross</th><th className="py-1 text-right font-medium text-text-muted">Tax</th><th className="py-1 text-right font-medium text-text-muted">PF</th><th className="py-1 text-right font-medium text-text-muted">Net</th><th></th></tr></thead>
                <tbody className="divide-y divide-border">
                  {selectedRun.entries.map((e, i) => (
                    <tr key={i}>
                      <td className="py-1 text-text">{e.employeeName}</td>
                      <td className="py-1 text-right text-text">NPR {e.grossPay.toLocaleString()}</td>
                      <td className="py-1 text-right text-error">({e.taxDeduction.toFixed(2)})</td>
                      <td className="py-1 text-right text-error">({e.pfDeduction.toFixed(2)})</td>
                      <td className="py-1 text-right font-medium text-forest-green">NPR {e.netPay.toLocaleString()}</td>
                      <td className="py-1">
                        {selectedRun.status === "disbursed" && (
                          <button onClick={() => handleViewPayslip(selectedRun, e)} className="text-xs text-info">Payslip</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {payslipHtml && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setPayslipHtml(null)}>
            <div className="mx-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-heading text-base font-bold text-text">Payslip</h2>
                <div className="flex gap-2">
                  <button onClick={() => {
                    const win = window.open("", "_blank");
                    if (win) { win.document.write(payslipHtml); win.document.close(); win.print(); }
                  }} className="rounded-btn border border-border px-3 py-1.5 text-xs font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">Print</button>
                  <button onClick={() => setPayslipHtml(null)} className="text-2xl text-text-muted">✕</button>
                </div>
              </div>
              <div className="max-h-[80vh] overflow-y-auto p-4" dangerouslySetInnerHTML={{ __html: payslipHtml }} />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
