"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTeacher } from "@/lib/auth";
import { publishClassRelease, requireEditableClass } from "@/lib/classes";
import { isExtraType, parseExtraPayload } from "@/lib/content/classes";
import { db } from "@/lib/db";
import { newJoinCode } from "@/lib/ids";

export type ClassResult = { error?: string };
export type ExtraResult = { error?: string; ok?: boolean };
export type PublishClassResult = {
  error?: string;
  ok?: boolean;
  version?: number;
  hash?: string;
  extras?: number;
};

function parseJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return null;
  }
}

export async function createClass(
  _prev: ClassResult,
  formData: FormData,
): Promise<ClassResult> {
  const teacher = await requireTeacher();
  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 3) return { error: "Escribe un nombre de al menos 3 caracteres." };
  if (name.length > 80) return { error: "El nombre no puede pasar de 80 caracteres." };

  let classId: string | null = null;
  for (let attempt = 0; attempt < 5 && !classId; attempt += 1) {
    try {
      const rows = await db()<{ id: string }[]>`
        insert into classes (teacher_id, name, join_code)
        values (${teacher.id}, ${name}, ${newJoinCode()})
        returning id`;
      classId = rows[0].id;
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") throw error;
    }
  }

  if (!classId) {
    return { error: "No se pudo generar el código de la clase. Inténtalo de nuevo." };
  }

  revalidatePath("/clases");
  redirect(`/clases/${classId}`);
}

export async function saveExtra(
  _prev: ExtraResult,
  formData: FormData,
): Promise<ExtraResult> {
  const teacher = await requireTeacher();
  const extraId = String(formData.get("extraId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const type = String(formData.get("type") ?? "");
  const classIds = [...new Set(formData.getAll("classIds").map(String).filter(Boolean))];

  if (!isExtraType(type)) return { error: "Elige un tipo de contenido válido." };
  if (classIds.length === 0) return { error: "Elige al menos una clase." };

  const sql = db();
  const [lesson] = await sql<{ id: string }[]>`
    select l.id
      from lessons l
      join courses c on c.id = l.course_id
     where l.id = ${lessonId}
       and c.is_base
       and l.archived_at is null
     limit 1`;
  if (!lesson) return { error: "Elige una lección existente del curso base." };

  const allowed = await sql<{ id: string }[]>`
    select id
      from classes
     where id in ${sql(classIds)}
       and (teacher_id = ${teacher.id} or ${teacher.role} = 'admin')`;
  if (allowed.length !== classIds.length) {
    return { error: "Alguna de las clases elegidas no existe o no es tuya." };
  }

  const payloadInput =
    type === "lesson"
      ? { title: String(formData.get("title") ?? ""), blocks: parseJson(formData.get("content")) }
      : parseJson(formData.get("payload"));

  const parsed = parseExtraPayload(type, payloadInput);
  if ("error" in parsed) return { error: parsed.error };

  let previousClassIds: string[] = [];
  if (extraId) {
    const [existing] = await sql<{ id: string; teacher_id: string }[]>`
      select id, teacher_id from lesson_extras where id = ${extraId} limit 1`;
    if (!existing) return { error: "El contenido no existe." };
    if (teacher.role !== "admin" && existing.teacher_id !== teacher.id) {
      return { error: "No puedes editar este contenido." };
    }
    previousClassIds = (
      await sql<{ class_id: string }[]>`
        select class_id from extra_classes where extra_id = ${extraId}`
    ).map((row) => row.class_id);
  }

  await sql.begin(async (tx) => {
    let savedId = extraId;
    if (savedId) {
      await tx`
        update lesson_extras
           set lesson_id = ${lesson.id},
               type = ${type},
               payload = ${tx.json(parsed.value as never)},
               updated_at = now()
         where id = ${savedId}`;
      await tx`delete from extra_classes where extra_id = ${savedId}`;
    } else {
      const [created] = await tx<{ id: string }[]>`
        insert into lesson_extras (teacher_id, lesson_id, type, payload)
        values (${teacher.id}, ${lesson.id}, ${type}, ${tx.json(parsed.value as never)})
        returning id`;
      savedId = created.id;
    }

    for (const classId of classIds) {
      await tx`
        insert into extra_classes (extra_id, class_id)
        values (${savedId}, ${classId})
        on conflict (extra_id, class_id) do nothing`;
    }
  });

  revalidatePath("/contenido-extra");
  revalidatePath("/clases");
  for (const classId of new Set([...classIds, ...previousClassIds])) {
    revalidatePath(`/clases/${classId}`);
  }

  return { ok: true };
}

export async function deleteExtra(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const id = String(formData.get("extraId") ?? "");
  const sql = db();

  const [existing] = await sql<{ id: string; teacher_id: string }[]>`
    select id, teacher_id from lesson_extras where id = ${id} limit 1`;
  if (!existing) return;
  if (teacher.role !== "admin" && existing.teacher_id !== teacher.id) return;

  const classIds = await sql<{ class_id: string }[]>`
    select class_id from extra_classes where extra_id = ${id}`;
  await sql`delete from lesson_extras where id = ${id}`;

  revalidatePath("/contenido-extra");
  revalidatePath("/clases");
  for (const row of classIds) revalidatePath(`/clases/${row.class_id}`);
}

export async function publishClass(
  _prev: PublishClassResult,
  formData: FormData,
): Promise<PublishClassResult> {
  const teacher = await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  const klass = await requireEditableClass(teacher, classId);

  try {
    const result = await publishClassRelease(teacher, klass.id);
    revalidatePath(`/clases/${klass.id}`);
    revalidatePath("/clases");
    return { ok: true, ...result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo publicar." };
  }
}
