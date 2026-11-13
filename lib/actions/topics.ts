"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireEditableCourse, resolveContentTargets, topicScopeForCourse } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseQuestionInput } from "@/lib/content/validate";

export type TopicResult = { error?: string; ok?: boolean; evaluationId?: string };

function formJson(formData: FormData): unknown {
  try {
    return JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return null;
  }
}

function nextId(prefix: string, ids: string[]): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}-(\\d+)$`);
  let next = 1;
  for (const id of ids) {
    const match = pattern.exec(id);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  return `${prefix}-${next}`;
}

async function editableTopic(courseId: string, topicId: string) {
  const teacher = await requireTeacher();
  const course = await requireEditableCourse(teacher, courseId);
  const scope = await topicScopeForCourse(course);
  const [topic] = await db()<{ id: string; unit_id: string }[]>`
    select id, unit_id from topics
     where id = ${topicId} and course_id in ${db()(scope)} and archived_at is null
     limit 1`;
  return topic ? { teacher, course, topic } : null;
}

function refreshTopic(courseId: string, topicId: string): void {
  revalidatePath(`/cursos/${courseId}`);
  revalidatePath(`/cursos/${courseId}/temas/${topicId}`);
}

export async function createEvaluation(
  _prev: TopicResult,
  formData: FormData,
): Promise<TopicResult> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  const classIds = formData.getAll("classIds").map(String).filter(Boolean);

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (title.length < 3) return { error: "Escribe el título de la evaluación." };

  const targets = await resolveContentTargets(teacher, classIds, courseId, topicId);
  if ("error" in targets) return { error: targets.error };

  let firstEvaluationId = "";
  await db().begin(async (tx) => {
    for (const target of targets) {
      const ids = await tx<{ content_id: string }[]>`
        select content_id from evaluations where course_id = ${target.course.id}`;
      const [next] = await tx<{ position: number }[]>`
        select coalesce(max(position), -1) + 1 as position
          from evaluations where topic_id = ${target.topicId}`;
      const [created] = await tx<{ id: string }[]>`
        insert into evaluations
          (course_id, lesson_id, topic_id, content_id, title, description,
           question_count, exercise_count, position)
        values
          (${target.course.id}, ${null}, ${target.topicId},
           ${nextId("ev", ids.map((row) => row.content_id))}, ${title}, ${description},
           1, 0, ${next.position})
        returning id`;
      if (!firstEvaluationId) firstEvaluationId = created.id;
    }
  });

  for (const target of targets) {
    refreshTopic(target.course.id, target.topicId);
  }
  if (formData.get("stay") === "on") {
    return { ok: true, evaluationId: firstEvaluationId };
  }
  const first = targets[0];
  redirect(
    `/cursos/${first.course.id}/temas/${first.topicId}/evaluaciones/${firstEvaluationId}`,
  );
}

export async function updateEvaluation(
  _prev: TopicResult,
  formData: FormData,
): Promise<TopicResult> {
  const courseId = String(formData.get("courseId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  const evaluationId = String(formData.get("evaluationId") ?? "");
  const scope = await editableTopic(courseId, topicId);
  if (!scope) return { error: "El subtema no existe en este curso." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (title.length < 3) return { error: "Escribe el título de la evaluación." };

  const [evaluation] = await db()<{ id: string }[]>`
    select id from evaluations
     where id = ${evaluationId} and topic_id = ${scope.topic.id}
       and course_id = ${scope.course.id} and archived_at is null
     limit 1`;
  if (!evaluation) return { error: "La evaluación no existe en el subtema." };

  const requested = [
    ...new Set(formData.getAll("exerciseIds").map(String).filter(Boolean)),
  ];
  const available = requested.length
    ? await db()<{ id: string; content_id: string }[]>`
        select id, content_id from exercises
         where course_id = ${scope.course.id}
           and topic_id = ${scope.topic.id}
           and content_id in ${db()(requested)}
           and archived_at is null`
    : [];
  if (available.length !== requested.length) {
    return { error: "Algún ejercicio no pertenece al subtema." };
  }

  await db().begin(async (tx) => {
    await tx`
      update evaluations
         set title = ${title},
             description = ${description},
             exercise_count = ${available.length}
       where id = ${evaluation.id}`;
    await tx`delete from evaluation_exercises where evaluation_id = ${evaluation.id}`;
    for (const exercise of available) {
      await tx`
        insert into evaluation_exercises (evaluation_id, exercise_id)
        values (${evaluation.id}, ${exercise.id})
        on conflict do nothing`;
    }
  });

  refreshTopic(scope.course.id, scope.topic.id);
  return { ok: true };
}

export async function saveQuestion(
  _prev: TopicResult,
  formData: FormData,
): Promise<TopicResult> {
  const courseId = String(formData.get("courseId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  const evaluationId = String(formData.get("evaluationId") ?? "");
  const scope = await editableTopic(courseId, topicId);
  if (!scope) return { error: "El subtema no existe en este curso." };

  const [evaluation] = await db()<{ id: string; lesson_id: string | null }[]>`
    select id, lesson_id from evaluations
     where id = ${evaluationId} and topic_id = ${scope.topic.id}
       and course_id = ${scope.course.id} and archived_at is null
     limit 1`;
  if (!evaluation) return { error: "La evaluación no existe en el subtema." };

  const parsed = parseQuestionInput(formJson(formData), { normalize: true });
  if ("error" in parsed) return { error: parsed.error };
  const input = parsed.value;
  const questionId = String(formData.get("questionId") ?? "");

  if (questionId) {
    const [existing] = await db()<{ id: string }[]>`
      select id from questions
       where content_id = ${questionId} and evaluation_id = ${evaluation.id}
       limit 1`;
    if (!existing) return { error: "La pregunta no existe en esta evaluación." };
    await db()`
      update questions
         set type = ${input.type},
             prompt = ${input.prompt},
             options = ${db().json(input.options)},
             answer = ${input.answer},
             config = ${db().json(input.config)},
             explanation = ${input.explanation}
       where id = ${existing.id}`;
  } else {
    const ids = await db()<{ content_id: string }[]>`
      select content_id from questions where evaluation_id = ${evaluation.id}`;
    const [next] = await db()<{ position: number }[]>`
      select coalesce(max(position), -1) + 1 as position
        from questions where evaluation_id = ${evaluation.id}`;
    await db()`
      insert into questions
        (course_id, lesson_id, evaluation_id, content_id, type, prompt, options,
         answer, config, explanation, position)
      values
        (${scope.course.id}, ${evaluation.lesson_id}, ${evaluation.id},
         ${nextId("q", ids.map((row) => row.content_id))}, ${input.type}, ${input.prompt},
         ${db().json(input.options)}, ${input.answer}, ${db().json(input.config)},
         ${input.explanation}, ${next.position})`;
  }

  const [count] = await db()<{ count: number }[]>`
    select count(*)::int as count from questions where evaluation_id = ${evaluation.id}`;
  await db()`update evaluations
      set question_count = ${Math.max(1, count.count)}
    where id = ${evaluation.id}`;

  refreshTopic(scope.course.id, scope.topic.id);
  revalidatePath(
    `/cursos/${scope.course.id}/temas/${scope.topic.id}/evaluaciones/${evaluation.id}`,
  );
  return { ok: true };
}

export async function deleteQuestion(formData: FormData): Promise<void> {
  const courseId = String(formData.get("courseId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  const evaluationId = String(formData.get("evaluationId") ?? "");
  const scope = await editableTopic(courseId, topicId);
  if (!scope) return;
  const questionId = String(formData.get("questionId") ?? "");

  await db()`
    delete from questions
     where content_id = ${questionId}
       and evaluation_id = ${evaluationId}
       and course_id = ${scope.course.id}`;
  const [count] = await db()<{ count: number }[]>`
    select count(*)::int as count from questions where evaluation_id = ${evaluationId}`;
  await db()`update evaluations
      set question_count = ${Math.max(1, count.count)}
    where id = ${evaluationId}`;
  refreshTopic(scope.course.id, scope.topic.id);
}

async function swapPositions(
  kind: "exercises" | "examples" | "evaluations" | "questions",
  scopeId: string,
  itemId: string,
  direction: string,
): Promise<void> {
  const rows =
    kind === "exercises"
      ? await db()<{ id: string; position: number; content_id: string }[]>`
          select id, position, content_id from exercises
           where topic_id = ${scopeId} and archived_at is null`
      : kind === "examples"
        ? await db()<{ id: string; position: number; content_id: string }[]>`
            select id, position, content_id from examples
             where topic_id = ${scopeId} and archived_at is null`
        : kind === "evaluations"
          ? await db()<{ id: string; position: number; content_id: string }[]>`
              select id, position, content_id from evaluations
               where topic_id = ${scopeId} and archived_at is null`
          : await db()<{ id: string; position: number; content_id: string }[]>`
              select id, position, content_id from questions
               where evaluation_id = ${scopeId} and archived_at is null`;

  rows.sort(
    (left, right) =>
      left.position - right.position || left.content_id.localeCompare(right.content_id),
  );
  const index = rows.findIndex((row) => row.id === itemId);
  const target = index + (direction === "down" ? 1 : -1);
  if (index < 0 || target < 0 || target >= rows.length) return;

  const table =
    kind === "exercises"
      ? "exercises"
      : kind === "examples"
        ? "examples"
        : kind === "evaluations"
          ? "evaluations"
          : "questions";
  await db().begin(async (tx) => {
    if (table === "exercises") {
      await tx`update exercises set position = ${rows[target].position} where id = ${rows[index].id}`;
      await tx`update exercises set position = ${rows[index].position} where id = ${rows[target].id}`;
    } else if (table === "examples") {
      await tx`update examples set position = ${rows[target].position} where id = ${rows[index].id}`;
      await tx`update examples set position = ${rows[index].position} where id = ${rows[target].id}`;
    } else if (table === "evaluations") {
      await tx`update evaluations set position = ${rows[target].position} where id = ${rows[index].id}`;
      await tx`update evaluations set position = ${rows[index].position} where id = ${rows[target].id}`;
    } else {
      await tx`update questions set position = ${rows[target].position} where id = ${rows[index].id}`;
      await tx`update questions set position = ${rows[index].position} where id = ${rows[target].id}`;
    }
  });
}

async function moveActivity(
  formData: FormData,
  kind: "exercises" | "examples" | "evaluations",
): Promise<void> {
  const courseId = String(formData.get("courseId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  const scope = await editableTopic(courseId, topicId);
  if (!scope) return;
  const contentId = String(formData.get("itemId") ?? "");
  const item =
    kind === "exercises"
      ? (
          await db()<{ id: string }[]>`
            select id from exercises
             where content_id = ${contentId} and topic_id = ${scope.topic.id}
               and course_id = ${scope.course.id}
             limit 1`
        )[0]
      : kind === "examples"
        ? (
            await db()<{ id: string }[]>`
              select id from examples
               where content_id = ${contentId} and topic_id = ${scope.topic.id}
                 and course_id = ${scope.course.id}
               limit 1`
          )[0]
        : (
            await db()<{ id: string }[]>`
              select id from evaluations
               where content_id = ${contentId} and topic_id = ${scope.topic.id}
                 and course_id = ${scope.course.id}
               limit 1`
          )[0];
  if (!item) return;
  await swapPositions(kind, scope.topic.id, item.id, String(formData.get("direction") ?? "up"));
  refreshTopic(scope.course.id, scope.topic.id);
}

export async function moveExample(formData: FormData): Promise<void> {
  await moveActivity(formData, "examples");
}

export async function moveExercise(formData: FormData): Promise<void> {
  await moveActivity(formData, "exercises");
}

export async function moveEvaluation(formData: FormData): Promise<void> {
  await moveActivity(formData, "evaluations");
}

export async function moveQuestion(formData: FormData): Promise<void> {
  const courseId = String(formData.get("courseId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  const evaluationId = String(formData.get("evaluationId") ?? "");
  const scope = await editableTopic(courseId, topicId);
  if (!scope) return;
  const [evaluation] = await db()<{ id: string }[]>`
    select id from evaluations
     where id = ${evaluationId} and topic_id = ${scope.topic.id}
       and course_id = ${scope.course.id}
     limit 1`;
  if (!evaluation) return;
  const contentId = String(formData.get("itemId") ?? "");
  const [item] = await db()<{ id: string }[]>`
    select id from questions
     where content_id = ${contentId} and evaluation_id = ${evaluation.id}
     limit 1`;
  if (!item) return;
  await swapPositions(
    "questions",
    evaluation.id,
    item.id,
    String(formData.get("direction") ?? "up"),
  );
  refreshTopic(scope.course.id, scope.topic.id);
}
