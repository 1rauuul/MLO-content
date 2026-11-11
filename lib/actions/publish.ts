"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireEditableCourse } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { archiveCourse, publishCourse, restoreCourse } from "@/lib/content/publish";

export type PublishResult = { error?: string; version?: number; hash?: string; lessons?: number };

export async function publish(
  _prev: PublishResult,
  formData: FormData,
): Promise<PublishResult> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  try {
    const outcome = await publishCourse(teacher, course);
    revalidatePath(`/cursos/${courseId}/publicar`);
    revalidatePath(`/cursos/${courseId}`);
    return { ...outcome };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo publicar el curso.",
    };
  }
}

export async function archive(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  if (course.is_base || course.is_group || course.archived_at) return;

  await archiveCourse(course.id);
  revalidatePath(`/cursos/${courseId}/publicar`);
  revalidatePath(`/cursos/${courseId}`);
  revalidatePath("/mis-cursos");
  redirect("/mis-cursos");
}

export async function restore(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  if (course.is_base || course.is_group || !course.archived_at) return;

  await restoreCourse(course.id);
  revalidatePath(`/cursos/${courseId}/publicar`);
  revalidatePath(`/cursos/${courseId}`);
  revalidatePath("/mis-cursos");
}
