"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";

import { createClassContent } from "@/lib/actions/classes";
import { createLesson, type ActionResult } from "@/lib/actions/content";
import { createEvaluation, type TopicResult } from "@/lib/actions/topics";
import type { ContentBlock } from "@/lib/content";
import type { StudioContentType, StudioGroup, StudioTopic } from "@/lib/studio";

import { BlockEditor } from "../cursos/[id]/lecciones/[lessonId]/block-editor";
import {
  ExampleForm,
  type ExampleDraft,
} from "../cursos/[id]/lecciones/[lessonId]/example-form";
import {
  ExerciseForm,
  type ExerciseDraft,
} from "../cursos/[id]/lecciones/[lessonId]/exercise-form";
import { Field, fieldClass } from "../cursos/[id]/lecciones/[lessonId]/fields";
import { ContentTypeIcon } from "./content-icons";
import {
  MloTopicPreview,
  type EvaluationDraft,
  type LessonDraft,
} from "./mlo-preview";

const TYPE_META: {
  type: StudioContentType;
  label: string;
  note: string;
  tone: string;
}[] = [
  {
    type: "lesson",
    label: "Lección",
    note: "Lectura y bloques",
    tone: "#315fec",
  },
  {
    type: "example",
    label: "Ejemplo",
    note: "Guía paso a paso",
    tone: "#138a63",
  },
  {
    type: "exercise",
    label: "Ejercicio",
    note: "Práctica interactiva",
    tone: "#b98225",
  },
  {
    type: "evaluation",
    label: "Evaluación",
    note: "Preguntas y ejercicios",
    tone: "#c43d4b",
  },
];

const EMPTY_LESSON: LessonDraft = { title: "", blocks: [] };
const EMPTY_EVALUATION: EvaluationDraft = { title: "", description: "" };

