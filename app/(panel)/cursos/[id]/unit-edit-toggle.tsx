"use client";

import { useState } from "react";

import { UnitEditForm } from "./unit-edit-form";

export function UnitEditToggle({
  courseId,
  unit,
}: {
  courseId: string;
  unit: { id: string; title: string; description: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {unit.description && (
          <p className="text-sm text-ink-muted">{unit.description}</p>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
        >
          Editar
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <UnitEditForm courseId={courseId} unit={unit} />
        </div>
      )}
    </div>
  );
}
