"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getBaseCourseId, requireEditableCourse, resolveContentTargets } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { parseBlocks } from "@/lib/content";
import { publishCourse } from "@/lib/content/publish";
import { UNIT_COLORS } from "@/lib/content/unit-colors";
import { editorCourseIds } from "@/lib/content/x03";
import { db } from "@/lib/db";
import { newCourseKey } from "@/lib/ids";

export type ActionResult = { error?: string; ok?: boolean };
export type LessonResult = { error?: string; ok?: boolean };

export async function createCourse(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const level = String(formData.get("level") ?? "Fundamental");
  const usesBase = formData.get("usesBase") === "on";

  if (title.length < 3) return { error: "Escribe un título de al menos 3 caracteres." };
  if (title.length > 80) return { error: "El título no puede pasar de 80 caracteres." };
  if (description.length > 500) {
    return { error: "La descripción no puede pasar de 500 caracteres." };
  }
  if (!["Fundamental", "Intermedio", "Avanzado"].includes(level)) {
    return { error: "Elige un nivel válido." };
  }

  let courseId: string | null = null;
  for (let attempt = 0; attempt < 5 && !courseId; attempt += 1) {
    try {
      const rows = await db()<{ id: string }[]>`
        insert into courses (key, title, description, level, owner_id, uses_base, status)
        values (${newCourseKey()}, ${title}, ${description}, ${level}, ${teacher.id}, ${usesBase}, 'draft')
        returning id`;
      courseId = rows[0].id;
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") throw error;
    }
  }

  if (!courseId) {
    return { error: "No se pudo generar la clave del curso. Inténtalo de nuevo." };
  }

  try {
    const course = await requireEditableCourse(teacher, courseId);
    await publishCourse(teacher, course);
  } catch (error) {
    // El alta es todo o nada: si no se puede publicar, no queda un borrador.
    await db()`delete from courses where id = ${courseId}`;
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo publicar el curso. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/mis-cursos");
  revalidatePath(`/cursos/${courseId}`);
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
  if (!(UNIT_COLORS as readonly string[]).includes(color)) {
    return { error: "Elige un color válido." };
  }

  const scope = editorCourseIds(
    course.is_group,
    course.id,
    await getBaseCourseId(),
  );
  const rows = await db()<{ number: number }[]>`
    select coalesce(max(number), 0) + 1 as number
      from units
     where course_id in ${db()(scope)}`;

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
  const topicId = String(formData.get("topicId") ?? "");
  const classIds = formData.getAll("classIds").map(String).filter(Boolean);

  const title = String(formData.get("title") ?? "").trim();
  const rawContent = String(formData.get("content") ?? "[]").trim();
  const parsed = parseBlocks(rawContent);

  if (title.length < 3) return { error: "Escribe el título de la lección." };
  if ("error" in parsed) return { error: parsed.error };

  const targets = await resolveContentTargets(teacher, classIds, courseId, topicId);
  if ("error" in targets) return { error: targets.error };

  const baseId = await getBaseCourseId();
  try {
    await db().begin(async (tx) => {
      for (const target of targets) {
        const scope = editorCourseIds(target.course.is_group, target.course.id, baseId);
        const existingCodes = await tx<{ code: string }[]>`
          select code
            from lessons
           where course_id in ${tx(scope)}`;
        const prefix = `${target.unitNumber}.`;
        const usedCodes = new Set(existingCodes.map((lesson) => lesson.code));
        let sequence = 1;
        while (usedCodes.has(`${prefix}${sequence}`)) sequence += 1;
        const code = `${prefix}${sequence}`;

        const contentId = `l${code}`;
        const clash = await tx<{ id: string }[]>`
          select id
            from lessons
           where course_id in ${tx(scope)}
             and content_id = ${contentId}
           limit 1`;
        if (clash[0]) {
          throw new Error(`Ya existe una lección con el código ${code}.`);
        }

        const [positions] = await tx<{ position: number }[]>`
          select coalesce(max(position), -1) + 1 as position
            from lessons
           where topic_id = ${target.topicId}`;

        await tx`insert into lessons
            (course_id, unit_id, topic_id, content_id, code, title, content, position)
          values
            (${target.course.id}, ${target.unitId}, ${target.topicId}, ${contentId},
             ${code}, ${title}, ${tx.json(parsed.blocks)},
             ${positions.position})`;
      }
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se pudo crear la lección.",
    };
  }

  for (const target of targets) {
    revalidatePath(`/cursos/${target.course.id}`);
    revalidatePath(`/cursos/${target.course.id}/temas/${target.topicId}`);
  }
  return { ok: true };
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

function nextTopicContentId(ids: string[]): string {
  let next = 1;
  for (const id of ids) {
    const match = /^t-(\d+)$/.exec(id);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  return `t-${next}`;
}

export async function createTopic(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (title.length < 3) return { error: "Escribe el título del subtema." };

  const scope = editorCourseIds(
    course.is_group,
    course.id,
    await getBaseCourseId(),
  );
  const unit = await db()<{ id: string }[]>`
    select id from units
     where id = ${unitId}
       and course_id in ${db()(scope)}
       and archived_at is null
     limit 1`;
  if (!unit[0]) return { error: "La unidad no existe en este curso." };

  const ids = await db()<{ content_id: string }[]>`
    select content_id from topics where course_id = ${course.id}`;
  const [next] = await db()<{ position: number }[]>`
    select coalesce(max(position), -1) + 1 as position
      from topics
     where unit_id = ${unitId}
       and course_id in ${db()(scope)}`;

  await db()`insert into topics
      (course_id, unit_id, content_id, title, summary, position)
    values
      (${course.id}, ${unitId}, ${nextTopicContentId(ids.map((row) => row.content_id))},
       ${title}, ${summary}, ${next.position})`;

  revalidatePath(`/cursos/${courseId}`);
  return {};
}

export async function updateTopic(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (title.length < 3) return { error: "Escribe el título del subtema." };

  const existing = await db()<{ id: string }[]>`
    select id from topics
     where id = ${topicId} and course_id = ${course.id}
     limit 1`;
  if (!existing[0]) return { error: "El subtema no existe en este curso." };

  await db()`
    update topics
       set title = ${title}, summary = ${summary}
     where id = ${topicId}`;

  revalidatePath(`/cursos/${courseId}`);
  revalidatePath(`/cursos/${courseId}/temas/${topicId}`);
  return {};
}

export async function moveUnit(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  const direction = String(formData.get("direction") ?? "up");
  const course = await requireEditableCourse(teacher, courseId);

  const rows = await db()<{ id: string; number: number }[]>`
    select id, number from units
     where course_id = ${course.id} and archived_at is null
     order by number, position, id`;
  const index = rows.findIndex((row) => row.id === unitId);
  const target = index + (direction === "down" ? 1 : -1);
  if (index < 0 || target < 0 || target >= rows.length) return;

  await db().begin(async (tx) => {
    await tx`update units set number = ${rows[target].number} where id = ${rows[index].id}`;
    await tx`update units set number = ${rows[index].number} where id = ${rows[target].id}`;
  });
  revalidatePath(`/cursos/${courseId}`);
}

export async function moveTopic(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const topicId = String(formData.get("topicId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  const [topic] = await db()<{ unit_id: string }[]>`
    select unit_id from topics
     where id = ${topicId} and course_id = ${course.id}
     limit 1`;
  if (!topic) return;

  const rows = await db()<{ id: string; position: number }[]>`
    select id, position from topics
     where course_id = ${course.id} and unit_id = ${topic.unit_id}
       and archived_at is null
     order by position, id`;
  const index = rows.findIndex((row) => row.id === topicId);
  const direction = String(formData.get("direction") ?? "up");
  const target = index + (direction === "down" ? 1 : -1);
  if (index < 0 || target < 0 || target >= rows.length) return;

  await db().begin(async (tx) => {
    await tx`update topics set position = ${rows[target].position} where id = ${rows[index].id}`;
    await tx`update topics set position = ${rows[index].position} where id = ${rows[target].id}`;
  });
  revalidatePath(`/cursos/${courseId}`);
}

export async function moveLesson(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  const [lesson] = await db()<{ topic_id: string }[]>`
    select topic_id from lessons
     where id = ${lessonId} and course_id = ${course.id}
     limit 1`;
  if (!lesson) return;

  const rows = await db()<{ id: string; position: number }[]>`
    select id, position from lessons
     where topic_id = ${lesson.topic_id} and archived_at is null
     order by position, code, id`;
  const index = rows.findIndex((row) => row.id === lessonId);
  const direction = String(formData.get("direction") ?? "up");
  const target = index + (direction === "down" ? 1 : -1);
  if (index < 0 || target < 0 || target >= rows.length) return;

  await db().begin(async (tx) => {
    await tx`update lessons set position = ${rows[target].position} where id = ${rows[index].id}`;
    await tx`update lessons set position = ${rows[index].position} where id = ${rows[target].id}`;
  });
  revalidatePath(`/cursos/${courseId}`);
  revalidatePath(`/cursos/${courseId}/temas/${lesson.topic_id}`);
}
