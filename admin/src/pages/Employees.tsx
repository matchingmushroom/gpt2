import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import type { Employee } from "../types";

export default function EmployeesPage() {
  const { staff, can } = useStaff();
  const { data: employees, loading } = useCollection<Employee>("employees");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDesignation, setFormDesignation] = useState("");
  const [formSalary, setFormSalary] = useState(0);
  const [formTax, setFormTax] = useState(1);
  const [formPf, setFormPf] = useState(0);
  const [formBank, setFormBank] = useState("");
  const [formAccount, setFormAccount] = useState("");
  const [formJoined, setFormJoined] = useState(new Date().toISOString().split("T")[0]);

  const handleAdd = () => {
    setEditing(null);
    setFormName(""); setFormCode(""); setFormPhone(""); setFormEmail(""); setFormDesignation("");
    setFormSalary(0); setFormTax(1); setFormPf(0); setFormBank(""); setFormAccount("");
    setFormJoined(new Date().toISOString().split("T")[0]);
    setError(null);
    setModalOpen(true);
  };

  const handleEdit = (e: Employee) => {
    setEditing(e);
    setFormName(e.name); setFormCode(e.code); setFormPhone(e.phone); setFormEmail(e.email);
    setFormDesignation(e.designation); setFormSalary(e.baseSalary); setFormTax(e.taxPercent);
    setFormPf(e.pfPercent); setFormBank(e.bankName); setFormAccount(e.bankAccount);
    setFormJoined(new Date(e.joinedAt.seconds * 1000).toISOString().split("T")[0]);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!staff || !can("employees.write")) return;
    if (!formName.trim()) { setError("Name required"); return; }
    setSaving(true); setError(null);
    try {
      const code = editing ? formCode : `EMP-${employees.length + 1}`.padStart(8, "0");
      const data = {
        name: formName.trim(), code, phone: formPhone.trim(), email: formEmail.trim(),
        designation: formDesignation.trim(), baseSalary: formSalary,
        taxPercent: formTax, pfPercent: formPf,
        bankName: formBank.trim(), bankAccount: formAccount.trim(),
        joinedAt: new Date(formJoined), isActive: true,
      };
      if (editing) {
        await setDocument(`employees/${editing.id}`, data);
        logActivity({ action: "Updated employee", details: `Updated employee '${formName}'`, module: "Finance", staffId: staff.id, staffName: staff.name });
      } else {
        const id = await addDocument("employees", data);
        logActivity({ action: "Created employee", details: `Added employee '${formName}' (${code})`, module: "Finance", staffId: staff.id, staffName: staff.name, relatedDocId: id });
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Employees</h1>
            <p className="text-sm text-text-light">{employees.length} employees registered</p>
          </div>
          {can("employees.write") && (
            <button onClick={handleAdd} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white">+ Add Employee</button>
          )}
        </div>
        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={[
            { key: "code", header: "Code", render: (e: Employee) => <span className="font-mono text-xs text-text">{e.code}</span> },
            { key: "name", header: "Name", render: (e: Employee) => <span className="font-medium text-text">{e.name}</span>, sortable: true },
            { key: "designation", header: "Designation", render: (e: Employee) => <span className="text-text-light">{e.designation}</span> },
            { key: "salary", header: "Salary", render: (e: Employee) => <span className="font-medium text-forest-green">NPR {e.baseSalary.toLocaleString()}</span> },
            { key: "status", header: "Status", render: (e: Employee) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.isActive ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>{e.isActive ? "Active" : "Inactive"}</span>
            )},
            { key: "actions", header: "", render: (e: Employee) => can("employees.write") ? (
              <button onClick={(ev) => { ev.stopPropagation(); handleEdit(e); }} className="text-xs text-info">Edit</button>
            ) : null, width: "60px" },
          ]}
          data={employees}
          onRowClick={setSelectedEmployee}
          keyExtractor={(e) => e.id}
          loading={loading}
          emptyMessage="No employees registered"
          emptyIcon="👥"
        />

        {selectedEmployee && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setSelectedEmployee(null)}>
            <div className="mx-4 w-full max-w-md rounded-card bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-text">{selectedEmployee.name}</h2>
                <button onClick={() => setSelectedEmployee(null)} className="text-xl text-text-light">&times;</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-text-light">Code</span><span className="font-mono font-medium text-text">{selectedEmployee.code}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Designation</span><span className="text-text">{selectedEmployee.designation}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Status</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${selectedEmployee.isActive ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                    {selectedEmployee.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="border-t border-border" />
                <div className="flex justify-between"><span className="text-text-light">Phone</span><span className="text-text">{selectedEmployee.phone || "—"}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Email</span><span className="text-text">{selectedEmployee.email || "—"}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Base Salary</span><span className="font-medium text-forest-green">NPR {selectedEmployee.baseSalary.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Tax %</span><span className="text-text">{selectedEmployee.taxPercent}%</span></div>
                <div className="flex justify-between"><span className="text-text-light">PF %</span><span className="text-text">{selectedEmployee.pfPercent}%</span></div>
                {selectedEmployee.bankName && <div className="border-t border-border" />}
                {selectedEmployee.bankName && <div className="flex justify-between"><span className="text-text-light">Bank</span><span className="text-text">{selectedEmployee.bankName}</span></div>}
                {selectedEmployee.bankAccount && <div className="flex justify-between"><span className="text-text-light">Account #</span><span className="font-mono text-text">{selectedEmployee.bankAccount}</span></div>}
              </div>
            </div>
          </div>
        )}

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Employee" : "Add Employee"} onSave={handleSave} saving={saving} size="lg">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Name *</label><input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Designation</label><input value={formDesignation} onChange={(e) => setFormDesignation(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Phone</label><input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Email</label><input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} type="email" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Base Salary (NPR)</label><input value={formSalary || ""} onChange={(e) => setFormSalary(Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Join Date</label><input value={formJoined} onChange={(e) => setFormJoined(e.target.value)} type="date" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Tax (%)</label><input value={formTax} onChange={(e) => setFormTax(Number(e.target.value) || 0)} type="number" step="0.1" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">PF (%)</label><input value={formPf} onChange={(e) => setFormPf(Number(e.target.value) || 0)} type="number" step="0.1" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            </div>
            <div className="border-t border-border pt-3">
              <h3 className="mb-2 text-sm font-semibold text-text">Bank Details</h3>
              <div className="flex gap-4">
                <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Bank Name</label><input value={formBank} onChange={(e) => setFormBank(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
                <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Account Number</label><input value={formAccount} onChange={(e) => setFormAccount(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              </div>
            </div>
          </div>
        </FormModal>
      </div>
    </AdminLayout>
  );
}
