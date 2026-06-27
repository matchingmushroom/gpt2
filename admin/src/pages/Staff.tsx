import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import ConfirmDialog from "../components/ConfirmDialog";
import DataTable from "../components/DataTable";
import PermissionMatrix from "../components/PermissionMatrix";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument, removeDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import type { Staff, StaffRole, StaffPermissions } from "../types";

const FINANCE_TRUE = {
  accounts: { read: true, write: true },
  journal: { read: true, write: true },
  ledger: { read: true },
  fixedAssets: { read: true, write: true },
  employees: { read: true, write: true },
  payroll: { read: true, write: true },
  dailyRegister: { read: true, write: true },
};

const FINANCE_FALSE = {
  accounts: { read: false, write: false },
  journal: { read: false, write: false },
  ledger: { read: false } as { read: boolean },
  fixedAssets: { read: false, write: false },
  employees: { read: false, write: false },
  payroll: { read: false, write: false },
  dailyRegister: { read: false, write: false },
};

const ROLE_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  super_admin: {
    products: { read: true, write: true }, categories: { read: true, write: true },
    orders: { read: true, write: true, delete: true }, batches: { read: true, write: true },
    purchases: { read: true, write: true }, suppliers: { read: true, write: true }, expenses: { read: true, write: true },
    staff: { read: true, write: true }, coupons: { read: true, write: true },
    debtors: { read: true, write: true }, creditors: { read: true, write: true },
    reports: { read: true, write: true }, settings: { read: true, write: true },
    logs: { read: true },
    ...FINANCE_TRUE,
  },
  manager: {
    products: { read: true, write: true }, categories: { read: true, write: true },
    orders: { read: true, write: true, delete: false }, batches: { read: true, write: true },
    purchases: { read: true, write: true }, suppliers: { read: true, write: true }, expenses: { read: true, write: true },
    staff: { read: true, write: false }, coupons: { read: true, write: true },
    debtors: { read: true, write: true }, creditors: { read: true, write: true },
    reports: { read: true, write: true }, settings: { read: true, write: false },
    logs: { read: true },
    ...FINANCE_TRUE,
  },
  accountant: {
    products: { read: false, write: false }, categories: { read: false, write: false },
    orders: { read: true, write: false, delete: false }, batches: { read: false, write: false },
    purchases: { read: false, write: false }, suppliers: { read: false, write: false },
    expenses: { read: true, write: true },
    staff: { read: false, write: false }, coupons: { read: false, write: false },
    debtors: { read: true, write: true }, creditors: { read: true, write: true },
    reports: { read: true, write: true }, settings: { read: false, write: false },
    logs: { read: true },
    ...FINANCE_TRUE,
  },
  production_staff: {
    products: { read: true, write: false }, categories: { read: true, write: false },
    orders: { read: true, write: false, delete: false }, batches: { read: true, write: true },
    purchases: { read: true, write: true }, suppliers: { read: true, write: false }, expenses: { read: true, write: false },
    staff: { read: false, write: false }, coupons: { read: false, write: false },
    debtors: { read: false, write: false }, creditors: { read: false, write: false },
    reports: { read: false, write: false }, settings: { read: false, write: false },
    logs: { read: false },
    ...FINANCE_FALSE,
  },
  sales_staff: {
    products: { read: true, write: false }, categories: { read: true, write: false },
    orders: { read: true, write: true, delete: false }, batches: { read: false, write: false },
    purchases: { read: false, write: false }, suppliers: { read: false, write: false }, expenses: { read: false, write: false },
    staff: { read: false, write: false }, coupons: { read: true, write: true },
    debtors: { read: true, write: true }, creditors: { read: false, write: false },
    reports: { read: true, write: false }, settings: { read: false, write: false },
    logs: { read: false },
    ...FINANCE_FALSE,
  },
  staff: {
    products: { read: true, write: false }, categories: { read: true, write: false },
    orders: { read: true, write: true, delete: false }, batches: { read: true, write: false },
    purchases: { read: true, write: false }, suppliers: { read: true, write: false }, expenses: { read: true, write: true },
    staff: { read: false, write: false }, coupons: { read: true, write: false },
    debtors: { read: true, write: true }, creditors: { read: true, write: false },
    reports: { read: true, write: false }, settings: { read: false, write: false },
    logs: { read: false },
    ...FINANCE_FALSE,
  },
  viewer: {
    products: { read: true, write: false }, categories: { read: true, write: false },
    orders: { read: true, write: false, delete: false }, batches: { read: true, write: false },
    purchases: { read: true, write: false }, suppliers: { read: true, write: false }, expenses: { read: true, write: false },
    staff: { read: true, write: false }, coupons: { read: true, write: false },
    debtors: { read: true, write: false }, creditors: { read: true, write: false },
    reports: { read: true, write: false }, settings: { read: true, write: false },
    logs: { read: true },
    ...FINANCE_FALSE,
  },
};

