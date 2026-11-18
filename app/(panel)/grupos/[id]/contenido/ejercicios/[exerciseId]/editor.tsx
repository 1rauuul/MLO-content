"use client";

import { useRouter } from "next/navigation";

import { ExerciseForm } from "@/app/(panel)/cursos/[id]/lecciones/[lessonId]/exercise-form";
import type { CoreExercise } from "@/lib/content/model";

export function ExerciseEditor({
  groupId,
  courseId,
  topicId,
  lessonId,
  initial,
}: {
  groupId: string;
  courseId: string;
  topicId: string;
  lessonId?: string;
  initial: CoreExercise;
}) {
  const router = useRouter();
  const back = `/grupos/${groupId}/contenido`;
  const close = () => router.push(back);

  return (
    <ExerciseForm
      lessonId={lessonId}
      courseId={courseId}
      topicId={topicId}
      initial={initial}
      onSaved={close}
      onCancel={close}
    />
  );
}
