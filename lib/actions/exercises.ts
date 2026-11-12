"use server";

import { revalidatePath } from "next/cache";

import { requireEditableCourse, requireEditableLesson, topicScopeForCourse } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ExerciseType } from "@/lib/content/model";
import { parseExampleInput, parseExerciseInput } from "@/lib/content/validate";

export type EditorResult = { error?: string; ok?: boolean };

const TYPE_PREFIX: Record<ExerciseType, string> = {
  order: "ord",
  fill: "fill",
  match: "match",
  crossword: "cross",
};

function nextContentId(prefix: string, ids: string[]): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}-(\\d+)$`);
  let next = 1;
  for (const id of ids) {
    const match = pattern.exec(id);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  return `${prefix}-${next}`;
}

function refresh(courseId: string, topicId: string, lessonId?: string): void {
  if (lessonId) revalidatePath(`/cursos/${courseId}/lecciones/${lessonId}`);
  revalidatePath(`/cursos/${courseId}`);
  revalidatePath(`/cursos/${courseId}/temas/${topicId}`);
}

function formJson(formData: FormData): unknown {
  try {
    return JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return null;
  }
}

type ActivityContext = {
  courseId: string;
  topicId: string;
  lessonId: string | null;
  lessonCode: string;
};

async function editableActivityContext(
  teacher: Awaited<ReturnType<typeof requireTeacher>>,
  formData: FormData,
): Promise<ActivityContext | null> {
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  if (lessonId) {
    const lesson = await requireEditableLesson(teacher, lessonId);
    return {
      courseId: lesson.course_id,
      topicId: lesson.topic_id,
      lessonId: lesson.id,
      lessonCode: lesson.code,
    };
  }

  const courseId = String(formData.get("courseId") ?? "").trim();
  const topicId = String(formData.get("topicId") ?? "").trim();
  if (!courseId || !topicId) return null;
  const course = await requireEditableCourse(teacher, courseId);
  const scope = await topicScopeForCourse(course);
  const [topic] = await db()<{ id: string }[]>`
    select id from topics
     where id = ${topicId} and course_id in ${db()(scope)} and archived_at is null
     limit 1`;
  if (!topic) return null;
  return { courseId: course.id, topicId: topic.id, lessonId: null, lessonCode: "" };
}

export async function saveExercise(
  _prev: EditorResult,
  formData: FormData,
): Promise<EditorResult> {
  const teacher = await requireTeacher();
  const context = await editableActivityContext(teacher, formData);
  if (!context) return { error: "El subtema no existe en este curso." };

  const parsed = parseExerciseInput(formJson(formData), { normalize: true });
  if ("error" in parsed) return { error: parsed.error };
  const input = parsed.value;

  const sql = db();
  const exerciseId = String(formData.get("exerciseId") ?? "");

  if (exerciseId) {
    const rows = await sql<{ content_id: string }[]>`
      select content_id from exercises
       where content_id = ${exerciseId}
         and course_id = ${context.courseId}
         and topic_id = ${context.topicId}
       limit 1`;
    if (!rows[0]) return { error: "El ejercicio no existe en esta lección." };

    await sql`update exercises
         set type = ${input.type},
             prompt = ${input.prompt},
             instructions = ${input.instructions},
             correct_order = ${sql.json(input.correctOrder)},
             config = ${sql.json(input.config)},
             explanation = ${input.explanation},
             example = ${input.example ? sql.json(input.example) : null}
       where content_id = ${exerciseId}
         and course_id = ${context.courseId}
         and topic_id = ${context.topicId}`;
  } else {
    const ids = await sql<{ content_id: string }[]>`
      select content_id from exercises where course_id = ${context.courseId}`;
    const contentId = nextContentId(
      `${TYPE_PREFIX[input.type]}${context.lessonCode || "topic"}`,
      ids.map((row) => row.content_id),
    );
    const [next] = await sql<{ position: number }[]>`
      select coalesce(max(position), -1) + 1 as position
        from exercises
       where topic_id = ${context.topicId}`;

    await sql`insert into exercises
        (course_id, lesson_id, topic_id, content_id, type, prompt, instructions,
         correct_order, config, explanation, example, position)
      values
        (${context.courseId}, ${context.lessonId}, ${context.topicId}, ${contentId},
         ${input.type}, ${input.prompt}, ${input.instructions},
         ${sql.json(input.correctOrder)}, ${sql.json(input.config)},
         ${input.explanation}, ${input.example ? sql.json(input.example) : null},
         ${next.position})`;
  }

  refresh(context.courseId, context.topicId, context.lessonId ?? undefined);
  return { ok: true };
}

export async function deleteExercise(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const context = await editableActivityContext(teacher, formData);
  if (!context) return;
  const id = String(formData.get("exerciseId") ?? "");

  await db()`delete from exercises
    where content_id = ${id} and course_id = ${context.courseId} and topic_id = ${context.topicId}`;
  refresh(context.courseId, context.topicId, context.lessonId ?? undefined);
}

export async function saveExample(
  _prev: EditorResult,
  formData: FormData,
): Promise<EditorResult> {
  const teacher = await requireTeacher();
  const context = await editableActivityContext(teacher, formData);
  if (!context) return { error: "El subtema no existe en este curso." };

  const raw = formJson(formData);
  const orderExample =
    typeof raw === "object" && raw !== null && (raw as { type?: unknown }).type === "order";
  if (orderExample) {
    if (String(formData.get("exampleId") ?? "")) {
      return { error: "Crea un nuevo ejemplo de ordenar; los existentes no cambian de tipo." };
    }
    const value = raw as Record<string, unknown>;
    const parsedExercise = parseExerciseInput(
      {
        ...value,
        instructions: "",
        example: {
          title: value.title,
          steps: value.steps,
          hints: value.hints,
        },
      },
      { normalize: true },
    );
    if ("error" in parsedExercise) return { error: parsedExercise.error };
    const input = parsedExercise.value;
    const sql = db();
    const ids = await sql<{ content_id: string }[]>`
      select content_id from exercises where course_id = ${context.courseId}`;
    const [next] = await sql<{ position: number }[]>`
      select coalesce(max(position), -1) + 1 as position
        from exercises where topic_id = ${context.topicId}`;
    const contentId = nextContentId(
      `${TYPE_PREFIX.order}${context.lessonCode || "topic"}`,
      ids.map((row) => row.content_id),
    );
    await sql`insert into exercises
        (course_id, lesson_id, topic_id, content_id, type, prompt, instructions,
         correct_order, config, explanation, example, position)
      values
        (${context.courseId}, ${context.lessonId}, ${context.topicId}, ${contentId},
         ${input.type}, ${input.prompt}, ${input.instructions},
         ${sql.json(input.correctOrder)}, ${sql.json(input.config)}, ${input.explanation},
         ${input.example ? sql.json(input.example) : null}, ${next.position})`;
    refresh(context.courseId, context.topicId, context.lessonId ?? undefined);
    return { ok: true };
  }

  const parsed = parseExampleInput(raw, { normalize: true });
  if ("error" in parsed) return { error: parsed.error };
  const input = parsed.value;

  const sql = db();
  const exampleId = String(formData.get("exampleId") ?? "");
  const alsoExercise = formData.get("alsoExercise") === "on";

  if (exampleId) {
    const rows = await sql<{ content_id: string }[]>`
      select content_id from examples
       where content_id = ${exampleId}
         and course_id = ${context.courseId}
         and topic_id = ${context.topicId}
       limit 1`;
    if (!rows[0]) return { error: "El ejemplo no existe en esta lección." };

    await sql`update examples
         set type = ${input.type},
             title = ${input.title},
             prompt = ${input.prompt},
             config = ${sql.json(input.config)},
             steps = ${sql.json(input.steps)},
             hints = ${sql.json(input.hints)},
             explanation = ${input.explanation}
       where content_id = ${exampleId}
         and course_id = ${context.courseId}
         and topic_id = ${context.topicId}`;
  } else {
    const ids = await sql<{ content_id: string }[]>`
      select content_id from examples where course_id = ${context.courseId}`;
    const contentId = nextContentId(
      `ex${context.lessonCode || "topic"}`,
      ids.map((row) => row.content_id),
    );
    const [next] = await sql<{ position: number }[]>`
      select coalesce(max(position), -1) + 1 as position
        from examples
       where topic_id = ${context.topicId}`;

    await sql`insert into examples
        (course_id, lesson_id, topic_id, content_id, type, title, prompt, config,
         steps, hints, explanation, position)
      values
        (${context.courseId}, ${context.lessonId}, ${context.topicId}, ${contentId},
         ${input.type}, ${input.title}, ${input.prompt}, ${sql.json(input.config)},
         ${sql.json(input.steps)}, ${sql.json(input.hints)}, ${input.explanation},
         ${next.position})`;

    if (alsoExercise) {
      const exerciseIds = await sql<{ content_id: string }[]>`
        select content_id from exercises where course_id = ${context.courseId}`;
      const [exercisePosition] = await sql<{ position: number }[]>`
        select coalesce(max(position), -1) + 1 as position
          from exercises where topic_id = ${context.topicId}`;
      const exerciseContentId = nextContentId(
        `${TYPE_PREFIX[input.type]}${context.lessonCode || "topic"}`,
        exerciseIds.map((row) => row.content_id),
      );
      await sql`insert into exercises
          (course_id, lesson_id, topic_id, content_id, type, prompt, instructions,
           correct_order, config, explanation, example, position)
        values
          (${context.courseId}, ${context.lessonId}, ${context.topicId}, ${exerciseContentId},
           ${input.type}, ${input.prompt}, ${""}, ${sql.json([])}, ${sql.json(input.config)},
           ${input.explanation},
           ${sql.json({ title: input.title, steps: input.steps, hints: input.hints })},
           ${exercisePosition.position})`;
    }
  }

  refresh(context.courseId, context.topicId, context.lessonId ?? undefined);
  return { ok: true };
}

export async function deleteExample(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const context = await editableActivityContext(teacher, formData);
  if (!context) return;
  const id = String(formData.get("exampleId") ?? "");

  await db()`delete from examples
    where content_id = ${id} and course_id = ${context.courseId} and topic_id = ${context.topicId}`;
  refresh(context.courseId, context.topicId, context.lessonId ?? undefined);
}
