import { useState } from "react";
import FormModal from "./FormModal";
import type { Order } from "../types";

const ALL_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"];

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

interface UpdateStatusModalProps {
  open: boolean;
  onClose: () => void;
  order: Order;
  onUpdate: (status: string, note: string) => Promise<void>;
  saving?: boolean;
  isAdmin?: boolean;
}

export default function UpdateStatusModal({ open, onClose, order, onUpdate, saving, isAdmin }: UpdateStatusModalProps) {
  const transitions = isAdmin
    ? ALL_STATUSES.filter((s) => s !== order.status)
    : VALID_TRANSITIONS[order.status] ?? [];
  const [selected, setSelected] = useState(transitions[0] ?? "");
  const [note, setNote] = useState("");

  const handleSave = async () => {
    if (!selected) return;
    await onUpdate(selected, note);
    setNote("");
  };

  return (
    <FormModal open={open} onClose={onClose} title={`Update Status: ${order.orderNumber}`} onSave={handleSave} saving={saving} size="sm">
      <div className="space-y-4">
        <p className="text-xs text-text-muted">Current status: <span className="font-medium text-text">{order.status}</span></p>
        {isAdmin && <p className="text-xs text-warning">Admin override — you can set any status</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-text">New Status</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
            {transitions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {transitions.length === 0 && <p className="text-xs text-text-muted">No transitions available from current status.</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Note (optional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" rows={3} placeholder="Reason for this update..." />
        </div>
      </div>
    </FormModal>
  );
}
