import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useStaff } from "../hooks/useStaff";
import { getTrialBalance } from "../utils/accountingEngine";
import type { TrialBalanceRow } from "../types";

export default function TrialBalancePage() {
  const { can } = useStaff();
  const [data, setData] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<TrialBalanceRow | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const result = await getTrialBalance();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalDebit = data.reduce((s, r) => s + r.totalDebit, 0);
  const totalCredit = data.reduce((s, r) => s + r.totalCredit, 0);
  const assets = data.filter((r) => r.type === "asset");
  const liabilities = data.filter((r) => r.type === "liability");
  const equity = data.filter((r) => r.type === "equity");
  const income = data.filter((r) => r.type === "income");
  const expenses = data.filter((r) => r.type === "expense");

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Trial Balance</h1>
            <p className="text-sm text-text-light">All accounts with their debit and credit balances</p>
          </div>
          <button onClick={load} disabled={loading} className="rounded-btn border border-border px-3 py-2 text-sm font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        {loading ? <LoadingSkeleton type="table" /> : (
          <div className="rounded-card bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-beige/30">
                  <th className="px-4 py-2 font-medium text-text-muted">Code</th>
                  <th className="px-4 py-2 font-medium text-text-muted">Account</th>
                  <th className="px-4 py-2 font-medium text-text-muted">Type</th>
                  <th className="px-4 py-2 text-right font-medium text-text-muted">Debit</th>
                  <th className="px-4 py-2 text-right font-medium text-text-muted">Credit</th>
                  <th className="px-4 py-2 text-right font-medium text-text-muted">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <SectionRows rows={assets} label="Assets" onRowClick={setSelectedRow} />
                <SectionRows rows={liabilities} label="Liabilities" onRowClick={setSelectedRow} />
                <SectionRows rows={equity} label="Equity" onRowClick={setSelectedRow} />
                <SectionRows rows={income} label="Income" onRowClick={setSelectedRow} />
                <SectionRows rows={expenses} label="Expenses" onRowClick={setSelectedRow} />
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-text font-bold">
                  <td colSpan={3} className="px-4 py-2 text-text">Total</td>
                  <td className="px-4 py-2 text-right text-forest-green">NPR {totalDebit.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-error">NPR {totalCredit.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-text">NPR {(totalDebit - totalCredit).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {selectedRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setSelectedRow(null)}>
          <div className="mx-4 w-full max-w-sm rounded-card bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-text">{selectedRow.accountName}</h2>
              <button onClick={() => setSelectedRow(null)} className="text-xl text-text-light">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-text-light">Account Code</span><span className="font-mono font-medium text-text">{selectedRow.accountCode}</span></div>
              <div className="flex justify-between">
                <span className="text-text-light">Type</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  selectedRow.type === "asset" ? "bg-info/10 text-info" :
                  selectedRow.type === "liability" ? "bg-warning/10 text-warning" :
                  selectedRow.type === "equity" ? "bg-success/10 text-success" :
                  selectedRow.type === "income" ? "bg-forest-green/10 text-forest-green" :
                  "bg-error/10 text-error"
                }`}>{selectedRow.type}</span>
              </div>
              <div className="border-t border-border" />
              <div className="flex justify-between"><span className="text-text-light">Total Debit</span><span className="font-medium text-forest-green">NPR {selectedRow.totalDebit.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-text-light">Total Credit</span><span className="font-medium text-error">NPR {selectedRow.totalCredit.toLocaleString()}</span></div>
              <div className="border-t border-border" />
              <div className="flex justify-between"><span className="font-medium text-text">Balance</span><span className={`font-bold ${selectedRow.balance >= 0 ? "text-forest-green" : "text-error"}`}>
                NPR {Math.abs(selectedRow.balance).toLocaleString()} {selectedRow.balance < 0 ? "Cr" : "Dr"}
              </span></div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function SectionRows({ rows, label, onRowClick }: { rows: TrialBalanceRow[]; label: string; onRowClick: (r: TrialBalanceRow) => void }) {
  if (rows.length === 0) return null;
  return (
    <>
      <tr className="bg-beige/50">
        <td colSpan={6} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">{label} ({rows.length})</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.accountCode} onClick={() => onRowClick(r)} className="cursor-pointer">
          <td className="px-4 py-1.5 font-mono text-xs text-text">{r.accountCode}</td>
          <td className="px-4 py-1.5 text-text">{r.accountName}</td>
          <td className="px-4 py-1.5"><span className="rounded-full bg-beige px-2 py-0.5 text-xs">{r.type}</span></td>
          <td className="px-4 py-1.5 text-right text-forest-green">{r.totalDebit > 0 ? `NPR ${r.totalDebit.toLocaleString()}` : ""}</td>
          <td className="px-4 py-1.5 text-right text-error">{r.totalCredit > 0 ? `NPR ${r.totalCredit.toLocaleString()}` : ""}</td>
          <td className={`px-4 py-1.5 text-right font-medium ${r.balance >= 0 ? "text-forest-green" : "text-error"}`}>
            NPR {Math.abs(r.balance).toLocaleString()} {r.balance < 0 ? "Cr" : "Dr"}
          </td>
        </tr>
      ))}
    </>
  );
}
