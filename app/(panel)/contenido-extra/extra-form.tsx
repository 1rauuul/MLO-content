"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

import { saveExtra, type ExtraResult } from "@/lib/actions/classes";
import type { BaseLesson } from "@/lib/classes";
import type { ContentBlock } from "@/lib/content";
import {
  type ExtraExampleDraft,
  type ExtraExerciseDraft,
  type ExtraType,
  type LessonExtraPayload,
} from "@/lib/content/classes";
import type { ExerciseConfig, ExerciseStep, ExerciseType } from "@/lib/content/model";

import { BlockEditor } from "../cursos/[id]/lecciones/[lessonId]/block-editor";
import {
  EntriesEditor,
  Field,
  PairsEditor,
  StepsEditor,
  TextList,
  fieldClass,
} from "../cursos/[id]/lecciones/[lessonId]/fields";
import { ExamplePreview, ExercisePreview } from "../cursos/[id]/lecciones/[lessonId]/preview";

export type ExtraFormInitial = {
  id: string;
  type: ExtraType;
  lessonId: string;
  classIds: string[];
  payload: unknown;
};

type ClassroomOption = { id: string; name: string };

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

function emptyExercise(): ExtraExerciseDraft {
  return {
    type: "order",
    prompt: "",
    instructions: "",
    correctOrder: ["", ""],
    config: {},
    explanation: "",
  };
}

