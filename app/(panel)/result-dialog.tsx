"use client";

import { useEffect, useRef } from "react";

export function ResultDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} className="dialog">
      <div className="p-5">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="btn btn-primary btn-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </dialog>
  );
}
