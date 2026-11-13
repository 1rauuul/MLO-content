"use client";

import { useActionState, useState } from "react";

import { ResultDialog } from "@/app/(panel)/result-dialog";
import { publish, type PublishResult } from "@/lib/actions/publish";

export function SaveCourseForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<PublishResult, FormData>(publish, {});
  const [dismissed, setDismissed] = useState<PublishResult | null>(null);
  const open = Boolean(state.version) && dismissed !== state;

  return (
    <>
      <form action={action}>
        <input type="hidden" name="courseId" value={courseId} />
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </form>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <ResultDialog open={open} title="Curso guardado" onClose={() => setDismissed(state)}>
        Versión {state.version} guardada con {state.lessons}{" "}
        {state.lessons === 1 ? "lección" : "lecciones"}. El contenido ya está disponible
        en MLO.
      </ResultDialog>
    </>
  );
}
