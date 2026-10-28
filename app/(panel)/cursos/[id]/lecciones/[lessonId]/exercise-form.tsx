"use client";

import { useActionState, useEffect, useState } from "react";

import type {
  CoreExercise,
  ExerciseConfig,
  ExerciseExample,
  ExerciseType,
} from "@/lib/content/model";
import { saveExercise, type EditorResult } from "@/lib/actions/exercises";

import { EntriesEditor, Field, PairsEditor, StepsEditor, TextList, fieldClass } from "./fields";
import { ExercisePreview } from "./preview";

type Draft = {
  type: ExerciseType;
  prompt: string;
  instructions: string;
  correctOrder: string[];
  config: ExerciseConfig;
  explanation: string;
  example: ExerciseExample | null;
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

function emptyDraft(): Draft {
  return {
    type: "order",
    prompt: "",
    instructions: "",
    correctOrder: ["", ""],
    config: {},
    explanation: "",
    example: null,
  };
}

function draftFrom(item: CoreExercise): Draft {
  return {
    type: item.type,
    prompt: item.prompt,
    instructions: item.instructions,
    correctOrder: item.correct_order ?? [],
    config: item.config ?? emptyConfig(item.type),
    explanation: item.explanation,
    example: item.example,
  };
}

export function ExerciseForm({
  lessonId,
  initial,
  onSaved,
  onCancel,
}: {
  lessonId: string;
  initial?: CoreExercise;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial ? draftFrom(initial) : emptyDraft());
  const [state, action, pending] = useActionState<EditorResult, FormData>(saveExercise, {});

  useEffect(() => {
    if (state.ok) onSaved();
  }, [state.ok, onSaved]);

  const patch = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values }));

  const changeType = (type: ExerciseType) =>
    patch({
      type,
      config: emptyConfig(type),
      correctOrder: type === "order" ? ["", ""] : [],
    });

  const setExample = (enabled: boolean) =>
    patch({
      example: enabled
        ? draft.example ?? { title: "", steps: [{ text: "", why: "" }], hints: [] }
        : null,
    });

  return (
    <form action={action} className="space-y-5 rounded-xl border border-zinc-300 bg-white p-5">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="exerciseId" value={initial?.content_id ?? ""} />
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

        <Field label="Enunciado">
          <input
            value={draft.prompt}
            onChange={(event) => patch({ prompt: event.target.value })}
            className={fieldClass}
          />
        </Field>

        <Field label="Instrucciones" hint="Opcional; MLO muestra este texto bajo el enunciado.">
          <input
            value={draft.instructions}
            onChange={(event) => patch({ instructions: event.target.value })}
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
          label="Secuencia correcta"
          values={draft.correctOrder}
          onChange={(correctOrder) => patch({ correctOrder })}
          placeholder="Elemento en orden"
          hint="Escribe los elementos en el orden correcto."
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
            hint="Opcional; aparecen en el banco del ejemplo."
          />
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <input
            type="checkbox"
            checked={draft.example !== null}
            onChange={(event) => setExample(event.target.checked)}
            className="h-4 w-4"
          />
          Añadir como ejemplo
        </label>
        <p className="text-xs text-zinc-500">
          El ejercicio se muestra también en la pantalla de ejemplos. El enunciado, la
          configuración y la explicación se reutilizan.
        </p>

        {draft.example && (
          <div className="space-y-4 border-t border-zinc-200 pt-4">
            <Field label="Título del ejemplo">
              <input
                value={draft.example.title}
                onChange={(event) =>
                  patch({ example: { ...draft.example!, title: event.target.value } })
                }
                className={fieldClass}
              />
            </Field>
            <StepsEditor
              steps={draft.example.steps}
              onChange={(steps) => patch({ example: { ...draft.example!, steps } })}
            />
            <TextList
              label="Pistas"
              values={draft.example.hints}
              onChange={(hints) => patch({ example: { ...draft.example!, hints } })}
              placeholder="Pista"
              hint="Opcional; pueden quedar vacías."
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Vista previa</p>
        <ExercisePreview
          type={draft.type}
          prompt={draft.prompt}
          instructions={draft.instructions}
          correctOrder={draft.correctOrder}
          config={draft.config}
          explanation={draft.explanation}
          example={draft.example}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Guardando…" : initial ? "Guardar cambios" : "Crear ejercicio"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
        >
          Cancelar
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
