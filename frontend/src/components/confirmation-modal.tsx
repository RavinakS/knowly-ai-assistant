"use client";

import { useEffect, type ReactNode } from "react";

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isConfirming,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!open || isConfirming) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isConfirming, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isConfirming) {
          onCancel();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-model-title"
        aria-describedby="confirmation-model-description"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="confirmation-model-title" className="text-lg font-semibold">
          {title}
        </h2>

        <div
          id="confirmation-modal-description"
          className="mt-3 text-sm leading-6 text-[#64705f]"
        >
          {description}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            autoFocus
            disabled={isConfirming}
            onClick={onCancel}
            className="rounded-lg border border-[#dfe3da] px-4 py-2 text-sm font-medium text-[#354d3e] disabled:opacity-50"
          >
            {cancelLabel || "Cancel"}
          </button>

          <button
            type="button"
            disabled={isConfirming}
            onClick={onConfirm}
            className="rounded-lg bg-[#9d4237] px-4 py-2 text-sm font-medium text-white hover:bg-[#85382f] disabled:cursor-wait disabled:opacity-60"
          >
            {isConfirming ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
