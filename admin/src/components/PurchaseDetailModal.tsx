import FormModal from "./FormModal";
import { useStaff } from "../hooks/useStaff";
import type { Purchase, PaymentRecord } from "../types";

interface Props {
  purchase: Purchase | null;
  onClose: () => void;
}

export default function PurchaseDetailModal({ purchase, onClose }: Props) {
  const { staff } = useStaff();
  const isProductionStaff = staff?.role === "production_staff";

  if (!purchase) return null;

  const totalItems = purchase.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <FormModal
      open={!!purchase}
      onClose={onClose}
      title={`Purchase #${purchase.purchaseNumber}`}
      size="lg"
      showSave={false}
    >
      <div className="space-y-5">
        {/* Supplier info */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-text">{purchase.supplierName}</h3>
            <p className="text-xs text-text-muted">{purchase.supplierPhone}{purchase.supplierAddress ? ` — ${purchase.supplierAddress}` : ""}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            purchase.paymentStatus === "paid" ? "bg-success/10 text-success" :
            purchase.paymentStatus === "partial" ? "bg-warning/10 text-warning" :
            "bg-error/10 text-error"
          }`}>
            {purchase.paymentStatus}
          </span>
        </div>

        {/* Summary cards */}
        <div className={`grid gap-3 ${isProductionStaff ? "grid-cols-1" : "grid-cols-3"}`}>
          {!isProductionStaff && (
            <div className="rounded-card bg-beige/50 p-3 text-center">
              <div className="text-xs text-text-muted">Total</div>
              <div className="font-heading text-lg font-bold text-text">NPR {purchase.grandTotal.toLocaleString()}</div>
            </div>
          )}
          {!isProductionStaff && (
            <div className="rounded-card bg-beige/50 p-3 text-center">
              <div className="text-xs text-text-muted">Paid</div>
              <div className="font-heading text-lg font-bold text-forest-green">NPR {(purchase.cashPaid || 0).toLocaleString()}</div>
            </div>
          )}
          {!isProductionStaff && (
            <div className="rounded-card bg-beige/50 p-3 text-center">
              <div className="text-xs text-text-muted">Due</div>
              <div className={`font-heading text-lg font-bold ${(purchase.due || 0) > 0 ? "text-error" : "text-success"}`}>
                NPR {(purchase.due || 0).toLocaleString()}
              </div>
            </div>
          )}
          {isProductionStaff && (
            <div className="rounded-card bg-beige/50 p-3 text-center">
              <div className="text-xs text-text-muted">Total Items</div>
              <div className="font-heading text-lg font-bold text-text">{totalItems} units</div>
            </div>
          )}
        </div>

        {/* Items table */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-text">Items ({totalItems} total units)</h3>
          <div className="overflow-x-auto rounded-lg border border-border text-sm">
            <table className="w-full">
              <thead className="bg-light-gray text-xs text-text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Material</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit</th>
                  {!isProductionStaff && <th className="px-3 py-2 text-right font-medium">Unit Price</th>}
                  {!isProductionStaff && <th className="px-3 py-2 text-right font-medium">Total</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purchase.items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium text-text">{item.materialName}</td>
                    <td className="px-3 py-2 text-right text-text-light">{item.quantity}</td>
                    <td className="px-3 py-2 text-right text-text-muted">{item.unit}</td>
                    {!isProductionStaff && <td className="px-3 py-2 text-right text-text-light">NPR {item.unitPrice.toLocaleString()}</td>}
                    {!isProductionStaff && <td className="px-3 py-2 text-right font-medium text-forest-green">NPR {item.totalPrice.toLocaleString()}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History */}
        {!isProductionStaff && (purchase.paymentHistory?.length ?? 0) > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-text">Payment History</h3>
            <div className="space-y-1.5">
              {[...purchase.paymentHistory].reverse().map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-btn bg-success/5 px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">{p.receivedAt?.seconds ? new Date(p.receivedAt.seconds * 1000).toLocaleDateString() : "—"}</span>
                    <span className="capitalize text-text-muted">{p.method}</span>
                    {p.note && <span className="text-xs text-text-muted">— {p.note}</span>}
                  </div>
                  <span className="font-semibold text-error">−NPR {p.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bill image & notes */}
        <div className="flex items-start justify-between gap-4">
          {purchase.billImage && (
            <a href={purchase.billImage} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-btn border border-border px-3 py-2 text-xs text-text-light transition-colors hover:border-info hover:text-info">
              🧾 View Bill
            </a>
          )}
          {purchase.notes && <p className="text-xs italic text-text-muted">{purchase.notes}</p>}
        </div>
      </div>
    </FormModal>
  );
}
