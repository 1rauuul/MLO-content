"use client";

import { useActionState, useEffect, useState } from "react";

import type { CoreExample, ExerciseConfig, ExerciseStep, ExerciseType } from "@/lib/content/model";
import { parseExampleInput, parseExerciseInput } from "@/lib/content/validate";
import { saveExample, type EditorResult } from "@/lib/actions/exercises";
import { PreviewFrame } from "@/app/(panel)/preview-frame";

import { EntriesEditor, Field, PairsEditor, StepsEditor, TextList, fieldClass } from "./fields";
import { ExamplePreview } from "./preview";

export type ExampleDraft = {
  type: ExerciseType;
  title: string;
  prompt: string;
  correctOrder: string[];
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
    correctOrder: [],
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
    correctOrder: [],
    config: item.config ?? emptyConfig(item.type),
    steps: item.steps,
    hints: item.hints,
    explanation: item.explanation,
  };
}

export function ExampleForm({
  lessonId,
  courseId,
  topicId,
  initial,
  onSaved,
  onCancel,
  onDraftChange,
  showPreview = true,
  formId,
  flush = false,
}: {
  lessonId?: string;
  courseId?: string;
  topicId?: string;
  initial?: CoreExample;
  onSaved: () => void;
  onCancel: () => void;
  onDraftChange?: (draft: ExampleDraft) => void;
  showPreview?: boolean;
  formId?: string;
  flush?: boolean;
}) {
  const [draft, setDraft] = useState<ExampleDraft>(initial ? draftFrom(initial) : emptyDraft());
  const [alsoExercise, setAlsoExercise] = useState(false);
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
    patch({ type, config: emptyConfig(type), correctOrder: type === "order" ? ["", ""] : [] });

  const validation =
    draft.type === "order"
      ? parseExerciseInput(
          {
            type: draft.type,
            prompt: draft.prompt,
            instructions: "",
            correctOrder: draft.correctOrder,
            config: draft.config,
            explanation: draft.explanation,
            example: { title: draft.title, steps: draft.steps, hints: draft.hints },
          },
          { normalize: true },
        )
      : parseExampleInput(
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
      {lessonId && <input type="hidden" name="lessonId" value={lessonId} />}
      {courseId && <input type="hidden" name="courseId" value={courseId} />}
      {topicId && <input type="hidden" name="topicId" value={topicId} />}
      <input type="hidden" name="exampleId" value={initial?.content_id ?? ""} />
      <input type="hidden" name="alsoExercise" value={alsoExercise ? "on" : ""} />
      <input type="hidden" name="data" value={JSON.stringify(draft)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <select
            value={draft.type}
            onChange={(event) => changeType(event.target.value as ExerciseType)}
            className={fieldClass}
          >
            <option value="order">Ordenar</option>
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

      {draft.type === "order" && (
        <TextList
          label="Secuencia resuelta"
          values={draft.correctOrder}
          onChange={(correctOrder) => patch({ correctOrder })}
          placeholder="Elemento en orden"
          hint="Un ejemplo de ordenar se publica también como ejercicio con su resolución guiada."
        />
      )}

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

      {!initial && (
        <fieldset className="space-y-2 rounded-xl border border-line bg-surface-soft p-4">
          <legend className="px-1 text-sm font-medium text-ink">Publicación</legend>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="radio"
              checked={!alsoExercise}
              onChange={() => setAlsoExercise(false)}
              disabled={draft.type === "order"}
              className="mt-0.5 size-4"
            />
            <span>
              <strong className="text-ink">Solo como ejemplo</strong>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {draft.type === "order"
                  ? "Ordenar necesita una actividad interactiva; elige la siguiente opción."
                  : "Publica una demostración guiada en la sección de ejemplos."}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="radio"
              checked={alsoExercise || draft.type === "order"}
              onChange={() => setAlsoExercise(true)}
              className="mt-0.5 size-4"
            />
            <span>
              <strong className="text-ink">Como ejemplo y ejercicio</strong>
              <span className="mt-0.5 block text-xs text-ink-muted">
                Publica la actividad para practicar y también su explicación guiada.
              </span>
            </span>
          </label>
        </fieldset>
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
              correctOrder={draft.correctOrder}
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