export function ContentStudio({
  groups,
  initialGroupId,
  initialTopicId,
}: {
  groups: StudioGroup[];
  initialGroupId?: string;
  initialTopicId?: string;
}) {
  const router = useRouter();
  const initialGroup =
    groups.find((group) => group.topics.length > 0) ??
    groups[0] ??
    null;

  const requestedGroup = groups.find((group) => group.id === initialGroupId);
  const firstGroup = requestedGroup ?? initialGroup;
  const requestedTopic = firstGroup?.topics.find((topic) => topic.id === initialTopicId);
  const [groupId, setGroupId] = useState(firstGroup?.id ?? "");
  const [topicId, setTopicId] = useState(requestedTopic?.id ?? firstGroup?.topics[0]?.id ?? "");
  const [type, setType] = useState<StudioContentType>("lesson");
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [lessonDraft, setLessonDraft] = useState<LessonDraft>(EMPTY_LESSON);
  const [exampleDraft, setExampleDraft] = useState<ExampleDraft | null>(null);
  const [exerciseDraft, setExerciseDraft] = useState<ExerciseDraft | null>(null);
  const [evaluationDraft, setEvaluationDraft] =
    useState<EvaluationDraft>(EMPTY_EVALUATION);
  const [createdEvaluation, setCreatedEvaluation] = useState<{
    topicId: string;
    evaluationId: string;
  } | null>(null);

  const group = groups.find((item) => item.id === groupId) ?? groups[0] ?? null;
  const topic =
    group?.topics.find((item) => item.id === topicId) ?? group?.topics[0] ?? null;

  const topicsByUnit = useMemo(() => {
    const units = new Map<string, StudioTopic[]>();
    for (const item of group?.topics ?? []) {
      const key = `${item.unitNumber}. ${item.unitTitle}`;
      units.set(key, [...(units.get(key) ?? []), item]);
    }
    return [...units.entries()];
  }, [group]);

  const resetDrafts = () => {
    setVersion((current) => current + 1);
    setLessonDraft(EMPTY_LESSON);
    setExampleDraft(null);
    setExerciseDraft(null);
    setEvaluationDraft(EMPTY_EVALUATION);
    setCreatedEvaluation(null);
    setNotice(null);
  };

  const selectGroup = (id: string) => {
    const next = groups.find((item) => item.id === id) ?? null;
    setGroupId(id);
    setTopicId(next?.topics[0]?.id ?? "");
    resetDrafts();
  };

  const selectTopic = (id: string) => {
    setTopicId(id);
    resetDrafts();
  };

  const handleSaved = useCallback(
    (message: string) => {
      setNotice(message);
      setVersion((current) => current + 1);
      router.refresh();
    },
    [router],
  );

  const onLessonSaved = useCallback(
    () => handleSaved("Lección creada."),
    [handleSaved],
  );
  const onExampleSaved = useCallback(
    () => handleSaved("Ejemplo creado."),
    [handleSaved],
  );
  const onExerciseSaved = useCallback(
    () => handleSaved("Ejercicio creado."),
    [handleSaved],
  );

  const onEvaluationCreated = useCallback(
    (evaluationId: string) => {
      if (topic) setCreatedEvaluation({ topicId: topic.id, evaluationId });
      handleSaved("Evaluación creada.");
    },
    [handleSaved, topic],
  );

  return (
    <div className="editor-preview-grid">
      <div className="space-y-5">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">Dónde se publica</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Elige el grupo y el subtema donde vivirá el contenido.
              </p>
            </div>
            {group?.sourceCourseId && (
              <Link
                href={`/cursos/${group.sourceCourseId}`}
                className="btn btn-secondary btn-sm"
              >
                Abrir curso
              </Link>
            )}
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Curso">
              <div className={`${fieldClass} flex items-center text-ink-soft`}>
                {group?.courseTitle ?? "Sin curso"}
              </div>
            </Field>

            <Field label="Grupo">
              <select
                value={group?.id ?? ""}
                onChange={(event) => selectGroup(event.target.value)}
                className={fieldClass}
              >
                {groups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.courseTitle ? ` · ${item.courseTitle}` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Unidad">
              <div className={`${fieldClass} flex items-center text-ink-soft`}>
                {topic ? `${topic.unitNumber}. ${topic.unitTitle}` : "Sin unidad"}
              </div>
            </Field>

            <Field label="Subtema">
              <select
                value={topic?.id ?? ""}
                onChange={(event) => selectTopic(event.target.value)}
                disabled={!group || group.topics.length === 0}
                className={fieldClass}
              >
                {!group || group.topics.length === 0 ? (
                  <option value="">Sin subtemas</option>
                ) : (
                  topicsByUnit.map(([unit, unitTopics]) => (
                    <optgroup key={unit} label={unit}>
                      {unitTopics.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
            </Field>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">
              Crear contenido del subtema
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Lecciones, ejemplos, ejercicios y evaluaciones con la misma estructura que
              usa MLO.
            </p>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TYPE_META.map((item) => {
                const active = type === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setType(item.type);
                      setNotice(null);
                    }}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      active
                        ? "border-accent bg-accent-soft/60 shadow-[var(--shadow-card)]"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <span
                      className="grid size-8 place-items-center rounded-lg"
                      style={{
                        backgroundColor: `${item.tone}16`,
                        color: item.tone,
                      }}
                    >
                      <ContentTypeIcon type={item.type} className="size-4" />
                    </span>
                    <span className="mt-2 block text-sm font-medium text-ink">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">
                      {item.note}
                    </span>
                  </button>
                );
              })}
            </div>

            {!group ? (
              <p className="empty">
                Primero crea un grupo en{" "}
                <Link href="/grupos" className="link">
                  Grupos
                </Link>
                .
              </p>
            ) : !group.courseId ? (
              <div className="rounded-xl border border-dashed border-line-strong bg-surface-soft/60 p-4 text-sm text-ink-muted">
                <p>
                  <strong className="text-ink">{group.name}</strong> todavía no tiene un
                  curso de contenido propio.
                </p>
                <form action={createClassContent} className="mt-3">
                  <input type="hidden" name="classId" value={group.id} />
                  <button type="submit" className="btn btn-primary btn-sm">
                    Crear contenido del grupo
                  </button>
                </form>
              </div>
            ) : group.topics.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong bg-surface-soft/60 p-4 text-sm text-ink-muted">
                <p>El curso del grupo todavía no tiene unidades ni subtemas.</p>
                <Link
                  href={`/cursos/${group.sourceCourseId ?? group.courseId}`}
                  className="btn btn-secondary btn-sm mt-3"
                >
                  Crear unidad y subtema
                </Link>
              </div>
            ) : !topic ? (
              <p className="empty">Selecciona un subtema para comenzar.</p>
            ) : (
              <>
                {type === "lesson" && (
                  <LessonStudioForm
                    key={`lesson-${topic.id}-${version}`}
                    group={group}
                    topic={topic}
                    onDraftChange={setLessonDraft}
                    onSaved={onLessonSaved}
                  />
                )}

                {type === "example" && (
                  <ExampleForm
                    key={`example-${topic.id}-${version}`}
                    courseId={group.courseId ?? ""}
                    topicId={topic.id}
                    onSaved={onExampleSaved}
                    onCancel={() => setType("lesson")}
                    onDraftChange={setExampleDraft}
                    showPreview={false}
                    flush
                  />
                )}

                {type === "exercise" && (
                  <ExerciseForm
                    key={`exercise-${topic.id}-${version}`}
                    courseId={group.courseId ?? ""}
                    topicId={topic.id}
                    onSaved={onExerciseSaved}
                    onCancel={() => setType("lesson")}
                    onDraftChange={setExerciseDraft}
                    showPreview={false}
                    flush
                  />
                )}

                {type === "evaluation" && (
                  <EvaluationStudioForm
                    key={`evaluation-${topic.id}-${version}`}
                    group={group}
                    topic={topic}
                    onDraftChange={setEvaluationDraft}
                    onCreated={onEvaluationCreated}
                  />
                )}

                {createdEvaluation?.topicId === topic.id && group.courseId && (
                  <Link
                    href={`/cursos/${group.courseId}/temas/${topic.id}/evaluaciones/${createdEvaluation.evaluationId}`}
                    className="btn btn-secondary btn-sm"
                  >
                    Agregar preguntas a la evaluación →
                  </Link>
                )}

                {notice && (
                  <p className="form-ok" role="status">
                    {notice}
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <aside className="editor-preview-aside space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Vista previa · MLO</h2>
          <span className="text-xs text-ink-faint">En vivo</span>
        </div>
        <MloTopicPreview
          type={type}
          lessonDraft={lessonDraft}
          exampleDraft={exampleDraft}
          exerciseDraft={exerciseDraft}
          evaluationDraft={evaluationDraft}
        />
      </aside>
    </div>
  );
}

function LessonStudioForm({
  group,
  topic,
  onDraftChange,
  onSaved,
}: {
  group: StudioGroup;
  topic: StudioTopic;
  onDraftChange: (draft: LessonDraft) => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<LessonDraft>(EMPTY_LESSON);
  const [state, action, pending] = useActionState<ActionResult, FormData>(createLesson, {});

  useEffect(() => {
    onDraftChange(draft);
  }, [draft, onDraftChange]);

  useEffect(() => {
    if (state.ok) onSaved();
  }, [state.ok, onSaved]);

  const setBlocks = useCallback((blocks: ContentBlock[]) => {
    setDraft((current) => ({ ...current, blocks }));
  }, []);

  return (
    <form
      id="studio-form"
      action={action}
      className="space-y-5 border-t border-line pt-5"
    >
      <input type="hidden" name="courseId" value={group.courseId ?? ""} />
      <input type="hidden" name="topicId" value={topic.id} />

      <div className="max-w-2xl">
        <Field label="Título de la lección">
          <input
            name="title"
            required
            minLength={3}
            value={draft.title}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Ej. Principios de diseño centrado en las personas"
            className={fieldClass}
          />
        </Field>
      </div>

      <div>
        <p className="eyebrow mb-2">Contenido de la lección</p>
        <BlockEditor
          initial={[]}
          label="Contenido de la lección"
          onChange={setBlocks}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Creando lección…" : "Crear lección"}
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

function EvaluationStudioForm({
  group,
  topic,
  onDraftChange,
  onCreated,
}: {
  group: StudioGroup;
  topic: StudioTopic;
  onDraftChange: (draft: EvaluationDraft) => void;
  onCreated: (evaluationId: string) => void;
}) {
  const [draft, setDraft] = useState<EvaluationDraft>(EMPTY_EVALUATION);
  const [state, action, pending] = useActionState<TopicResult, FormData>(
    createEvaluation,
    {},
  );

  useEffect(() => {
    onDraftChange(draft);
  }, [draft, onDraftChange]);

  useEffect(() => {
    if (state.ok && state.evaluationId) onCreated(state.evaluationId);
  }, [state.ok, state.evaluationId, onCreated]);

  return (
    <form
      id="studio-form"
      action={action}
      className="space-y-5 border-t border-line pt-5"
    >
      <input type="hidden" name="courseId" value={group.courseId ?? ""} />
      <input type="hidden" name="topicId" value={topic.id} />
      <input type="hidden" name="stay" value="on" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título de la evaluación">
          <input
            name="title"
            required
            minLength={3}
            value={draft.title}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Ej. Comprueba tu avance"
            className={fieldClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descripción" hint="Opcional; se muestra antes de comenzar.">
            <input
              name="description"
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Qué evalúa esta evaluación."
              className={fieldClass}
            />
          </Field>
        </div>
      </div>

      <p className="text-xs text-ink-faint">
        Al crearla, podrás agregar preguntas y seleccionar ejercicios del subtema.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Creando evaluación…" : "Crear evaluación"}
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
