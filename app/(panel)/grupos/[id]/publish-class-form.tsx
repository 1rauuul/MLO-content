"use client";

import { useActionState, useState } from "react";

import { ResultDialog } from "@/app/(panel)/result-dialog";
import { publishClass, type PublishClassResult } from "@/lib/actions/classes";

export function PublishClassForm({
  classId,
  joinCode,
}: {
  classId: string;
  joinCode: string;
}) {
  const [state, action, pending] = useActionState<PublishClassResult, FormData>(
    publishClass,
    {},
  );
  const [dismissed, setDismissed] = useState<PublishClassResult | null>(null);
  const open = Boolean(state.ok) && dismissed !== state;

  return (
    <>
      <form action={action}>
        <input type="hidden" name="classId" value={classId} />
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Publicando…" : "Publicar grupo"}
        </button>
      </form>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <ResultDialog open={open} title="Grupo publicado" onClose={() => setDismissed(state)}>
        Versión {state.version} publicada. El grupo ya está disponible en MLO y los
        alumnos pueden unirse con el código{" "}
        <span className="font-mono text-ink">{joinCode}</span>.
      </ResultDialog>
    </>
  );
}
