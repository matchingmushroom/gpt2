import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
}

const variantStyles = {
  danger: "bg-chili-red hover:bg-chili-red-dark",
  warning: "bg-mustard-gold hover:bg-mustard-gold-light text-black",
  info: "bg-forest-green hover:bg-forest-green-dark",
};

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-card bg-white p-6 shadow-xl">
        <h3 className="font-heading text-lg font-semibold text-text">{title}</h3>
        <p className="mt-2 text-sm text-text-light">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="rounded-btn border border-border px-4 py-2 text-sm font-medium text-text-light transition-colors hover:border-text-muted">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className={`rounded-btn px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 ${variantStyles[variant]}`}>
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
