import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  const confirmColors = {
    danger: "bg-red-600 hover:bg-red-700",
    warning: "bg-amber-600 hover:bg-amber-700",
    default: "bg-violet-600 hover:bg-violet-700",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-md rounded-xl border border-white/[0.08] bg-gray-900 p-6 shadow-2xl"
      >
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-500 hover:bg-white/[0.04] hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          {variant !== "default" && (
            <div
              className={cn(
                "mt-0.5 rounded-lg p-2",
                variant === "danger" ? "bg-red-500/10" : "bg-amber-500/10"
              )}
            >
              <AlertTriangle
                className={cn(
                  "h-5 w-5",
                  variant === "danger" ? "text-red-400" : "text-amber-400"
                )}
              />
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-100">{title}</h3>
            <p className="mt-2 text-sm text-gray-400">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium text-white",
              confirmColors[variant]
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
