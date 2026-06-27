import { useState } from "react";
import type { Supplier } from "../types";

interface SupplierFormProps {
  initial?: Partial<Supplier>;
  onSave: (data: Partial<Supplier>) => void;
  saving?: boolean;
}

export default function SupplierForm({ initial, onSave, saving }: SupplierFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [panNumber, setPanNumber] = useState(initial?.panNumber ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      panNumber: panNumber.trim(),
      notes: notes.trim(),
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Supplier Name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" required />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-text">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-text">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Address</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">PAN Number</label>
        <input value={panNumber} onChange={(e) => setPanNumber(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" rows={2} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-forest-green" />
        Active
      </label>
      <div className="flex justify-end border-t border-border pt-4">
        <button type="submit" disabled={saving || !name.trim()} className="rounded-btn bg-forest-green px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark disabled:opacity-60">
          {saving ? "Saving..." : initial ? "Update Supplier" : "Add Supplier"}
        </button>
      </div>
    </form>
  );
}
