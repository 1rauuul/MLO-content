import { requireTeacher } from "@/lib/auth";

import { CreateCourseForm } from "./create-course-form";

export default async function NuevoCursoPage() {
  await requireTeacher();

  return <CreateCourseForm />;
}
