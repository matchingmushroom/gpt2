import { useEffect, type ReactNode } from "react";

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSave?: () => void | Promise<void>;
  saveLabel?: string;
  saving?: boolean;
  error?: string | null;
  size?: "sm" | "md" | "lg";
  showSave?: boolean;
}

const widthMap = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" };

export default function FormModal({
  open,
  onClose,
  title,
  children,
  onSave,
  saveLabel = "Save",
  saving = false,
  error = null,
  size = "md",
  showSave = true,
}: FormModalProps) {
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
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative z-10 w-full ${widthMap[size]} rounded-t-2xl bg-white shadow-xl sm:mx-4 sm:rounded-2xl max-sm:max-h-[90vh] max-sm:overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="font-heading text-base font-semibold text-text sm:text-lg">{title}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-text-muted transition-colors hover:bg-light-gray hover:text-text sm:text-2xl">✕</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto overscroll-contain px-4 py-4 sm:max-h-[70vh] sm:px-6">{children}</div>

        {error && (
          <div className="mx-4 mb-2 rounded-btn bg-error/10 px-4 py-2 text-sm text-error sm:mx-6">{error}</div>
        )}

        <div className="flex justify-end gap-3 border-t border-border px-4 py-3 sm:px-6 sm:py-4">
          <button onClick={onClose} className={`rounded-btn border border-border px-4 py-2.5 text-sm font-medium text-text-light transition-colors hover:border-text-muted ${showSave ? "flex-1 sm:flex-initial" : "w-full"}`}>
            {showSave ? "Cancel" : "Close"}
          </button>
          {showSave && (
            <button
              onClick={onSave}
              disabled={saving}
              className="flex-1 rounded-btn bg-forest-green px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark disabled:opacity-60 sm:flex-initial"
            >
              {saving ? "Saving..." : saveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
