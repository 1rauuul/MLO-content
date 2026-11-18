"use client";

import { useEffect, useRef } from "react";

export function ResultDialog({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
  centerTitle = false,
  centered = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  centerTitle?: boolean;
  centered?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} className={wide ? "dialog dialog-wide" : "dialog"}>
      <div className="p-5">
        <h2
          className={`font-semibold text-ink ${centerTitle || centered ? "text-center text-lg" : "text-base"}`}
        >
          {title}
        </h2>
        <div
          className={`mt-2 text-sm leading-relaxed text-ink-muted ${centered ? "text-center" : ""}`}
        >
          {children}
        </div>
        <div
          className={`mt-5 flex flex-wrap items-center gap-2 ${centered ? "justify-center" : "justify-end"}`}
        >
          {footer ?? (
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="btn btn-primary btn-sm"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
