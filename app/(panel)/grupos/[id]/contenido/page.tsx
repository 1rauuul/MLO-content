import Link from "next/link";

import { BackLink } from "@/app/(panel)/back-link";
import { requireTeacher } from "@/lib/auth";
import { classContentScope, getClassForRead } from "@/lib/classes";
import { db } from "@/lib/db";

type CourseRow = {
  id: string;
  owner_id: string | null;
  is_base: boolean;
  title: string;
};

type UnitRow = {
  id: string;
  course_id: string;
  number: number;
  title: string;
};

type TopicRow = {
  id: string;
  course_id: string;
  unit_id: string;
  title: string;
  position: number;
  unit_number: number;
};

type LessonRow = {
  id: string;
  course_id: string;
  topic_id: string;
  code: string;
  title: string;
  position: number;
};

type ExampleRow = {
  id: string;
  course_id: string;
  topic_id: string;
  lesson_id: string | null;
  type: string;
  title: string;
  position: number;
};

type ExerciseRow = {
  id: string;
  course_id: string;
  topic_id: string;
  lesson_id: string | null;
  type: string;
  prompt: string;
  position: number;
};

type EvaluationRow = {
  id: string;
  course_id: string;
  topic_id: string;
  title: string;
  question_count: number;
  exercise_count: number;
  position: number;
};

const TYPE_LABEL: Record<string, string> = {
  order: "Ordenar",
  fill: "Completar",
  match: "Relacionar",
  crossword: "Crucigrama",
};

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="text-xs tabular-nums text-ink-faint">{count}</span>
      </div>
      <ul className="mt-3 divide-y divide-line border-t border-line">{children}</ul>
    </section>
  );
}

function ContentRow({
  unit,
  topic,
  title,
  note,
  editHref,
  editLabel,
}: {
  unit: string;
  topic: string;
  title: React.ReactNode;
  note?: string;
  editHref?: string;
  editLabel?: string;
}) {
  return (
    <li className="grid gap-3 py-3 text-sm sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_auto] sm:items-start">
      <div className="min-w-0">
        <span className="eyebrow block">Unidad</span>
        <span className="mt-0.5 block text-ink-soft">{unit}</span>
      </div>
      <div className="min-w-0">
        <span className="eyebrow block">Subtema</span>
        <span className="mt-0.5 block text-ink-soft">{topic}</span>
      </div>
      <div className="min-w-0">
        <span className="eyebrow block">Título</span>
        <div className="mt-0.5 text-ink-soft">{title}</div>
        {note && <div className="mt-0.5 text-xs text-ink-faint">{note}</div>}
      </div>
      {editHref && (
        <Link
          href={editHref}
          aria-label={editLabel ? `Editar ${editLabel}` : undefined}
          className="btn btn-secondary btn-sm justify-self-start sm:justify-self-end"
        >
          Editar
        </Link>
      )}
    </li>
  );
}