function emptyExample(): ExtraExampleDraft {
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

function initialLesson(payload: unknown): LessonExtraPayload {
  if (typeof payload === "object" && payload !== null) {
    const record = payload as { title?: unknown; blocks?: unknown };
    return {
      title: typeof record.title === "string" ? record.title : "",
      blocks: Array.isArray(record.blocks) ? (record.blocks as ContentBlock[]) : [],
    };
  }
  return { title: "", blocks: [] };
}

function initialExercise(initial?: ExtraFormInitial): ExtraExerciseDraft {
  if (initial?.type !== "exercise" || typeof initial.payload !== "object" || !initial.payload) {
    return emptyExercise();
  }
  const payload = initial.payload as Partial<ExtraExerciseDraft> & { example?: unknown };
  const type = payload.type ?? "order";
  return {
    type,
    prompt: payload.prompt ?? "",
    instructions: payload.instructions ?? "",
    correctOrder: payload.correctOrder ?? [],
    config: payload.config ?? emptyConfig(type),
    explanation: payload.explanation ?? "",
  };
}

function initialExample(initial?: ExtraFormInitial): ExtraExampleDraft {
  if (initial?.type !== "example" || typeof initial.payload !== "object" || !initial.payload) {
    return emptyExample();
  }
  const payload = initial.payload as Partial<ExtraExampleDraft>;
  const type = payload.type ?? "match";
  return {
    type,
    title: payload.title ?? "",
    prompt: payload.prompt ?? "",
    config: payload.config ?? emptyConfig(type),
    steps: payload.steps ?? [{ text: "", why: "" }],
    hints: payload.hints ?? [],
    explanation: payload.explanation ?? "",
  };
}

function groupLessons(lessons: BaseLesson[]): [string, BaseLesson[]][] {
  const groups = new Map<string, BaseLesson[]>();
  for (const lesson of lessons) {
    const key = `${lesson.unit_number}. ${lesson.unit_title}`;
    groups.set(key, [...(groups.get(key) ?? []), lesson]);
  }
  return [...groups.entries()];
}

const TYPE_OPTIONS: { value: ExtraType; label: string }[] = [
  { value: "lesson", label: "Bloques de contenido" },
  { value: "example", label: "Ejemplo" },
  { value: "exercise", label: "Ejercicio" },
];

export function ExtraForm({
  classes,
  lessons,
  initial,
  preselectedClassId,
}: {
  classes: ClassroomOption[];
  lessons: BaseLesson[];
  initial?: ExtraFormInitial;
  preselectedClassId?: string;
}) {
  const router = useRouter();
  const allowedClassIds = useMemo(() => new Set(classes.map((klass) => klass.id)), [classes]);
  const defaultClassIds = (initial?.classIds?.length
    ? initial.classIds
    : preselectedClassId
      ? [preselectedClassId]
      : []
  ).filter((id) => allowedClassIds.has(id));

  const [type, setType] = useState<ExtraType>(initial?.type ?? "lesson");
  const [lessonId, setLessonId] = useState(initial?.lessonId ?? lessons[0]?.id ?? "");
  const [classIds, setClassIds] = useState<string[]>(defaultClassIds);
  const [lessonDraft, setLessonDraft] = useState<LessonExtraPayload>(
    initial?.type === "lesson" ? initialLesson(initial.payload) : { title: "", blocks: [] },
  );
  const [exercise, setExercise] = useState<ExtraExerciseDraft>(() => initialExercise(initial));
  const [example, setExample] = useState<ExtraExampleDraft>(() => initialExample(initial));

  const [state, action, pending] = useActionState<ExtraResult, FormData>(saveExtra, {});

  useEffect(() => {
    if (!state.ok) return;
    router.replace("/contenido-extra");
    router.refresh();
  }, [state.ok, router]);

  const toggleClass = (classId: string) =>
    setClassIds((current) =>
      current.includes(classId)
        ? current.filter((id) => id !== classId)
        : [...current, classId],
    );

  const allSelected = classes.length > 0 && classIds.length === classes.length;
  const toggleAll = () =>
    setClassIds(allSelected ? [] : classes.map((klass) => klass.id));

  const changeExerciseType = (next: ExerciseType) =>
    setExercise((current) => ({
      ...current,
      type: next,
      config: emptyConfig(next),
      correctOrder: next === "order" ? ["", ""] : [],
    }));

  const changeExampleType = (next: ExerciseType) =>
    setExample((current) => ({
      ...current,
      type: next,
      config: emptyConfig(next),
    }));

  const groups = groupLessons(lessons);

  return (
    <form
      action={action}
      className="space-y-5 rounded-xl border border-zinc-300 bg-white p-5"
    >
      <input type="hidden" name="extraId" value={initial?.id ?? ""} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium text-zinc-900">
          {initial ? "Editar contenido extra" : "Nuevo contenido extra"}
        </h2>
        {initial && (
          <Link href="/contenido-extra" className="text-sm text-zinc-500 hover:text-zinc-900">
            Cancelar edición
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lección del curso base">
          <select
            name="lessonId"
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
            className={fieldClass}
          >
            {groups.map(([unit, unitLessons]) => (
              <optgroup key={unit} label={unit}>
                {unitLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.code} · {lesson.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label="Tipo de contenido">
          <select
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as ExtraType)}
            className={fieldClass}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-zinc-700">Clases a las que se asigna</p>
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
          >
            {allSelected ? "Quitar todas" : "Todas"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {classes.map((klass) => (
            <label
              key={klass.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                classIds.includes(klass.id)
                  ? "border-zinc-900 bg-zinc-50 text-zinc-900"
                  : "border-zinc-300 text-zinc-600"
              }`}
            >
              <input
                type="checkbox"
                name="classIds"
                value={klass.id}
                checked={classIds.includes(klass.id)}
                onChange={() => toggleClass(klass.id)}
                className="h-4 w-4"
              />
              {klass.name}
            </label>
          ))}
        </div>
        <p className="text-xs text-zinc-400">
          Si eliges varias, el mismo contenido entra en la publicación de cada clase.
        </p>
      </div>

      {type === "lesson" && (
        <div className="space-y-4">
          <Field label="Título (opcional)">
            <input
              name="title"
              value={lessonDraft.title}
              onChange={(event) =>
                setLessonDraft((current) => ({ ...current, title: event.target.value }))
              }
              className={fieldClass}
            />
          </Field>
          <BlockEditor
            key={initial?.id ?? "lesson-blocks"}
            initial={lessonDraft.blocks}
            label="Bloques del contenido extra"
          />
        </div>
      )}

      {type === "exercise" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de ejercicio">
              <select
                value={exercise.type}
                onChange={(event) =>
                  changeExerciseType(event.target.value as ExerciseType)
                }
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
                value={exercise.prompt}
                onChange={(event) =>
                  setExercise((current) => ({ ...current, prompt: event.target.value }))
                }
                className={fieldClass}
              />
            </Field>
            <Field label="Instrucciones" hint="Opcional; MLO las muestra bajo el enunciado.">
              <input
                value={exercise.instructions}
                onChange={(event) =>
                  setExercise((current) => ({
                    ...current,
                    instructions: event.target.value,
                  }))
                }
                className={fieldClass}
              />
            </Field>
            <Field label="Explicación" hint="Opcional; se muestra al terminar.">
              <input
                value={exercise.explanation}
                onChange={(event) =>
                  setExercise((current) => ({
                    ...current,
                    explanation: event.target.value,
                  }))
                }
                className={fieldClass}
              />
            </Field>
          </div>

          {exercise.type === "order" && (
            <TextList
              label="Secuencia correcta"
              values={exercise.correctOrder}
              onChange={(correctOrder) =>
                setExercise((current) => ({ ...current, correctOrder }))
              }
              placeholder="Elemento en orden"
              hint="Escribe los elementos en el orden correcto."
            />
          )}

          {exercise.type === "fill" && (
            <div className="space-y-4">
              <TextList
                label="Oraciones"
                values={exercise.config.sentences ?? []}
                onChange={(sentences) =>
                  setExercise((current) => ({
                    ...current,
                    config: { ...current.config, sentences },
                  }))
                }
                placeholder="El {{software}} se mantiene."
                hint="Cada espacio va entre dobles llaves: {{palabra}}."
              />
              <TextList
                label="Palabras extra (distractores)"
                values={exercise.config.bank ?? []}
                onChange={(bank) =>
                  setExercise((current) => ({
                    ...current,
                    config: { ...current.config, bank },
                  }))
                }
                placeholder="Distractor"
                hint="Las respuestas salen de las oraciones; aquí van solo las palabras de más."
              />
            </div>
          )}

          {exercise.type === "match" && (
            <PairsEditor
              pairs={exercise.config.pairs ?? []}
              onChange={(pairs) =>
                setExercise((current) => ({
                  ...current,
                  config: { ...current.config, pairs },
                }))
              }
            />
          )}

          {exercise.type === "crossword" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Filas">
                  <input
                    type="number"
                    min={1}
                    value={exercise.config.crossword?.rows ?? 8}
                    onChange={(event) =>
                      setExercise((current) => ({
                        ...current,
                        config: {
                          ...current.config,
                          crossword: {
                            rows: Number(event.target.value),
                            cols: current.config.crossword?.cols ?? 8,
                            entries: current.config.crossword?.entries ?? [],
                          },
                        },
                      }))
                    }
                    className={fieldClass}
                  />
                </Field>
                <Field label="Columnas">
                  <input
                    type="number"
                    min={1}
                    value={exercise.config.crossword?.cols ?? 8}
                    onChange={(event) =>
                      setExercise((current) => ({
                        ...current,
                        config: {
                          ...current.config,
                          crossword: {
                            rows: current.config.crossword?.rows ?? 8,
                            cols: Number(event.target.value),
                            entries: current.config.crossword?.entries ?? [],
                          },
                        },
                      }))
                    }
                    className={fieldClass}
                  />
                </Field>
              </div>
              <EntriesEditor
                entries={exercise.config.crossword?.entries ?? []}
                onChange={(entries) =>
                  setExercise((current) => ({
                    ...current,
                    config: {
                      ...current.config,
                      crossword: {
                        rows: current.config.crossword?.rows ?? 8,
                        cols: current.config.crossword?.cols ?? 8,
                        entries,
                      },
                    },
                  }))
                }
              />
              <TextList
                label="Palabras extra (distractores)"
                values={exercise.config.bank ?? []}
                onChange={(bank) =>
                  setExercise((current) => ({
                    ...current,
                    config: { ...current.config, bank },
                  }))
                }
                placeholder="PALABRA"
              />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Vista previa</p>
            <ExercisePreview
              type={exercise.type}
              prompt={exercise.prompt}
              instructions={exercise.instructions}
              correctOrder={exercise.correctOrder}
              config={exercise.config}
              explanation={exercise.explanation}
              example={null}
            />
          </div>
        </div>
      )}

      {type === "example" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de ejemplo">
              <select
                value={example.type}
                onChange={(event) => changeExampleType(event.target.value as ExerciseType)}
                className={fieldClass}
              >
                <option value="fill">Completar</option>
                <option value="match">Relacionar</option>
                <option value="crossword">Crucigrama</option>
              </select>
            </Field>
            <Field label="Título">
              <input
                value={example.title}
                onChange={(event) =>
                  setExample((current) => ({ ...current, title: event.target.value }))
                }
                className={fieldClass}
              />
            </Field>
            <Field label="Enunciado">
              <input
                value={example.prompt}
                onChange={(event) =>
                  setExample((current) => ({ ...current, prompt: event.target.value }))
                }
                className={fieldClass}
              />
            </Field>
            <Field label="Explicación" hint="Opcional; se muestra al terminar.">
              <input
                value={example.explanation}
                onChange={(event) =>
                  setExample((current) => ({
                    ...current,
                    explanation: event.target.value,
                  }))
                }
                className={fieldClass}
              />
            </Field>
          </div>

          {example.type === "fill" && (
            <div className="space-y-4">
              <TextList
                label="Oraciones"
                values={example.config.sentences ?? []}
                onChange={(sentences) =>
                  setExample((current) => ({
                    ...current,
                    config: { ...current.config, sentences },
                  }))
                }
                placeholder="El {{software}} se mantiene."
                hint="Cada espacio va entre dobles llaves: {{palabra}}."
              />
              <TextList
                label="Palabras extra (distractores)"
                values={example.config.bank ?? []}
                onChange={(bank) =>
                  setExample((current) => ({
                    ...current,
                    config: { ...current.config, bank },
                  }))
                }
                placeholder="Distractor"
              />
            </div>
          )}

          {example.type === "match" && (
            <PairsEditor
              pairs={example.config.pairs ?? []}
              onChange={(pairs) =>
                setExample((current) => ({
                  ...current,
                  config: { ...current.config, pairs },
                }))
              }
            />
          )}

          {example.type === "crossword" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Filas">
                  <input
                    type="number"
                    min={1}
                    value={example.config.crossword?.rows ?? 8}
                    onChange={(event) =>
                      setExample((current) => ({
                        ...current,
                        config: {
                          ...current.config,
                          crossword: {
                            rows: Number(event.target.value),
                            cols: current.config.crossword?.cols ?? 8,
                            entries: current.config.crossword?.entries ?? [],
                          },
                        },
                      }))
                    }
                    className={fieldClass}
                  />
                </Field>
                <Field label="Columnas">
                  <input
                    type="number"
                    min={1}
                    value={example.config.crossword?.cols ?? 8}
                    onChange={(event) =>
                      setExample((current) => ({
                        ...current,
                        config: {
                          ...current.config,
                          crossword: {
                            rows: current.config.crossword?.rows ?? 8,
                            cols: Number(event.target.value),
                            entries: current.config.crossword?.entries ?? [],
                          },
                        },
                      }))
                    }
                    className={fieldClass}
                  />
                </Field>
              </div>
              <EntriesEditor
                entries={example.config.crossword?.entries ?? []}
                onChange={(entries) =>
                  setExample((current) => ({
                    ...current,
                    config: {
                      ...current.config,
                      crossword: {
                        rows: current.config.crossword?.rows ?? 8,
                        cols: current.config.crossword?.cols ?? 8,
                        entries,
                      },
                    },
                  }))
                }
              />
            </div>
          )}

          <StepsEditor
            steps={example.steps}
            onChange={(steps: ExerciseStep[]) =>
              setExample((current) => ({ ...current, steps }))
            }
          />
          <TextList
            label="Pistas"
            values={example.hints}
            onChange={(hints) => setExample((current) => ({ ...current, hints }))}
            placeholder="Pista"
            hint="Opcional; pueden quedar vacías."
          />

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Vista previa</p>
            <ExamplePreview
              type={example.type}
              title={example.title}
              prompt={example.prompt}
              config={example.config}
              steps={example.steps}
              hints={example.hints}
              explanation={example.explanation}
            />
          </div>
        </div>
      )}

      {type !== "lesson" && (
        <input
          type="hidden"
          name="payload"
          value={JSON.stringify(type === "exercise" ? exercise : example)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || lessons.length === 0}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending
            ? "Guardando…"
            : initial
              ? "Guardar cambios"
              : "Agregar contenido"}
        </button>
        {initial && (
          <Link
            href="/contenido-extra"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
          >
            Cancelar
          </Link>
        )}
        {lessons.length === 0 && (
          <p className="text-sm text-amber-700">
            No hay lecciones del curso base. Importa el core antes de agregar contenido.
          </p>
        )}
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-green-700">Contenido guardado.</p>}
      </div>
    </form>
  );
}
