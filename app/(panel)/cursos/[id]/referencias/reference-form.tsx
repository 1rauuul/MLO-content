"use client";

import { useActionState, useState } from "react";

import type { CoreReference } from "@/lib/content/model";
import { apa7Text } from "@/lib/content/references";
import { parseReferenceInput } from "@/lib/content/validate";
import { saveReference, type ReferenceResult } from "@/lib/actions/references";

type Draft = {
  authorsText: string;
  year: string;
  title: string;
  source: string;
  edition: string;
  doi: string;
  url: string;
};

function draftFrom(reference?: CoreReference): Draft {
  return reference
    ? {
        authorsText: reference.authors.join("\n"),
        year: reference.year === null ? "" : String(reference.year),
        title: reference.title,
        source: reference.source,
        edition: reference.edition,
        doi: reference.doi,
        url: reference.url,
      }
    : {
        authorsText: "",
        year: "",
        title: "",
        source: "",
        edition: "",
        doi: "",
        url: "",
      };
}

export function ReferenceForm({
  courseId,
  reference,
}: {
  courseId: string;
  reference?: CoreReference;
}) {
  const [draft, setDraft] = useState<Draft>(draftFrom(reference));
  const [state, action, pending] = useActionState<ReferenceResult, FormData>(
    saveReference,
    {},
  );
  const patch = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values }));

  const data = {
    authors: draft.authorsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    year: draft.year.trim() === "" ? null : Number(draft.year),
    title: draft.title,
    source: draft.source,
    edition: draft.edition,
    doi: draft.doi,
    url: draft.url,
  };
  const validation = parseReferenceInput(data);
  const preview = "value" in validation
    ? apa7Text({ content_id: reference?.content_id ?? "ref", ...validation.value })
    : null;

  const errorId = `reference-form-error-${reference?.content_id ?? "new"}`;

  return (
    <form action={action} className="card space-y-4 border-line-strong p-5">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="referenceId" value={reference?.content_id ?? ""} />
      <input type="hidden" name="data" value={JSON.stringify(data)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label sm:col-span-2">
          Autores (uno por línea, «Apellido, N.»)
          <textarea
            value={draft.authorsText}
            onChange={(event) => patch({ authorsText: event.target.value })}
            rows={3}
            className="field font-mono text-xs"
          />
        </label>
        <label className="field-label">
          Año (vacío = s. f.)
          <input
            type="number"
            min={1000}
            max={2999}
            value={draft.year}
            onChange={(event) => patch({ year: event.target.value })}
            className="field"
          />
        </label>
        <label className="field-label">
          Edición
          <input
            value={draft.edition}
            onChange={(event) => patch({ edition: event.target.value })}
            placeholder="10.ª ed."
            className="field"
          />
        </label>
        <label className="field-label sm:col-span-2">
          Título
          <input
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? errorId : undefined}
            className="field"
          />
        </label>
        <label className="field-label sm:col-span-2">
          Fuente
          <input
            value={draft.source}
            onChange={(event) => patch({ source: event.target.value })}
            placeholder="Editorial, revista o sitio"
            className="field"
          />
        </label>
        <label className="field-label">
          DOI
          <input
            value={draft.doi}
            onChange={(event) => patch({ doi: event.target.value })}
            placeholder="10.1000/182"
            className="field font-mono text-xs"
          />
        </label>
        <label className="field-label">
          URL
          <input
            value={draft.url}
            onChange={(event) => patch({ url: event.target.value })}
            placeholder="https://…"
            className="field font-mono text-xs"
          />
        </label>
      </div>

      <div className="rounded-lg bg-surface-soft p-3 text-sm text-ink-soft ring-1 ring-line">
        <p className="eyebrow mb-1">Vista APA 7</p>
        {preview ? preview : <span className="text-ink-muted">Completa los datos para ver el texto.</span>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Guardando…" : reference ? "Guardar referencia" : "Agregar referencia"}
        </button>
        {state.error && <p id={errorId} className="form-error" role="alert">{state.error}</p>}
        {state.ok && <p className="form-ok" role="status">Referencia guardada.</p>}
      </div>
    </form>
  );
}
