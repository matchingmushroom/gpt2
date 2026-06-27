import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, getDocument, setDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { computeDailyRegister, computeClosingBalances, closeRegister } from "../utils/dailyRegister";
import type { DailyRegister as DailyRegisterType } from "../types";

export default function DailyRegisterPage() {
  const { staff, can } = useStaff();
  const { data: registers } = useCollection<DailyRegisterType>("dailyRegisters");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustedCash, setAdjustedCash] = useState(0);
  const [cashIn, setCashIn] = useState(0);
  const [cashOut, setCashOut] = useState(0);
  const [notes, setNotes] = useState("");

  const todayRegister = registers.find((r) => {
    const d = new Date(r.date.seconds * 1000);
    return d.toISOString().split("T")[0] === selectedDate;
  });

  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    computeDailyRegister(new Date(selectedDate)).then((result) => {
      setData(result);
      setAdjustedCash(result.openingCash);
      setCashIn(0);
      setCashOut(0);
      setNotes(todayRegister?.notes || "");
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [selectedDate, todayRegister]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const result = await computeDailyRegister(new Date(selectedDate));
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  const handleOpenRegister = async () => {
    if (!staff || !can("dailyRegister.write") || !data) return;
    setSaving(true);
    try {
      await addDocument("dailyRegisters", {
        date: new Date(selectedDate),
        openingCash: data.openingCash,
        openingBank: data.openingBank,
        openingEsewa: data.openingEsewa,
        openingKhalti: data.openingKhalti,
        cashSales: data.cashSales,
        bankSales: data.bankSales,
        esewaSales: data.esewaSales,
        khaltiSales: data.khaltiSales,
        creditSales: data.creditSales,
        totalExpenses: data.totalExpenses,
        totalPurchases: data.totalPurchases,
        cashIn: 0, cashOut: 0,
        closingCash: 0, closingBank: 0, closingEsewa: 0, closingKhalti: 0,
        expectedClosingCash: 0, cashDifference: 0,
        notes: "", status: "open",
        closedBy: null, closedAt: null,
      });
      logActivity({ action: "Opened daily register", details: `Opened register for ${selectedDate}`, module: "Finance", staffId: staff.id, staffName: staff.name });
      handleRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  };

  const handleClose = async () => {
    if (!staff || !can("dailyRegister.write") || !todayRegister || !data) return;
    if (!confirm(`Close register for ${selectedDate}? A journal entry will be created.`)) return;

    const closingBalances = computeClosingBalances({
      ...data, cashIn, cashOut,
    });

    setSaving(true);
    try {
      const docId = todayRegister.id;
      await setDocument(`dailyRegisters/${docId}`, {
        cashIn, cashOut,
        closingCash: adjustedCash,
        closingBank: closingBalances.closingBank,
        closingEsewa: closingBalances.closingEsewa,
        closingKhalti: closingBalances.closingKhalti,
        expectedClosingCash: closingBalances.expectedClosingCash,
        cashDifference: Math.round((adjustedCash - closingBalances.expectedClosingCash) * 100) / 100,
        status: "closed",
        closedBy: staff.id,
        closedAt: new Date(),
        notes,
      });
      logActivity({ action: "Closed daily register", details: `Closed register for ${selectedDate}`, module: "Finance", staffId: staff.id, staffName: staff.name });
      handleRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  };

  const isOpen = todayRegister?.status === "open";
  const isClosed = todayRegister?.status === "closed";
  const balances = data ? computeClosingBalances({ ...data, cashIn, cashOut }) : null;

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Daily Register</h1>
            <p className="text-sm text-text-light">{todayRegister ? todayRegister.status.toUpperCase() : "Not opened"}</p>
          </div>
          <div className="flex gap-2">
            <input value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} type="date" className="rounded-input border border-border px-3 py-2 text-sm outline-none focus:border-forest-green" />
            <button onClick={handleRefresh} disabled={loading} className="rounded-btn border border-border px-3 py-2 text-sm font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green">
              {loading ? "..." : "Refresh"}
            </button>
            {!isOpen && !isClosed && can("dailyRegister.write") && (
              <button onClick={handleOpenRegister} disabled={saving} className="rounded-btn bg-forest-green px-3 py-2 text-sm font-medium text-white">
                {saving ? "..." : "Open Register"}
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        {loading ? (
          <div className="rounded-card bg-white p-10 text-center shadow-card">
            <p className="text-text-muted">Loading...</p>
          </div>
        ) : data ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-card bg-white p-5 shadow-card">
              <h2 className="mb-4 font-heading text-base font-bold text-text">Opening Balances</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-light">Cash in Hand</span><span className="font-medium text-text">NPR {data.openingCash.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Bank</span><span className="font-medium text-text">NPR {data.openingBank.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Esewa</span><span className="font-medium text-text">NPR {data.openingEsewa.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Khalti</span><span className="font-medium text-text">NPR {data.openingKhalti.toLocaleString()}</span></div>
              </div>
            </div>

            <div className="rounded-card bg-white p-5 shadow-card">
              <h2 className="mb-4 font-heading text-base font-bold text-text">Today's Transactions</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-light">Cash Sales</span><span className="font-medium text-forest-green">NPR {data.cashSales.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Bank Sales</span><span className="font-medium text-forest-green">NPR {data.bankSales.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Esewa Sales</span><span className="font-medium text-forest-green">NPR {data.esewaSales.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Khalti Sales</span><span className="font-medium text-forest-green">NPR {data.khaltiSales.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Credit Sales</span><span className="font-medium text-info">NPR {data.creditSales.toLocaleString()}</span></div>
                <div className="border-t border-border pt-2">
                  <div className="flex justify-between"><span className="text-text-light">Expenses</span><span className="font-medium text-error">(NPR {data.totalExpenses.toLocaleString()})</span></div>
                  <div className="flex justify-between"><span className="text-text-light">Purchases</span><span className="font-medium text-error">(NPR {data.totalPurchases.toLocaleString()})</span></div>
                </div>
              </div>
            </div>

            {isOpen && (
              <div className="rounded-card bg-white p-5 shadow-card lg:col-span-2">
                <h2 className="mb-4 font-heading text-base font-bold text-text">Closing</h2>
                {balances && (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-text-light">Expected Closing Cash</span><span className="font-medium text-text">NPR {balances.expectedClosingCash.toLocaleString()}</span></div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text">Actual Cash Count</label>
                      <input value={adjustedCash} onChange={(e) => setAdjustedCash(Number(e.target.value) || 0)} type="number" className="w-full max-w-xs rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" />
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text">Cash In (manual)</label>
                        <input value={cashIn} onChange={(e) => setCashIn(Number(e.target.value) || 0)} type="number" className="w-full max-w-[160px] rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text">Cash Out (manual)</label>
                        <input value={cashOut} onChange={(e) => setCashOut(Number(e.target.value) || 0)} type="number" className="w-full max-w-[160px] rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" />
                      </div>
                    </div>
                    <div className="flex justify-between text-base font-bold">
                      <span className="text-text">Cash Difference</span>
                      <span className={adjustedCash >= balances.expectedClosingCash ? "text-success" : "text-error"}>
                        NPR {(adjustedCash - balances.expectedClosingCash).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text">Notes</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" rows={2} />
                    </div>
                    <button onClick={handleClose} disabled={saving} className="rounded-btn bg-mustard-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-mustard-gold-light disabled:opacity-60">
                      {saving ? "Closing..." : "Close Register"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isClosed && balances && (
              <div className="rounded-card bg-white p-5 shadow-card lg:col-span-2">
                <h2 className="mb-4 font-heading text-base font-bold text-text">Closed — Summary</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-text-light">Closing Cash</span><span className="font-medium text-text">NPR {todayRegister.closingCash.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-text-light">Closing Bank</span><span className="font-medium text-text">NPR {todayRegister.closingBank.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-text-light">Closing Esewa</span><span className="font-medium text-text">NPR {todayRegister.closingEsewa.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-text-light">Closing Khalti</span><span className="font-medium text-text">NPR {todayRegister.closingKhalti.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold">
                    <span className="text-text">Cash Difference</span>
                    <span className={todayRegister.cashDifference >= 0 ? "text-success" : "text-error"}>
                      NPR {todayRegister.cashDifference.toLocaleString()}
                    </span>
                  </div>
                  {todayRegister.notes && <div className="border-t border-border pt-2 text-xs text-text-light">{todayRegister.notes}</div>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-card bg-white p-10 text-center shadow-card">
            <p className="text-4xl">📅</p>
            <p className="mt-3 font-heading text-lg font-semibold text-text">Select a date and open the register</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
