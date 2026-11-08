"use client";

import { useActionState, useEffect, useState } from "react";

import type { CoreExample, ExerciseConfig, ExerciseStep, ExerciseType } from "@/lib/content/model";
import { parseExampleInput } from "@/lib/content/validate";
import { saveExample, type EditorResult } from "@/lib/actions/exercises";
import { PreviewFrame } from "@/app/(panel)/preview-frame";

import { EntriesEditor, Field, PairsEditor, StepsEditor, TextList, fieldClass } from "./fields";
import { ExamplePreview } from "./preview";

export type ExampleDraft = {
  type: ExerciseType;
  title: string;
  prompt: string;
  config: ExerciseConfig;
  steps: ExerciseStep[];
  hints: string[];
  explanation: string;
};

function emptyConfig(type: ExerciseType): ExerciseConfig {
  if (type === "fill") return { sentences: [""], bank: [] };
  if (type === "match") return { pairs: [{ left: "", right: "" }] };
  if (type === "crossword") {
    return {
      crossword: {
        rows: 8,
        cols: 8,
        entries: [{ word: "", clue: "", row: 0, col: 0, direction: "across" }],
      },
      bank: [],
    };
  }
  return {};
}

function emptyDraft(): ExampleDraft {
  return {
    type: "match",
    title: "",
    prompt: "",
    config: emptyConfig("match"),
    steps: [{ text: "", why: "" }],
    hints: [],
    explanation: "",
  };
}

function draftFrom(item: CoreExample): ExampleDraft {
  return {
    type: item.type,
    title: item.title,
    prompt: item.prompt,
    config: item.config ?? emptyConfig(item.type),
    steps: item.steps,
    hints: item.hints,
    explanation: item.explanation,
  };
}

export function ExampleForm({
  lessonId,
  initial,
  onSaved,
  onCancel,
  onDraftChange,
  showPreview = true,
  formId,
  flush = false,
}: {
  lessonId: string;
  initial?: CoreExample;
  onSaved: () => void;
  onCancel: () => void;
  onDraftChange?: (draft: ExampleDraft) => void;
  showPreview?: boolean;
  formId?: string;
  flush?: boolean;
}) {
  const [draft, setDraft] = useState<ExampleDraft>(initial ? draftFrom(initial) : emptyDraft());
  const [state, action, pending] = useActionState<EditorResult, FormData>(saveExample, {});

  useEffect(() => {
    if (state.ok) onSaved();
  }, [state.ok, onSaved]);

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  const patch = (values: Partial<ExampleDraft>) =>
    setDraft((current) => ({ ...current, ...values }));

  const changeType = (type: ExerciseType) =>
    patch({ type, config: emptyConfig(type) });

  const validation = parseExampleInput(
    {
      type: draft.type,
      title: draft.title,
      prompt: draft.prompt,
      config: draft.config,
      steps: draft.steps,
      hints: draft.hints,
      explanation: draft.explanation,
    },
    { normalize: true },
  );
  const previewError = "error" in validation ? validation.error : null;

  return (
    <form
      id={formId}
      action={action}
      className={flush ? "space-y-5" : "card space-y-5 border-line-strong p-5"}
    >
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="exampleId" value={initial?.content_id ?? ""} />
      <input type="hidden" name="data" value={JSON.stringify(draft)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <select
            value={draft.type}
            onChange={(event) => changeType(event.target.value as ExerciseType)}
            className={fieldClass}
          >
            {/* Ordenar necesita correctOrder y el contrato de ejemplos no lo tiene. */}
            <option value="fill">Completar</option>
            <option value="match">Relacionar</option>
            <option value="crossword">Crucigrama</option>
          </select>
        </Field>

        <Field label="Título">
          <input
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
            className={fieldClass}
          />
        </Field>

        <Field label="Enunciado">
          <input
            value={draft.prompt}
            onChange={(event) => patch({ prompt: event.target.value })}
            className={fieldClass}
          />
        </Field>

        <Field label="Explicación" hint="Opcional; se muestra al terminar.">
          <input
            value={draft.explanation}
            onChange={(event) => patch({ explanation: event.target.value })}
            className={fieldClass}
          />
        </Field>
      </div>

      {draft.type === "fill" && (
        <div className="space-y-4">
          <TextList
            label="Oraciones"
            values={draft.config.sentences ?? []}
            onChange={(sentences) => patch({ config: { ...draft.config, sentences } })}
            placeholder="El {{software}} se mantiene."
            hint="Cada espacio va entre dobles llaves: {{palabra}}."
          />
          <TextList
            label="Palabras extra (distractores)"
            values={draft.config.bank ?? []}
            onChange={(bank) => patch({ config: { ...draft.config, bank } })}
            placeholder="Distractor"
            hint="Las respuestas se extraen de las oraciones; aquí van solo las palabras de más."
          />
        </div>
      )}

      {draft.type === "match" && (
        <PairsEditor
          pairs={draft.config.pairs ?? []}
          onChange={(pairs) => patch({ config: { ...draft.config, pairs } })}
        />
      )}

      {draft.type === "crossword" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Filas">
              <input
                type="number"
                min={1}
                value={draft.config.crossword?.rows ?? 8}
                onChange={(event) =>
                  patch({
                    config: {
                      ...draft.config,
                      crossword: {
                        rows: Number(event.target.value),
                        cols: draft.config.crossword?.cols ?? 8,
                        entries: draft.config.crossword?.entries ?? [],
                      },
                    },
                  })
                }
                className={fieldClass}
              />
            </Field>
            <Field label="Columnas">
              <input
                type="number"
                min={1}
                value={draft.config.crossword?.cols ?? 8}
                onChange={(event) =>
                  patch({
                    config: {
                      ...draft.config,
                      crossword: {
                        rows: draft.config.crossword?.rows ?? 8,
                        cols: Number(event.target.value),
                        entries: draft.config.crossword?.entries ?? [],
                      },
                    },
                  })
                }
                className={fieldClass}
              />
            </Field>
          </div>
          <EntriesEditor
            entries={draft.config.crossword?.entries ?? []}
            onChange={(entries) =>
              patch({
                config: {
                  ...draft.config,
                  crossword: {
                    rows: draft.config.crossword?.rows ?? 8,
                    cols: draft.config.crossword?.cols ?? 8,
                    entries,
                  },
                },
              })
            }
          />
          <TextList
            label="Palabras extra (distractores)"
            values={draft.config.bank ?? []}
            onChange={(bank) => patch({ config: { ...draft.config, bank } })}
            placeholder="PALABRA"
          />
        </div>
      )}

      <StepsEditor steps={draft.steps} onChange={(steps) => patch({ steps })} />

      <TextList
        label="Pistas"
        values={draft.hints}
        onChange={(hints) => patch({ hints })}
        placeholder="Pista"
        hint="Opcional; pueden quedar vacías."
      />

      {!showPreview && previewError && (
        <p className="form-error" role="alert">
          {previewError}
        </p>
      )}

      {showPreview && (
        <div className="space-y-2">
          <PreviewFrame label="MLO · Ejemplo">
            <ExamplePreview
              key={`${draft.type}-${JSON.stringify(draft.config)}`}
              type={draft.type}
              title={draft.title}
              prompt={draft.prompt}
              config={draft.config}
              steps={draft.steps}
              hints={draft.hints}
              explanation={draft.explanation}
              error={previewError}
            />
          </PreviewFrame>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Guardando…" : initial ? "Guardar cambios" : "Crear ejemplo"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancelar
        </button>
        {state.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
