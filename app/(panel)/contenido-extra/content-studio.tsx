"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";

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

  const courses = useMemo(() => {
    const map = new Map<string, { id: string; title: string; groups: StudioGroup[] }>();
    for (const group of groups) {
      if (!group.sourceCourseId) continue;
      const existing = map.get(group.sourceCourseId) ?? {
        id: group.sourceCourseId,
        title: group.courseTitle ?? group.name,
        groups: [],
      };
      existing.groups.push(group);
      map.set(group.sourceCourseId, existing);
    }
    return [...map.values()];
  }, [groups]);

  const requestedGroup = groups.find((group) => group.id === initialGroupId);
  const initialGroup =
    requestedGroup ??
    groups.find((group) => group.topics.length > 0) ??
    groups[0] ??
    null;
  const requestedTopic = initialGroup?.topics.find((topic) => topic.id === initialTopicId);
  const initialTopic = requestedTopic ?? initialGroup?.topics[0] ?? null;

  const [courseId, setCourseId] = useState(
    initialGroup?.sourceCourseId ?? courses[0]?.id ?? "",
  );
  const [groupIds, setGroupIds] = useState<string[]>(
    initialGroup ? [initialGroup.id] : [],
  );
  const [unitId, setUnitId] = useState(initialTopic?.unitId ?? "");
  const [topicId, setTopicId] = useState(initialTopic?.id ?? "");
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

  const courseGroups = useMemo(
    () => groups.filter((group) => group.sourceCourseId === courseId),
    [groups, courseId],
  );
  const selectedGroups = courseGroups.filter((group) => groupIds.includes(group.id));
  const selectedGroup =
    selectedGroups.find((group) => group.courseId) ??
    selectedGroups[0] ??
    courseGroups[0] ??
    null;
  const targetClassIds = selectedGroups.map((group) => group.id);
  const courseTopics = selectedGroup?.topics ?? [];
  const units = (() => {
    const map = new Map<string, { id: string; number: number; title: string }>();
    for (const item of courseTopics) {
      if (!map.has(item.unitId)) {
        map.set(item.unitId, {
          id: item.unitId,
          number: item.unitNumber,
          title: item.unitTitle,
        });
      }
    }
    return [...map.values()].sort((left, right) => left.number - right.number);
  })();
  const unitTopics = courseTopics.filter((item) => item.unitId === unitId);
  const topic = unitTopics.find((item) => item.id === topicId) ?? unitTopics[0] ?? null;
  const activeTopicId = topic?.id ?? "";

  const resetDrafts = () => {
    setVersion((current) => current + 1);
    setLessonDraft(EMPTY_LESSON);
    setExampleDraft(null);
    setExerciseDraft(null);
    setEvaluationDraft(EMPTY_EVALUATION);
    setCreatedEvaluation(null);
    setNotice(null);
  };

  const selectCourse = (id: string) => {
    const nextGroups = groups.filter((group) => group.sourceCourseId === id);
    const first = nextGroups[0] ?? null;
    const firstTopic = first?.topics[0] ?? null;
    setCourseId(id);
    setGroupIds(first ? [first.id] : []);
    setUnitId(firstTopic?.unitId ?? "");
    setTopicId(firstTopic?.id ?? "");
    resetDrafts();
  };

  const toggleGroup = (id: string) => {
    setGroupIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const selectUnit = (id: string) => {
    const first = courseTopics.find((item) => item.unitId === id) ?? null;
    setUnitId(id);
    setTopicId(first?.id ?? "");
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

  const activeTopicRef = useRef(activeTopicId);
  useEffect(() => {
    activeTopicRef.current = activeTopicId;
  }, [activeTopicId]);

  const onEvaluationCreated = useCallback(
    (evaluationId: string) => {
      const topicId = activeTopicRef.current;
      if (topicId) {
        setCreatedEvaluation({ topicId, evaluationId });
      }
      handleSaved("Evaluación creada.");
    },
    [handleSaved],
  );

  return (
    <div className="editor-preview-grid">
      <div className="space-y-5">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Dónde se publica</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Elige el curso, los grupos y el subtema donde vivirá el contenido.
            </p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Curso">
              <select
                value={courseId}
                onChange={(event) => selectCourse(event.target.value)}
                className={fieldClass}
              >
                {courses.length === 0 ? (
                  <option value="">Sin cursos</option>
                ) : (
                  courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))
                )}
              </select>
            </Field>

            <div>
              <p className="field-label">Grupos</p>
              <div className="mt-1.5 flex min-h-9 flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 py-1.5">
                {courseGroups.length === 0 ? (
                  <span className="text-sm text-ink-faint">
                    Sin grupos para este curso
                  </span>
                ) : (
                  courseGroups.map((group) => {
                    const checked = groupIds.includes(group.id);
                    return (
                      <label
                        key={group.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${
                          checked
                            ? "border-ink bg-surface-soft font-medium text-ink"
                            : "border-line text-ink-soft hover:border-line-strong"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroup(group.id)}
                          className="size-4"
                        />
                        {group.name}
                      </label>
                    );
                  })
                )}
              </div>
              <p className="hint mt-1">
                Puedes asignar el mismo contenido a varios grupos.
              </p>
              {selectedGroups.some((group) => !group.courseId) && (
                <p className="mt-1 text-xs text-warning" role="status">
                  Sin curso de contenido:{" "}
                  {selectedGroups
                    .filter((group) => !group.courseId)
                    .map((group) => group.name)
                    .join(", ")}
                  . El contenido no se creará en esos grupos.
                </p>
              )}
            </div>

            <Field label="Unidad">
              <select
                value={unitId}
                onChange={(event) => selectUnit(event.target.value)}
                disabled={units.length === 0}
                className={fieldClass}
              >
                {units.length === 0 ? (
                  <option value="">Sin unidades</option>
                ) : (
                  units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.number}. {unit.title}
                    </option>
                  ))
                )}
              </select>
            </Field>

            <Field label="Subtema">
              <select
                value={topic?.id ?? ""}
                onChange={(event) => selectTopic(event.target.value)}
                disabled={unitTopics.length === 0}
                className={fieldClass}
              >
                {unitTopics.length === 0 ? (
                  <option value="">Sin subtemas</option>
                ) : (
                  unitTopics.map((item, index) => (
                    <option key={item.id} value={item.id}>
                      {item.unitNumber}.{index + 1} {item.title}
                    </option>
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

            {groups.length === 0 ? (
              <p className="empty">
                Primero crea un grupo en{" "}
                <Link href="/grupos" className="link">
                  Grupos
                </Link>
                .
              </p>
            ) : !courseId ? (
              <p className="empty">
                No hay cursos disponibles para tus grupos.
              </p>
            ) : selectedGroups.length === 0 ? (
              <p className="empty">
                Selecciona al menos un grupo para asignar el contenido.
              </p>
            ) : !selectedGroup?.courseId ? (
              <div className="rounded-xl border border-dashed border-line-strong bg-surface-soft/60 p-4 text-sm text-ink-muted">
                <p>
                  <strong className="text-ink">{selectedGroup?.name}</strong> todavía no
                  tiene un curso de contenido propio.
                </p>
                {selectedGroup && (
                  <form action={createClassContent} className="mt-3">
                    <input type="hidden" name="classId" value={selectedGroup.id} />
                    <button type="submit" className="btn btn-primary btn-sm">
                      Crear contenido del grupo
                    </button>
                  </form>
                )}
              </div>
            ) : courseTopics.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong bg-surface-soft/60 p-4 text-sm text-ink-muted">
                <p>El curso todavía no tiene unidades ni subtemas.</p>
                <Link
                  href={`/cursos/${selectedGroup.sourceCourseId ?? selectedGroup.courseId}`}
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
                    group={selectedGroup}
                    classIds={targetClassIds}
                    topic={topic}
                    onDraftChange={setLessonDraft}
                    onSaved={onLessonSaved}
                  />
                )}

                {type === "example" && (
                  <ExampleForm
                    key={`example-${topic.id}-${version}`}
                    courseId={selectedGroup.courseId ?? ""}
                    classIds={targetClassIds}
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
                    courseId={selectedGroup.courseId ?? ""}
                    classIds={targetClassIds}
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
                    group={selectedGroup}
                    classIds={targetClassIds}
                    topic={topic}
                    onDraftChange={setEvaluationDraft}
                    onCreated={onEvaluationCreated}
                  />
                )}

                {createdEvaluation?.topicId === topic.id && selectedGroup.courseId && (
                  <Link
                    href={`/cursos/${selectedGroup.courseId}/temas/${topic.id}/evaluaciones/${createdEvaluation.evaluationId}`}
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
  classIds,
  topic,
  onDraftChange,
  onSaved,
}: {
  group: StudioGroup;
  classIds: string[];
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
      {classIds.map((classId) => (
        <input key={classId} type="hidden" name="classIds" value={classId} />
      ))}

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
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "studio-lesson-error" : undefined}
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
          <p id="studio-lesson-error" className="form-error" role="alert">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

function EvaluationStudioForm({
  group,
  classIds,
  topic,
  onDraftChange,
  onCreated,
}: {
  group: StudioGroup;
  classIds: string[];
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
      {classIds.map((classId) => (
        <input key={classId} type="hidden" name="classIds" value={classId} />
      ))}

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
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "studio-evaluation-error" : undefined}
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
          <p id="studio-evaluation-error" className="form-error" role="alert">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
