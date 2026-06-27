import { useState } from "react";
import FormModal from "./FormModal";
import type { Order } from "../types";

interface MarkPaidModalProps {
  open: boolean;
  onClose: () => void;
  order: Order;
  onMark: (method: string, amount: number, note: string) => Promise<void>;
  saving?: boolean;
}

export default function MarkPaidModal({ open, onClose, order, onMark, saving }: MarkPaidModalProps) {
  const [method, setMethod] = useState<string>("cash");
  const [amount, setAmount] = useState(order.grandTotal);
  const [note, setNote] = useState("");

  return (
    <FormModal open={open} onClose={onClose} title={`Mark Paid: ${order.orderNumber}`} onSave={() => onMark(method, amount, note)} saving={saving} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-text-light">
          Outstanding: <span className="font-bold text-forest-green">NPR {order.grandTotal.toLocaleString()}</span>
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Payment Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
            <option value="cash">Cash</option>
            <option value="bank">Bank Transfer</option>
            <option value="esewa">eSewa</option>
            <option value="khalti">Khalti</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Amount (NPR)</label>
          <input value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" rows={2} />
        </div>
      </div>
    </FormModal>
  );
}
