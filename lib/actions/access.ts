"use server";

import { revalidatePath } from "next/cache";

import { requireEditableCourse } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { isStudentKey } from "@/lib/classes";
import { db } from "@/lib/db";

export type AccessResult = { error?: string; ok?: boolean };

export async function grantCourseAccess(
  _prev: AccessResult,
  formData: FormData,
): Promise<AccessResult> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  const externalKey = String(formData.get("externalKey") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!isStudentKey(externalKey)) {
    return { error: "La identidad del alumno debe ser un UUID válido." };
  }
  if (name.length < 2 || name.length > 80) {
    return { error: "El nombre del alumno debe tener entre 2 y 80 caracteres." };
  }

  await db().begin(async (tx) => {
    const [student] = await tx<{ id: string }[]>`
      insert into students (external_key, name)
      values (${externalKey}, ${name})
      on conflict (external_key) do update
        set name = excluded.name, updated_at = now()
      returning id`;

    await tx`
      insert into course_access (course_id, student_id, granted_by)
      values (${course.id}, ${student.id}, ${teacher.id})
      on conflict (course_id, student_id) do nothing`;
  });

  revalidatePath(`/cursos/${course.id}`);
  return { ok: true };
}

export async function revokeCourseAccess(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  if (!isStudentKey(studentId)) return;

  await db()`
    delete from course_access
     where course_id = ${course.id}
       and student_id = ${studentId}`;

  revalidatePath(`/cursos/${course.id}`);
}
