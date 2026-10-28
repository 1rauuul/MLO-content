"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getBaseCourseId, requireEditableCourse } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { parseBlocks } from "@/lib/content";
import { db } from "@/lib/db";
import { newCourseKey } from "@/lib/ids";

export type ActionResult = { error?: string };
export type LessonResult = { error?: string; ok?: boolean };

export async function createCourse(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const title = String(formData.get("title") ?? "").trim();

  if (title.length < 3) return { error: "Escribe un título de al menos 3 caracteres." };
  if (title.length > 80) return { error: "El título no puede pasar de 80 caracteres." };

  let courseId: string | null = null;
  for (let attempt = 0; attempt < 5 && !courseId; attempt += 1) {
    try {
      const rows = await db()<{ id: string }[]>`
        insert into courses (key, title, owner_id)
        values (${newCourseKey()}, ${title}, ${teacher.id})
        returning id`;
      courseId = rows[0].id;
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") throw error;
    }
  }

  if (!courseId) {
    return { error: "No se pudo generar la clave del curso. Inténtalo de nuevo." };
  }

  revalidatePath("/mis-cursos");
  redirect(`/cursos/${courseId}`);
}

export async function createUnit(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const difficulty = String(formData.get("difficulty") ?? "");
  const color = String(formData.get("color") ?? "");

  if (title.length < 3) return { error: "Escribe el título de la unidad." };
  if (!["Fundamental", "Intermedio", "Avanzado"].includes(difficulty)) {
    return { error: "Elige una dificultad válida." };
  }
  if (!["blue", "violet", "green"].includes(color)) {
    return { error: "Elige un color válido." };
  }

  const coreId = (await getBaseCourseId()) ?? course.id;
  const rows = await db()<{ number: number }[]>`
    select coalesce(max(number), 0) + 1 as number
      from units
     where course_id in (${course.id}, ${coreId})`;

  const number = rows[0].number;

  try {
    await db()`insert into units
        (course_id, content_id, number, title, description, difficulty, color, position)
      values
        (${course.id}, ${`u${number}`}, ${number}, ${title}, ${description},
         ${difficulty}, ${color}, ${number})`;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: `La unidad ${number} ya existe en el curso.` };
    }
    throw error;
  }

  revalidatePath(`/cursos/${courseId}`);
  return {};
}

export async function createLesson(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  const title = String(formData.get("title") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  if (title.length < 3) return { error: "Escribe el título de la lección." };
  if (!/^\d+(\.\d+)?$/.test(code)) {
    return { error: "Usa un código como 1.5 o 6." };
  }

  const coreId = (await getBaseCourseId()) ?? course.id;

  const unit = await db()<{ id: string }[]>`
    select id
      from units
     where id = ${unitId}
       and course_id in (${course.id}, ${coreId})
       and archived_at is null
     limit 1`;

  if (!unit[0]) return { error: "La unidad no existe en este curso." };

  const contentId = `l${code}`;
  const clash = await db()<{ id: string }[]>`
    select id
      from lessons
     where course_id in (${course.id}, ${coreId})
       and content_id = ${contentId}
     limit 1`;

  if (clash[0]) return { error: `Ya existe una lección con el código ${code}.` };

  const positions = await db()<{ position: number }[]>`
    select coalesce(max(position), -1) + 1 as position
      from lessons
     where unit_id = ${unitId}`;

  await db()`insert into lessons
      (course_id, unit_id, content_id, code, title, position)
    values
      (${course.id}, ${unitId}, ${contentId}, ${code}, ${title}, ${positions[0].position})`;

  revalidatePath(`/cursos/${courseId}`);
  return {};
}

export async function updateLesson(
  _prev: LessonResult,
  formData: FormData,
): Promise<LessonResult> {
  const teacher = await requireTeacher();
  const lessonId = String(formData.get("lessonId") ?? "");

  const rows = await db()<{ id: string; course_id: string; owner_id: string | null }[]>`
    select l.id, l.course_id, c.owner_id
      from lessons l
      join courses c on c.id = l.course_id
     where l.id = ${lessonId}
     limit 1`;

  const lesson = rows[0];
  if (!lesson) return { error: "La lección no existe." };
  if (teacher.role !== "admin" && lesson.owner_id !== teacher.id) {
    return { error: "No puedes editar esta lección." };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3) return { error: "Escribe el título de la lección." };

  const parsed = parseBlocks(String(formData.get("content") ?? ""));
  if ("error" in parsed) return { error: parsed.error };

  const synthesis = String(formData.get("synthesis") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sql = db();
  await sql`update lessons
       set title = ${title},
           eyebrow = ${String(formData.get("eyebrow") ?? "").trim()},
           body = ${String(formData.get("body") ?? "").trim()},
           code_sample = ${String(formData.get("codeSample") ?? "").trim()},
           context_title = ${String(formData.get("contextTitle") ?? "").trim()},
           context_body = ${String(formData.get("contextBody") ?? "").trim()},
           synthesis = ${sql.json(synthesis)},
           content = ${sql.json(parsed.blocks)}
     where id = ${lessonId}`;

  revalidatePath(`/cursos/${lesson.course_id}`);
  revalidatePath(`/cursos/${lesson.course_id}/lecciones/${lessonId}`);
  return { ok: true };
}
