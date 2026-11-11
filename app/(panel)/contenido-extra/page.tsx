import Link from "next/link";

import { deleteExtra } from "@/lib/actions/classes";
import { requireTeacher } from "@/lib/auth";
import {
  extraSummary,
  getExtraForRead,
  listBaseLessons,
  listEditableClasses,
  listTeacherExtras,
} from "@/lib/classes";
import type { ExtraPayload } from "@/lib/content/classes";
import type { StudioGroup, StudioTopic } from "@/lib/studio";
import { db } from "@/lib/db";

import { ContentStudio } from "./content-studio";
import { ContentTabs } from "./content-tabs";
import { ExtraForm } from "./extra-form";

const TYPE_LABEL = {
  lesson: "Lección",
  example: "Ejemplo",
  exercise: "Ejercicio",
} as const;

type StudioTopicRow = {
  id: string;
  title: string;
  course_id: string;
  unit_number: number;
  unit_title: string;
  lesson_count: number;
  example_count: number;
  exercise_count: number;
  evaluation_count: number;
};

type StudioLessonRow = {
  id: string;
  topic_id: string;
  code: string;
  title: string;
};

export default async function ContenidoExtraPage({
  searchParams,
}: {
  searchParams: Promise<{ extra?: string; classId?: string; topicId?: string; tab?: string }>;
}) {
  const teacher = await requireTeacher();
  const { extra: extraId, classId, topicId, tab } = await searchParams;

  const [classes, lessons, extras, editing] = await Promise.all([
    listEditableClasses(teacher),
    listBaseLessons(),
    listTeacherExtras(teacher),
    extraId ? getExtraForRead(teacher, extraId) : Promise.resolve(null),
  ]);

  const courseIds = classes
    .map((klass) => klass.content_course_id)
    .filter((id): id is string => Boolean(id));

  let topicRows: StudioTopicRow[] = [];
  let lessonRows: StudioLessonRow[] = [];

  if (courseIds.length > 0) {
    topicRows = await db()<StudioTopicRow[]>`
      select t.id, t.title, t.course_id,
             u.number as unit_number, u.title as unit_title,
             (select count(*)::int from lessons l
               where l.topic_id = t.id and l.archived_at is null) as lesson_count,
             (select count(*)::int from examples e
               where e.topic_id = t.id and e.archived_at is null) as example_count,
             (select count(*)::int from exercises x
               where x.topic_id = t.id and x.archived_at is null) as exercise_count,
             (select count(*)::int from evaluations ev
               where ev.topic_id = t.id and ev.archived_at is null) as evaluation_count
        from topics t
        join units u on u.id = t.unit_id
       where t.course_id in ${db()(courseIds)}
         and t.archived_at is null
         and u.archived_at is null
       order by u.number, t.position, t.id`;

    const topicIds = topicRows.map((topic) => topic.id);
    if (topicIds.length > 0) {
      lessonRows = await db()<StudioLessonRow[]>`
        select id, topic_id, code, title
          from lessons
         where topic_id in ${db()(topicIds)}
           and archived_at is null
         order by position, code, id`;
    }
  }

  const lessonsByTopic = new Map<string, StudioLessonRow[]>();
  for (const lesson of lessonRows) {
    const rows = lessonsByTopic.get(lesson.topic_id) ?? [];
    rows.push(lesson);
    lessonsByTopic.set(lesson.topic_id, rows);
  }

  const studioGroups: StudioGroup[] = classes.map((klass) => ({
    id: klass.id,
    name: klass.name,
    courseId: klass.content_course_id,
    courseTitle: klass.course_title,
    topics: topicRows
      .filter((topic) => topic.course_id === klass.content_course_id)
      .map(
        (topic): StudioTopic => ({
          id: topic.id,
          title: topic.title,
          unitNumber: topic.unit_number,
          unitTitle: topic.unit_title,
          lessons: (lessonsByTopic.get(topic.id) ?? []).map((lesson) => ({
            id: lesson.id,
            code: lesson.code,
            title: lesson.title,
          })),
          exampleCount: topic.example_count,
          exerciseCount: topic.exercise_count,
          evaluationCount: topic.evaluation_count,
        }),
      ),
  }));

  const preselected =
    classId && classes.some((klass) => klass.id === classId) ? classId : undefined;

  const initial = editing
    ? {
        id: editing.id,
        type: editing.type,
        lessonId: editing.lesson_id,
        classIds: editing.class_ids,
        payload: editing.payload as ExtraPayload,
      }
    : undefined;

  const extrasPanel = (
    <div className="space-y-6">
      {classes.length === 0 ? (
        <p className="empty">
          Primero crea un grupo en{" "}
          <Link href="/grupos" className="link">
            Grupos
          </Link>
          .
        </p>
      ) : (
        <ExtraForm
          key={initial?.id ?? "nuevo"}
          classes={classes}
          lessons={lessons}
          initial={initial}
          preselectedClassId={preselected}
        />
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Contenido adicional agregado
          </h2>
          <p className="text-sm text-ink-muted">
            <span className="tabular-nums">{extras.length}</span>{" "}
            {extras.length === 1 ? "contenido" : "contenidos"}. Editar uno lo actualiza
            en todos sus grupos al volver a publicarlos.
          </p>
        </div>

        {extras.length === 0 ? (
          <p className="empty">Todavía no has agregado contenido a lecciones existentes.</p>
        ) : (
          <ul className="space-y-3">
            {extras.map((extra) => (
              <li key={extra.id} className="card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    {TYPE_LABEL[extra.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{extraSummary(extra)}</p>
                    <p className="text-xs text-ink-muted">
                      Lección <span className="font-mono">{extra.lesson_code}</span> ·{" "}
                      {extra.lesson_title}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      Grupos: {extra.class_names.join(", ") || "sin asignar"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/contenido-extra?extra=${extra.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Editar
                    </Link>
                    <form action={deleteExtra}>
                      <input type="hidden" name="extraId" value={extra.id} />
                      <button className="btn btn-danger btn-sm">Borrar</button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Contenido de los grupos</h1>
        <p className="page-lead">
          Crea lecciones, ejemplos, ejercicios y evaluaciones para el curso de tus grupos,
          o agrega aportaciones a lecciones existentes.
        </p>
      </header>

      <ContentTabs
        studio={
          <ContentStudio
            groups={studioGroups}
            initialGroupId={preselected}
            initialTopicId={topicId}
          />
        }
        extras={extrasPanel}
        initialTab={tab === "extras" || extraId ? "extras" : "studio"}
      />
    </div>
  );
}
