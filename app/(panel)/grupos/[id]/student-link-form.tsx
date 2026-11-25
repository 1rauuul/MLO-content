"use client";

import { useActionState, useState } from "react";

import { ResultDialog } from "@/app/(panel)/result-dialog";
import {
  createStudentLinkCode,
  type StudentLinkResult,
} from "@/lib/actions/classes";

function formatDate(value: string): string {
  return new Date(value).toISOString().slice(0, 16).replace("T", " ");
}

export function StudentLinkForm({
  classId,
  studentId,
  studentName,
}: {
  classId: string;
  studentId: string;
  studentName: string;
}) {
  const [state, action, pending] = useActionState<StudentLinkResult, FormData>(
    createStudentLinkCode,
    {},
  );
  const [dismissed, setDismissed] = useState<StudentLinkResult | null>(null);
  const open = Boolean(state.code) && dismissed !== state;

  return (
    <>
      <form action={action}>
        <input type="hidden" name="classId" value={classId} />
        <input type="hidden" name="studentId" value={studentId} />
        <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
          {pending ? "Generando…" : "Generar código"}
        </button>
      </form>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <ResultDialog
        open={open}
        title="Código de vinculación"
        onClose={() => setDismissed(state)}
      >
        <p>
          Para <span className="text-ink">{studentName}</span>:
        </p>
        <p className="mt-2 font-mono text-2xl tracking-[0.3em] text-ink">
          {state.code}
        </p>
        {state.expiresAt && (
          <p className="mt-2 text-xs">Vence: {formatDate(state.expiresAt)}</p>
        )}
        <p className="mt-2 text-xs">
          Compártelo solo con el alumno; vence en 30 minutos.
        </p>
      </ResultDialog>
    </>
  );
}