export default async function GroupContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const klass = await getClassForRead(teacher, id);
  const scope = await classContentScope(klass);

  const [
    courseRows,
    unitRows,
    topicRows,
    lessonRows,
    exampleRows,
    exerciseRows,
    evaluationRows,
  ] = await Promise.all([
    db()<CourseRow[]>`
      select id, owner_id, is_base, title
        from courses
       where id in ${db()(scope)}`,
    db()<UnitRow[]>`
      select id, course_id, number, title
        from units
       where course_id in ${db()(scope)}
         and archived_at is null
       order by number, position, id`,
    db()<TopicRow[]>`
      select t.id, t.course_id, t.unit_id, t.title, t.position,
             u.number as unit_number
        from topics t
        join units u on u.id = t.unit_id
       where t.course_id in ${db()(scope)}
         and t.archived_at is null
         and u.archived_at is null
       order by u.number, t.position, t.id`,
    db()<LessonRow[]>`
      select l.id, l.course_id, l.topic_id, l.code, l.title, l.position
        from lessons l
        join topics t on t.id = l.topic_id
        join units u on u.id = t.unit_id
       where l.course_id in ${db()(scope)}
         and l.archived_at is null
         and t.archived_at is null
         and u.archived_at is null
       order by u.number, t.position, l.position, l.code, l.id`,
    db()<ExampleRow[]>`
      select e.id, e.course_id, e.topic_id, e.lesson_id, e.type, e.title, e.position
        from examples e
        join topics t on t.id = e.topic_id
        join units u on u.id = t.unit_id
       where e.course_id in ${db()(scope)}
         and e.archived_at is null
         and t.archived_at is null
         and u.archived_at is null
       order by u.number, t.position, e.position, e.id`,
    db()<ExerciseRow[]>`
      select x.id, x.course_id, x.topic_id, x.lesson_id, x.type, x.prompt, x.position
        from exercises x
        join topics t on t.id = x.topic_id
        join units u on u.id = t.unit_id
       where x.course_id in ${db()(scope)}
         and x.archived_at is null
         and t.archived_at is null
         and u.archived_at is null
       order by u.number, t.position, x.position, x.id`,
    db()<EvaluationRow[]>`
      select e.id, e.course_id, e.topic_id, e.title, e.question_count,
             e.exercise_count, e.position
        from evaluations e
        join topics t on t.id = e.topic_id
        join units u on u.id = t.unit_id
       where e.course_id in ${db()(scope)}
         and e.archived_at is null
         and t.archived_at is null
         and u.archived_at is null
       order by u.number, t.position, e.position, e.id`,
  ]);

  const courseById = new Map(courseRows.map((course) => [course.id, course]));
  const canEdit = (courseId: string) => {
    const course = courseById.get(courseId);
    return Boolean(
      course &&
        (teacher.role === "admin" ||
          (!course.is_base && course.owner_id === teacher.id)),
    );
  };

  const unitById = new Map(unitRows.map((unit) => [unit.id, unit]));
  const topicsByUnit = new Map<string, TopicRow[]>();
  for (const topic of topicRows) {
    const list = topicsByUnit.get(topic.unit_id) ?? [];
    list.push(topic);
    topicsByUnit.set(topic.unit_id, list);
  }
  const topicLabel = new Map<string, string>();
  const topicUnitLabel = new Map<string, string>();
  const topicNumber = new Map<string, string>();
  for (const [unitId, topics] of topicsByUnit) {
    const unit = unitById.get(unitId);
    topics.forEach((topic, index) => {
      const number = `${unit?.number ?? "?"}.${index + 1}`;
      topicNumber.set(topic.id, number);
      topicLabel.set(topic.id, `${number} · ${topic.title}`);
      topicUnitLabel.set(topic.id, `${unit?.number ?? "?"} · ${unit?.title ?? ""}`);
    });
  }
  const lessonNumber = new Map<string, string>();
  const lessonCountByTopic = new Map<string, number>();
  for (const lesson of lessonRows) {
    const count = (lessonCountByTopic.get(lesson.topic_id) ?? 0) + 1;
    lessonCountByTopic.set(lesson.topic_id, count);
    lessonNumber.set(lesson.id, `${topicNumber.get(lesson.topic_id) ?? "?"}.${count}`);
  }
  const lessonLabel = new Map(
    lessonRows.map((lesson) => [
      lesson.id,
      `${lessonNumber.get(lesson.id) ?? lesson.code} · ${lesson.title}`,
    ]),
  );

  const listPath = `/grupos/${klass.id}/contenido`;
  const volver = encodeURIComponent(listPath);
  const typeLabel = (type: string) => TYPE_LABEL[type] ?? type;
  const total =
    lessonRows.length +
    exampleRows.length +
    exerciseRows.length +
    evaluationRows.length;

  return (
    <div className="space-y-6">
      <header>
        <BackLink href={`/grupos/${klass.id}`}>Volver al grupo</BackLink>
        <h1 className="page-title mt-1">Editar contenido</h1>
        <p className="page-lead">
          Lecciones, ejemplos, ejercicios y evaluaciones de {klass.name}. Los cambios
          se publican cuando publicas el grupo.
        </p>
      </header>

      {total === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">
          Todavía no hay contenido para editar en este grupo.{" "}
          <Link href={`/contenido-extra?classId=${klass.id}`} className="link">
            Agregar contenido
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {lessonRows.length > 0 && (
            <Section title="Lecciones" count={lessonRows.length}>
              {lessonRows.map((lesson) => {
                const number = lessonNumber.get(lesson.id) ?? lesson.code;
                return (
                  <ContentRow
                    key={lesson.id}
                    unit={topicUnitLabel.get(lesson.topic_id) ?? "—"}
                    topic={topicLabel.get(lesson.topic_id) ?? "—"}
                    title={
                      <>
                        <span className="mr-2 font-mono text-xs text-ink-faint">
                          {number}
                        </span>
                        {lesson.title}
                      </>
                    }
                    editHref={
                      canEdit(lesson.course_id)
                        ? `/cursos/${lesson.course_id}/lecciones/${lesson.id}?volver=${volver}`
                        : undefined
                    }
                    editLabel={`${number} ${lesson.title}`}
                  />
                );
              })}
            </Section>
          )}

          {exampleRows.length > 0 && (
            <Section title="Ejemplos" count={exampleRows.length}>
              {exampleRows.map((example) => (
                <ContentRow
                  key={example.id}
                  unit={topicUnitLabel.get(example.topic_id) ?? "—"}
                  topic={topicLabel.get(example.topic_id) ?? "—"}
                  title={
                    <>
                      <span className="badge badge-neutral mr-2">
                        {typeLabel(example.type)}
                      </span>
                      {example.title}
                    </>
                  }
                  note={
                    example.lesson_id
                      ? `Lección ${lessonLabel.get(example.lesson_id) ?? ""}`
                      : undefined
                  }
                  editHref={
                    canEdit(example.course_id)
                      ? `/grupos/${klass.id}/contenido/ejemplos/${example.id}`
                      : undefined
                  }
                  editLabel={example.title}
                />
              ))}
            </Section>
          )}

          {exerciseRows.length > 0 && (
            <Section title="Ejercicios" count={exerciseRows.length}>
              {exerciseRows.map((exercise) => (
                <ContentRow
                  key={exercise.id}
                  unit={topicUnitLabel.get(exercise.topic_id) ?? "—"}
                  topic={topicLabel.get(exercise.topic_id) ?? "—"}
                  title={
                    <>
                      <span className="badge badge-neutral mr-2">
                        {typeLabel(exercise.type)}
                      </span>
                      {exercise.prompt}
                    </>
                  }
                  note={
                    exercise.lesson_id
                      ? `Lección ${lessonLabel.get(exercise.lesson_id) ?? ""}`
                      : undefined
                  }
                  editHref={
                    canEdit(exercise.course_id)
                      ? `/grupos/${klass.id}/contenido/ejercicios/${exercise.id}`
                      : undefined
                  }
                  editLabel={exercise.prompt}
                />
              ))}
            </Section>
          )}

          {evaluationRows.length > 0 && (
            <Section title="Evaluaciones" count={evaluationRows.length}>
              {evaluationRows.map((evaluation) => (
                <ContentRow
                  key={evaluation.id}
                  unit={topicUnitLabel.get(evaluation.topic_id) ?? "—"}
                  topic={topicLabel.get(evaluation.topic_id) ?? "—"}
                  title={evaluation.title}
                  note={`${evaluation.question_count} preguntas · ${evaluation.exercise_count} ejercicios`}
                  editHref={
                    canEdit(evaluation.course_id)
                      ? `/cursos/${evaluation.course_id}/temas/${evaluation.topic_id}/evaluaciones/${evaluation.id}?volver=${volver}`
                      : undefined
                  }
                  editLabel={evaluation.title}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
