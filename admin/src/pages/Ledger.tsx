import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { getLedger } from "../utils/accountingEngine";
import type { Account } from "../types";

export default function LedgerPage() {
  const { can } = useStaff();
  const { data: accounts } = useCollection<Account>("accounts");
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [ledgerData, setLedgerData] = useState<{ account: Account | null; entries: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  useEffect(() => {
    if (!selectedCode) { setLedgerData(null); return; }
    setLoading(true);
    getLedger(selectedCode).then(setLedgerData).finally(() => setLoading(false));
  }, [selectedCode]);

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6">
          <h1 className="font-heading text-xl font-bold text-text">General Ledger</h1>
          <p className="text-sm text-text-light">View transactions for any account</p>
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-text">Select Account</label>
          <select
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
            className="w-full max-w-md rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
          >
            <option value="">Choose an account...</option>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>{a.code} — {a.name} ({a.type})</option>
            ))}
          </select>
        </div>

        {loading && <LoadingSkeleton type="detail" />}

        {ledgerData && !loading && (
          <div className="rounded-card bg-white shadow-card">
            <div className="border-b border-border p-4">
              <h2 className="font-heading text-lg font-bold text-text">{ledgerData.account?.name}</h2>
              <p className="text-xs text-text-muted">Code: {ledgerData.account?.code} | Type: {ledgerData.account?.type} | Normal Balance: {ledgerData.account?.normalBalance}</p>
            </div>
            {ledgerData.entries.length === 0 ? (
              <div className="p-10 text-center text-text-muted">No transactions for this account</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-beige/30">
                    <th className="px-4 py-2 font-medium text-text-muted">Date</th>
                    <th className="px-4 py-2 font-medium text-text-muted">Entry #</th>
                    <th className="px-4 py-2 font-medium text-text-muted">Description</th>
                    <th className="px-4 py-2 text-right font-medium text-text-muted">Debit</th>
                    <th className="px-4 py-2 text-right font-medium text-text-muted">Credit</th>
                    <th className="px-4 py-2 text-right font-medium text-text-muted">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ledgerData.entries.map((e, i) => (
                    <tr key={i} onClick={() => setSelectedEntry(e)} className="cursor-pointer">
                      <td className="px-4 py-2 text-text-light">{e.date.toLocaleDateString()}</td>
                      <td className="px-4 py-2 font-mono text-xs text-text">{e.entryNumber}</td>
                      <td className="px-4 py-2 text-text">{e.description}</td>
                      <td className="px-4 py-2 text-right text-forest-green">{e.debit ? `NPR ${e.debit.toLocaleString()}` : ""}</td>
                      <td className="px-4 py-2 text-right text-error">{e.credit ? `NPR ${e.credit.toLocaleString()}` : ""}</td>
                      <td className={`px-4 py-2 text-right font-medium ${e.runningBalance >= 0 ? "text-forest-green" : "text-error"}`}>
                        NPR {e.runningBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {selectedEntry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setSelectedEntry(null)}>
          <div className="mx-4 w-full max-w-md rounded-card bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-text">{selectedEntry.entryNumber}</h2>
              <button onClick={() => setSelectedEntry(null)} className="text-xl text-text-light">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-text-light">Date</span><span className="font-medium text-text">{selectedEntry.date.toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-text-light">Description</span><span className="text-text">{selectedEntry.description}</span></div>
              <div className="border-t border-border" />
              <div className="flex justify-between"><span className="text-text-light">Debit</span><span className="font-medium text-forest-green">NPR {selectedEntry.debit?.toLocaleString() || "0"}</span></div>
              <div className="flex justify-between"><span className="text-text-light">Credit</span><span className="font-medium text-error">NPR {selectedEntry.credit?.toLocaleString() || "0"}</span></div>
              <div className="border-t border-border" />
              <div className="flex justify-between"><span className="font-medium text-text">Running Balance</span><span className={`font-bold ${selectedEntry.runningBalance >= 0 ? "text-forest-green" : "text-error"}`}>NPR {selectedEntry.runningBalance.toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
