import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/app/(panel)/back-link";
import { moveLesson } from "@/lib/actions/content";
import {
  moveEvaluation,
  moveExample,
  moveExercise,
} from "@/lib/actions/topics";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";

import { CreateEvaluationForm } from "./create-evaluation-form";
import { CreateLessonForm } from "../../lesson-form";
import { TopicEditForm } from "./topic-edit-form";

type TopicRow = {
  id: string;
  course_id: string;
  unit_id: string;
  title: string;
  summary: string;
  course_title: string;
  unit_title: string;
  owner_id: string | null;
  is_base: boolean;
};

type LessonRow = { id: string; code: string; title: string; position: number };
type ActivityRow = {
  id: string;
  content_id: string;
  lesson_code: string | null;
  type: string;
  title: string;
  position: number;
};
type EvaluationRow = {
  id: string;
  content_id: string;
  title: string;
  position: number;
  question_count: number;
  exercise_count: number;
};

function MoveButtons({
  action,
  fields,
}: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
}) {
  return (
    <span className="flex items-center gap-1">
      {(["up", "down"] as const).map((direction) => (
        <form action={action} key={direction}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="direction" value={direction} />
          <button type="submit" className="btn btn-ghost btn-sm" aria-label={`Mover ${direction}`}>
            {direction === "up" ? "↑" : "↓"}
          </button>
        </form>
      ))}
    </span>
  );
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string; topicId: string }>;
}) {
  const teacher = await requireTeacher();
  const { id: courseId, topicId } = await params;

  const [topic] = await db()<TopicRow[]>`
    select t.id, t.course_id, t.unit_id, t.title, t.summary,
           c.title as course_title, u.title as unit_title, c.owner_id, c.is_base
      from topics t
      join units u on u.id = t.unit_id
      join courses c on c.id = t.course_id
     where t.id = ${topicId} and t.course_id = ${courseId}
       and t.archived_at is null
     limit 1`;
  if (!topic) notFound();

  const canEdit =
    teacher.role === "admin" || (!topic.is_base && topic.owner_id === teacher.id);

  const lessons = await db()<LessonRow[]>`
    select id, code, title, position
      from lessons
     where topic_id = ${topic.id} and archived_at is null
     order by position, code, id`;
  const examples = await db()<ActivityRow[]>`
    select e.id, e.content_id, l.code as lesson_code, e.type, e.title, e.position
      from examples e
      left join lessons l on l.id = e.lesson_id
     where e.topic_id = ${topic.id} and e.archived_at is null
     order by e.position, e.content_id`;
  const exercises = await db()<ActivityRow[]>`
    select x.id, x.content_id, l.code as lesson_code, x.type, x.prompt as title, x.position
      from exercises x
      left join lessons l on l.id = x.lesson_id
     where x.topic_id = ${topic.id} and x.archived_at is null
     order by x.position, x.content_id`;
  const evaluations = await db()<EvaluationRow[]>`
    select e.id, e.content_id, e.title, e.position, e.question_count,
           (select count(*)::int from evaluation_exercises ee
             where ee.evaluation_id = e.id) as exercise_count
      from evaluations e
     where e.topic_id = ${topic.id} and e.archived_at is null
     order by e.position, e.content_id`;

  return (
    <div className="space-y-6">
      <header>
        <BackLink href={`/cursos/${courseId}`}>{topic.course_title}</BackLink>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="page-title">{topic.title}</h1>
          <span className="badge badge-neutral">{topic.unit_title}</span>
          {!canEdit && <span className="badge badge-warning">Solo lectura</span>}
        </div>
        {topic.summary && <p className="page-lead">{topic.summary}</p>}
      </header>

      {canEdit && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-ink">Editar subtema</h2>
          <div className="mt-3">
            <TopicEditForm
              courseId={courseId}
              topic={{ id: topic.id, title: topic.title, summary: topic.summary }}
            />
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Lecciones</h2>
        {lessons.length === 0 ? (
          <p className="empty mt-3">Este subtema todavía no tiene lecciones.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {lessons.map((lesson) => (
              <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <Link
                  href={`/cursos/${courseId}/lecciones/${lesson.id}`}
                  className="text-ink-soft underline-offset-4 hover:underline"
                >
                  <span className="mr-2 font-mono text-xs text-ink-faint">{lesson.code}</span>
                  {lesson.title}
                </Link>
                {canEdit && (
                  <MoveButtons
                    action={moveLesson}
                    fields={{ courseId, lessonId: lesson.id }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && <CreateLessonForm courseId={courseId} topicId={topic.id} />}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Ejemplos</h2>
        <p className="mt-1 text-sm text-ink-muted">El subtema los publica ordenados.</p>
        {examples.length === 0 ? (
          <p className="empty mt-3">Todavía no hay ejemplos en este subtema.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {examples.map((example) => (
              <li key={example.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="text-ink-soft">
                  <span className="badge badge-neutral mr-2">{example.type}</span>
                  {example.title}
                  {example.lesson_code && (
                    <span className="ml-2 font-mono text-xs text-ink-faint">{example.lesson_code}</span>
                  )}
                </span>
                {canEdit && (
                  <MoveButtons
                    action={moveExample}
                    fields={{ courseId, topicId: topic.id, itemId: example.content_id }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Ejercicios</h2>
        <p className="mt-1 text-sm text-ink-muted">El subtema los publica ordenados.</p>
        {exercises.length === 0 ? (
          <p className="empty mt-3">Todavía no hay ejercicios en este subtema.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {exercises.map((exercise) => (
              <li key={exercise.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="text-ink-soft">
                  <span className="badge badge-neutral mr-2">{exercise.type}</span>
                  {exercise.title}
                  {exercise.lesson_code && (
                    <span className="ml-2 font-mono text-xs text-ink-faint">{exercise.lesson_code}</span>
                  )}
                </span>
                {canEdit && (
                  <MoveButtons
                    action={moveExercise}
                    fields={{ courseId, topicId: topic.id, itemId: exercise.content_id }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Evaluaciones</h2>
        {evaluations.length === 0 ? (
          <p className="empty mt-3">Todavía no hay evaluaciones en este subtema.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {evaluations.map((evaluation) => (
              <li key={evaluation.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <Link
                  href={`/cursos/${courseId}/temas/${topic.id}/evaluaciones/${evaluation.id}`}
                  className="text-ink-soft underline-offset-4 hover:underline"
                >
                  {evaluation.title}
                  <span className="ml-2 text-xs text-ink-faint">
                    {evaluation.question_count} preguntas · {evaluation.exercise_count} ejercicios
                  </span>
                </Link>
                {canEdit && (
                  <MoveButtons
                    action={moveEvaluation}
                    fields={{ courseId, topicId: topic.id, itemId: evaluation.content_id }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <CreateEvaluationForm
            courseId={courseId}
            topicId={topic.id}
          />
        )}
      </section>
    </div>
  );
}