export default function StaffPage() {
  const { staff: me, can } = useStaff();
  const { data: staffList, loading } = useCollection<Staff>("staff");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<StaffRole>("staff");
  const [formPermissions, setFormPermissions] = useState<StaffPermissions>(ROLE_PERMISSIONS.staff);

  const handleOpenNew = () => {
    setEditing(null);
    setFormName(""); setFormEmail(""); setFormPhone(""); setFormRole("staff");
    setFormPermissions({ ...ROLE_PERMISSIONS.staff });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (s: Staff) => {
    setEditing(s);
    setFormName(s.name); setFormEmail(s.email); setFormPhone(s.phone);
    setFormRole(s.role); setFormPermissions({ ...s.permissions });
    setError(null);
    setModalOpen(true);
  };

  const handleRoleChange = (role: StaffRole) => {
    setFormRole(role);
    setFormPermissions({ ...ROLE_PERMISSIONS[role] });
  };

  const handleSave = async () => {
    if (!me || !can("staff.write")) return;
    if (!formName.trim() || !formEmail.trim()) { setError("Name and email required"); return; }
    const cleanPhone = formPhone.replace(/\D/g, "");
    if (cleanPhone.length > 0 && cleanPhone.length !== 10) { setError("Phone must be exactly 10 digits"); return; }
    setSaving(true);
    setError(null);
    try {
      const data = { name: formName.trim(), email: formEmail.trim(), phone: formPhone.trim(), role: formRole, permissions: formPermissions, isActive: true };
      if (editing) {
        await setDocument(`staff/${editing.id}`, data);
        logActivity({ action: "Updated staff", details: `Updated staff '${formName}'`, module: "Staff", staffId: me.id, staffName: me.name, relatedDocId: editing.id });
      } else {
        const id = await addDocument("staff", { ...data, uid: "" });
        logActivity({ action: "Created staff", details: `Created staff '${formName}' as ${formRole}`, module: "Staff", staffId: me.id, staffName: me.name, relatedDocId: id });
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !me) return;
    setSaving(true);
    try {
      await removeDocument(`staff/${deleteTarget.id}`);
      logActivity({ action: "Deleted staff", details: `Deleted staff '${deleteTarget.name}'`, module: "Staff", staffId: me.id, staffName: me.name });
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Staff Management</h1>
            <p className="text-sm text-text-light">Manage team members and permissions</p>
          </div>
          {can("staff.write") && (
            <button onClick={handleOpenNew} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark">+ Invite Staff</button>
          )}
        </div>

        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={[
            { key: "name", header: "Name", render: (s: Staff) => <span className="font-medium text-text">{s.name}</span>, sortable: true },
            { key: "email", header: "Email", render: (s: Staff) => <span className="text-text-light">{s.email}</span> },
            { key: "role", header: "Role", render: (s: Staff) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                s.role === "super_admin" ? "bg-chili-red/10 text-chili-red" :
                s.role === "manager" ? "bg-info/10 text-info" :
                s.role === "accountant" ? "bg-teal-100 text-teal-700" :
                s.role === "production_staff" ? "bg-mustard-gold/10 text-mustard-gold" :
                s.role === "sales_staff" ? "bg-purple-100 text-purple-700" :
                s.role === "staff" ? "bg-forest-green/10 text-forest-green" : "bg-text-muted/10 text-text-muted"
              }`}>{s.role.replace(/_/g, " ")}</span>
            )},
            { key: "status", header: "Status", render: (s: Staff) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.isActive ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                {s.isActive ? "Active" : "Inactive"}
              </span>
            )},
            { key: "actions", header: "", render: (s: Staff) => (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {can("staff.write") && <button onClick={() => handleOpenEdit(s)} className="text-xs text-info">Edit</button>}
                {can("staff.write") && s.role !== "super_admin" && <button onClick={() => setDeleteTarget(s)} className="text-xs text-error">Delete</button>}
              </div>
            ), width: "80px" },
          ]}
          data={staffList}
          keyExtractor={(s) => s.id}
          searchFields={["name", "email"]}
          loading={loading}
          emptyMessage="No staff yet"
          emptyIcon="👥"
        />

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Staff" : "Invite Staff"} onSave={handleSave} saving={saving} error={error} size="lg">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Name *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Email *</label>
              <input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} type="email" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Phone (10 digits)</label>
              <input value={formPhone} onChange={(e) => setFormPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Role</label>
              <select value={formRole} onChange={(e) => handleRoleChange(e.target.value as StaffRole)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
                <option value="super_admin">Super Admin</option>
                <option value="manager">Manager</option>
                <option value="accountant">Accountant</option>
                <option value="production_staff">Production Staff</option>
                <option value="sales_staff">Sales Staff</option>
                <option value="staff">Staff</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-text">Permissions</label>
              <PermissionMatrix permissions={formPermissions} onChange={setFormPermissions} readonly={formRole === "super_admin"} />
            </div>
          </div>
        </FormModal>

        <ConfirmDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Remove Staff"
          message={`Remove '${deleteTarget?.name}' from the system? They will lose all access.`}
          confirmLabel="Remove"
          variant="danger"
          loading={saving}
        />
      </div>
    </AdminLayout>
  );
}
