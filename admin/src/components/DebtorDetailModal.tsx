import { useState } from "react";
import FormModal from "./FormModal";
import type { Debtor } from "../types";

interface Props {
  debtor: Debtor | null;
  onClose: () => void;
  onPayment: (debtorId: string, amount: number, method: string) => Promise<void>;
  saving: boolean;
  canWrite?: boolean;
}

export default function DebtorDetailModal({ debtor, onClose, onPayment, saving, canWrite = true }: Props) {
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("cash");
  const [showPayForm, setShowPayForm] = useState(false);

  if (!debtor) return null;

  const totalAmount = debtor.orders.reduce((s, o) => s + o.amount, 0);
  const totalPaid = debtor.orders.reduce((s, o) => s + o.paidAmount, 0);

  const handlePay = () => {
    if (payAmount <= 0) return;
    onPayment(debtor.id, payAmount, payMethod);
    setPayAmount(0);
    setShowPayForm(false);
  };

  return (
    <FormModal
      open={!!debtor}
      onClose={onClose}
      title={`${debtor.customerName} — ${debtor.customerPhone}`}
      size="lg"
      showSave={false}
    >
      <div className="space-y-5">
        {/* Status badge */}
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${debtor.clearedAt ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
            {debtor.clearedAt ? "Cleared" : "Active"}
          </span>
          <span className="text-sm text-text-muted">{debtor.orders.length} order(s)</span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-card bg-beige/50 p-3 text-center">
            <div className="text-xs text-text-muted">Total</div>
            <div className="font-heading text-lg font-bold text-text">NPR {totalAmount.toLocaleString()}</div>
          </div>
          <div className="rounded-card bg-beige/50 p-3 text-center">
            <div className="text-xs text-text-muted">Paid</div>
            <div className="font-heading text-lg font-bold text-forest-green">NPR {totalPaid.toLocaleString()}</div>
          </div>
          <div className="rounded-card bg-beige/50 p-3 text-center">
            <div className="text-xs text-text-muted">Due</div>
            <div className={`font-heading text-lg font-bold ${debtor.totalOutstanding > 0 ? "text-error" : "text-success"}`}>
              NPR {debtor.totalOutstanding.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Orders table */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-text">Orders</h3>
          <div className="overflow-x-auto rounded-lg border border-border text-sm">
            <table className="w-full">
              <thead className="bg-light-gray text-xs text-text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Order #</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-right font-medium">Paid</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {debtor.orders.map((o) => (
                  <tr key={o.orderId}>
                    <td className="px-3 py-2 font-mono text-xs text-text">{o.orderNumber}</td>
                    <td className="px-3 py-2 text-text-light">{o.date?.seconds ? new Date(o.date.seconds * 1000).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-text">NPR {o.amount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-forest-green">NPR {o.paidAmount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-medium text-error">NPR {o.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History */}
        {debtor.paymentHistory?.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-text">Payment History</h3>
            <div className="space-y-1.5">
              {[...debtor.paymentHistory].reverse().map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-btn bg-success/5 px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">{p.receivedAt?.seconds ? new Date(p.receivedAt.seconds * 1000).toLocaleDateString() : "—"}</span>
                    <span className="capitalize text-text-muted">{p.method}</span>
                    <span className="text-xs text-text-muted">{p.receivedByName}</span>
                    {p.note && <span className="text-xs text-text-muted">— {p.note}</span>}
                  </div>
                  <span className="font-semibold text-forest-green">−NPR {p.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Record payment */}
        {!debtor.clearedAt && canWrite && (
          <div>
            <button
              onClick={() => setShowPayForm(!showPayForm)}
              className="w-full rounded-btn border border-dashed border-forest-green px-4 py-2 text-sm font-medium text-forest-green transition-colors hover:bg-forest-green/5"
            >
              {showPayForm ? "Cancel" : "+ Record Payment"}
            </button>
            {showPayForm && (
              <div className="mt-3 space-y-3 rounded-card bg-light-gray p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Amount (NPR)</label>
                    <input value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value) || 0)} type="number" max={debtor.totalOutstanding} className="w-full rounded-input border border-border px-3 py-2 text-sm outline-none focus:border-forest-green" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Method</label>
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full rounded-input border border-border px-3 py-2 text-sm outline-none focus:border-forest-green">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="esewa">eSewa</option>
                      <option value="khalti">Khalti</option>
                    </select>
                  </div>
                </div>
                <button onClick={handlePay} disabled={saving || payAmount <= 0} className="w-full rounded-btn bg-forest-green py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark disabled:opacity-60">
                  {saving ? "Recording..." : `Record Payment — NPR ${payAmount.toLocaleString()}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </FormModal>
  );
}
