import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteQuestion, moveQuestion } from "@/lib/actions/topics";
import { requireTeacher } from "@/lib/auth";
import type { CoreQuestion } from "@/lib/content/model";
import { db } from "@/lib/db";

import { EvaluationEditForm } from "./evaluation-edit-form";
import { QuestionForm } from "./question-form";

type EvaluationRow = {
  id: string;
  content_id: string;
  topic_id: string;
  lesson_id: string;
  title: string;
  description: string;
  position: number;
  course_id: string;
  owner_id: string | null;
  is_base: boolean;
  topic_title: string;
  course_title: string;
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

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ id: string; topicId: string; evaluationId: string }>;
}) {
  const teacher = await requireTeacher();
  const { id: courseId, topicId, evaluationId } = await params;

  const [evaluation] = await db()<EvaluationRow[]>`
    select e.id, e.content_id, e.topic_id, e.lesson_id, e.title, e.description,
           e.position, e.course_id, c.owner_id, c.is_base,
           t.title as topic_title, c.title as course_title
      from evaluations e
      join topics t on t.id = e.topic_id
      join courses c on c.id = e.course_id
     where e.id = ${evaluationId} and e.topic_id = ${topicId}
       and e.course_id = ${courseId} and e.archived_at is null
     limit 1`;
  if (!evaluation) notFound();

  const canEdit =
    teacher.role === "admin" || (!evaluation.is_base && evaluation.owner_id === teacher.id);

  const lessons = await db()<{ id: string; code: string; title: string }[]>`
    select id, code, title from lessons
     where topic_id = ${topicId} and archived_at is null
     order by position, code, id`;
  const exercises = await db()<{ content_id: string; type: string; prompt: string }[]>`
    select content_id, type, prompt from exercises
     where topic_id = ${topicId} and archived_at is null
     order by position, content_id`;
  const selected = await db()<{ exercise_content_id: string }[]>`
    select x.content_id as exercise_content_id
      from evaluation_exercises ee
      join exercises x on x.id = ee.exercise_id
     where ee.evaluation_id = ${evaluation.id}`;
  const questions = await db()<CoreQuestion[]>`
    select content_id, evaluation_id as evaluation_content_id, type, prompt,
           options, answer, config, explanation, position
      from questions
     where evaluation_id = ${evaluation.id} and archived_at is null
     order by position, content_id`;

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/cursos/${courseId}/temas/${topicId}`}
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← {evaluation.topic_title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="page-title">{evaluation.title}</h1>
          <span className="badge badge-neutral">{evaluation.course_title}</span>
          {!canEdit && <span className="badge badge-warning">Solo lectura</span>}
        </div>
      </header>

      {canEdit && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-ink">Editar evaluación</h2>
          <div className="mt-3">
            <EvaluationEditForm
              courseId={courseId}
              topicId={topicId}
              evaluation={{
                id: evaluation.id,
                title: evaluation.title,
                description: evaluation.description,
                lessonId: evaluation.lesson_id,
              }}
              lessons={lessons}
              exercises={exercises.map((exercise) => ({
                content_id: exercise.content_id,
                type: exercise.type,
                title: exercise.prompt,
              }))}
              selected={selected.map((row) => row.exercise_content_id)}
            />
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Preguntas</h2>
        {questions.length === 0 ? (
          <p className="empty">Esta evaluación todavía no tiene preguntas.</p>
        ) : (
          <ul className="space-y-3">
            {questions.map((question) => (
              <li key={question.content_id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-neutral">{question.type}</span>
                  <span className="font-medium text-ink">{question.prompt}</span>
                  <span className="ml-auto font-mono text-xs text-ink-faint">
                    {question.content_id}
                  </span>
                </div>
                {canEdit && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <MoveButtons
                      action={moveQuestion}
                      fields={{
                        courseId,
                        topicId,
                        evaluationId: evaluation.id,
                        itemId: question.content_id,
                      }}
                    />
                    <form action={deleteQuestion}>
                      <input type="hidden" name="courseId" value={courseId} />
                      <input type="hidden" name="topicId" value={topicId} />
                      <input type="hidden" name="evaluationId" value={evaluation.id} />
                      <input type="hidden" name="questionId" value={question.content_id} />
                      <button type="submit" className="btn btn-danger btn-sm">
                        Eliminar
                      </button>
                    </form>
                  </div>
                )}
                {canEdit && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-ink-muted">
                      Editar pregunta
                    </summary>
                    <div className="mt-3">
                      <QuestionForm
                        courseId={courseId}
                        topicId={topicId}
                        evaluationId={evaluation.id}
                        question={question}
                      />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink">Nueva pregunta</h3>
            <QuestionForm
              courseId={courseId}
              topicId={topicId}
              evaluationId={evaluation.id}
            />
          </div>
        )}
      </section>
    </div>
  );
}
