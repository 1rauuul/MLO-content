"use server";

import { revalidatePath } from "next/cache";

import { requireEditableLesson } from "@/lib/access";
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

function refresh(courseId: string, lessonId: string): void {
  revalidatePath(`/cursos/${courseId}/lecciones/${lessonId}`);
  revalidatePath(`/cursos/${courseId}`);
}

function formJson(formData: FormData): unknown {
  try {
    return JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return null;
  }
}

export async function saveExercise(
  _prev: EditorResult,
  formData: FormData,
): Promise<EditorResult> {
  const teacher = await requireTeacher();
  const lessonId = String(formData.get("lessonId") ?? "");
  const lesson = await requireEditableLesson(teacher, lessonId);

  const parsed = parseExerciseInput(formJson(formData), { normalize: true });
  if ("error" in parsed) return { error: parsed.error };
  const input = parsed.value;

  const sql = db();
  const exerciseId = String(formData.get("exerciseId") ?? "");

  if (exerciseId) {
    const rows = await sql<{ content_id: string }[]>`
      select content_id from exercises
       where content_id = ${exerciseId} and lesson_id = ${lesson.id}
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
       where content_id = ${exerciseId} and lesson_id = ${lesson.id}`;
  } else {
    const ids = await sql<{ content_id: string }[]>`
      select content_id from exercises where lesson_id = ${lesson.id}`;
    const contentId = nextContentId(
      `${TYPE_PREFIX[input.type]}${lesson.code}`,
      ids.map((row) => row.content_id),
    );
    const [next] = await sql<{ position: number }[]>`
      select coalesce(max(position), -1) + 1 as position
        from exercises
       where lesson_id = ${lesson.id}`;

    await sql`insert into exercises
        (course_id, lesson_id, content_id, type, prompt, instructions,
         correct_order, config, explanation, example, position)
      values
        (${lesson.course_id}, ${lesson.id}, ${contentId}, ${input.type},
         ${input.prompt}, ${input.instructions}, ${sql.json(input.correctOrder)},
         ${sql.json(input.config)}, ${input.explanation},
         ${input.example ? sql.json(input.example) : null}, ${next.position})`;
  }

  refresh(lesson.course_id, lesson.id);
  return { ok: true };
}

export async function deleteExercise(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const lesson = await requireEditableLesson(
    teacher,
    String(formData.get("lessonId") ?? ""),
  );
  const id = String(formData.get("exerciseId") ?? "");

  await db()`delete from exercises where content_id = ${id} and lesson_id = ${lesson.id}`;
  refresh(lesson.course_id, lesson.id);
}

export async function saveExample(
  _prev: EditorResult,
  formData: FormData,
): Promise<EditorResult> {
  const teacher = await requireTeacher();
  const lessonId = String(formData.get("lessonId") ?? "");
  const lesson = await requireEditableLesson(teacher, lessonId);

  const parsed = parseExampleInput(formJson(formData), { normalize: true });
  if ("error" in parsed) return { error: parsed.error };
  const input = parsed.value;

  const sql = db();
  const exampleId = String(formData.get("exampleId") ?? "");

  if (exampleId) {
    const rows = await sql<{ content_id: string }[]>`
      select content_id from examples
       where content_id = ${exampleId} and lesson_id = ${lesson.id}
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
       where content_id = ${exampleId} and lesson_id = ${lesson.id}`;
  } else {
    const ids = await sql<{ content_id: string }[]>`
      select content_id from examples where lesson_id = ${lesson.id}`;
    const contentId = nextContentId(`ex${lesson.code}`, ids.map((row) => row.content_id));
    const [next] = await sql<{ position: number }[]>`
      select coalesce(max(position), -1) + 1 as position
        from examples
       where lesson_id = ${lesson.id}`;

    await sql`insert into examples
        (course_id, lesson_id, content_id, type, title, prompt, config, steps,
         hints, explanation, position)
      values
        (${lesson.course_id}, ${lesson.id}, ${contentId}, ${input.type},
         ${input.title}, ${input.prompt}, ${sql.json(input.config)},
         ${sql.json(input.steps)}, ${sql.json(input.hints)}, ${input.explanation},
         ${next.position})`;
  }

  refresh(lesson.course_id, lesson.id);
  return { ok: true };
}

export async function deleteExample(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const lesson = await requireEditableLesson(
    teacher,
    String(formData.get("lessonId") ?? ""),
  );
  const id = String(formData.get("exampleId") ?? "");

  await db()`delete from examples where content_id = ${id} and lesson_id = ${lesson.id}`;
  refresh(lesson.course_id, lesson.id);
}
