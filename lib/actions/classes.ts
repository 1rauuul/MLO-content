"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTeacher } from "@/lib/auth";
import { publishClassRelease, requireEditableClass } from "@/lib/classes";
import { isExtraType, parseExtraPayload } from "@/lib/content/classes";
import { db } from "@/lib/db";
import { normalizeInvitationEmail } from "@/lib/invitations/core";
import { sendInvitationEmail } from "@/lib/invitations/delivery";
import {
  createInvitation,
  revokeInvitation,
} from "@/lib/invitations/invitations";
import { newCourseKey, newJoinCode } from "@/lib/ids";

export type ClassResult = { error?: string };
export type ExtraResult = { error?: string; ok?: boolean };
export type InvitationResult = {
  error?: string;
  ok?: boolean;
  invitation?: {
    id: string;
    email: string;
    expiresAt: string;
    link: string;
    delivery: "sent" | "not_configured" | "rejected" | "network";
  };
};
export type PublishClassResult = {
  error?: string;
  ok?: boolean;
  version?: number;
  hash?: string;
  extras?: number;
  v3Version?: number;
  v3Hash?: string;
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
  const courseId = String(formData.get("courseId") ?? "").trim();
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw === "" ? null : Number(capacityRaw);

  if (name.length < 3) return { error: "Escribe un nombre de al menos 3 caracteres." };
  if (name.length > 80) return { error: "El nombre no puede pasar de 80 caracteres." };
  if (!courseId) return { error: "Elige el curso que se asignará al grupo." };
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return { error: "El cupo debe ser un entero positivo o quedar vacío." };
  }

  const [course] = await db()<{ id: string; is_base: boolean; owner_id: string | null }[]>`
    select id, is_base, owner_id from courses
     where id = ${courseId} and not is_group and archived_at is null
     limit 1`;
  if (!course) return { error: "El curso padre no existe." };
  if (teacher.role !== "admin" && !course.is_base && course.owner_id !== teacher.id) {
    return { error: "No puedes crear grupos en ese curso." };
  }

  let classId: string | null = null;
  for (let attempt = 0; attempt < 5 && !classId; attempt += 1) {
    try {
      classId = await db().begin(async (tx) => {
        const [contentCourse] = await tx<{ id: string }[]>`
          insert into courses
            (key, title, owner_id, is_base, uses_base, status, is_group)
          values
            (${newCourseKey()}, ${`${name} · contenido`}, ${teacher.id},
             false, false, 'draft', true)
          returning id`;
        const [created] = await tx<{ id: string }[]>`
          insert into classes
            (teacher_id, name, join_code, course_id, content_course_id, capacity)
          values
            (${teacher.id}, ${name}, ${newJoinCode()}, ${course.id},
             ${contentCourse.id}, ${capacity})
          returning id`;
        return created.id;
      });
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") throw error;
    }
  }

  if (!classId) {
    return { error: "No se pudo generar el código del grupo. Inténtalo de nuevo." };
  }

  revalidatePath("/grupos");
  redirect(`/grupos/${classId}`);
}

export async function createClassContent(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const klass = await requireEditableClass(teacher, String(formData.get("classId") ?? ""));
  if (klass.content_course_id) redirect(`/cursos/${klass.content_course_id}`);

  const courseId = await db().begin(async (tx) => {
    const [contentCourse] = await tx<{ id: string }[]>`
      insert into courses
        (key, title, owner_id, is_base, uses_base, status, is_group)
      values
        (${newCourseKey()}, ${`${klass.name} · contenido`}, ${teacher.id},
         false, false, 'draft', true)
      returning id`;
    await tx`
      update classes
         set content_course_id = ${contentCourse.id}
       where id = ${klass.id}`;
    return contentCourse.id;
  });

  revalidatePath(`/grupos/${klass.id}`);
  redirect(`/cursos/${courseId}`);
}

export async function archiveClass(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const klass = await requireEditableClass(teacher, String(formData.get("classId") ?? ""));
  await db()`update classes set archived_at = now() where id = ${klass.id}`;
  revalidatePath("/grupos");
  revalidatePath(`/grupos/${klass.id}`);
}

export async function restoreClass(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const klass = await requireEditableClass(teacher, String(formData.get("classId") ?? ""));
  await db()`update classes set archived_at = null where id = ${klass.id}`;
  revalidatePath("/grupos");
  revalidatePath(`/grupos/${klass.id}`);
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
  if (classIds.length === 0) return { error: "Elige al menos un grupo." };

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
    return { error: "Alguno de los grupos elegidos no existe o no es tuyo." };
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
  revalidatePath("/grupos");
  for (const classId of new Set([...classIds, ...previousClassIds])) {
    revalidatePath(`/grupos/${classId}`);
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
  revalidatePath("/grupos");
  for (const row of classIds) revalidatePath(`/grupos/${row.class_id}`);
}

export async function createClassInvitation(
  _prev: InvitationResult,
  formData: FormData,
): Promise<InvitationResult> {
  const teacher = await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  const email = normalizeInvitationEmail(String(formData.get("email") ?? ""));
  if (!email) {
    return { error: "Escribe un correo válido. Se acepta cualquier dominio." };
  }

  const klass = await requireEditableClass(teacher, classId);
  if (klass.archived_at) {
    return { error: "Restaura el grupo antes de invitar." };
  }

  const created = await createInvitation({
    classId: klass.id,
    email,
    createdBy: teacher.id,
  });
  if (!created.ok) return { error: "No se pudo crear la invitación." };

  // Si el envío falla, la invitación y el enlace siguen siendo válidos.
  const delivery = await sendInvitationEmail({
    to: created.invitation.email,
    link: created.invitation.link,
    className: klass.name,
    courseTitle: klass.course_title,
    teacherName: klass.teacher_name,
    expiresAt: created.invitation.expiresAt,
  });

  revalidatePath(`/grupos/${klass.id}`);

  return {
    ok: true,
    invitation: {
      id: created.invitation.id,
      email: created.invitation.email,
      expiresAt: created.invitation.expiresAt.toISOString(),
      link: created.invitation.link,
      delivery: delivery.sent ? "sent" : delivery.reason,
    },
  };
}

export async function revokeClassInvitation(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) return;

  const klass = await requireEditableClass(
    teacher,
    String(formData.get("classId") ?? ""),
  );
  await revokeInvitation(klass.id, invitationId);
  revalidatePath(`/grupos/${klass.id}`);
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
    revalidatePath(`/grupos/${klass.id}`);
    revalidatePath("/grupos");
    return { ok: true, ...result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo publicar." };
  }
}
