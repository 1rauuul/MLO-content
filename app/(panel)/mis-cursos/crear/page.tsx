import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";

import { CreateCourseForm } from "./create-course-form";

export default async function NuevoCursoPage() {
  await requireTeacher();

  const base = await db()<{ id: string }[]>`
    select id from courses
     where is_base
     limit 1`;

  return <CreateCourseForm baseCourseId={base[0]?.id ?? null} />;
}
