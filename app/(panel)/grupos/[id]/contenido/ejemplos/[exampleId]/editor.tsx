"use client";

import { useRouter } from "next/navigation";

import { ExampleForm } from "@/app/(panel)/cursos/[id]/lecciones/[lessonId]/example-form";
import type { CoreExample } from "@/lib/content/model";

export function ExampleEditor({
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
  initial: CoreExample;
}) {
  const router = useRouter();
  const back = `/grupos/${groupId}/contenido`;
  const close = () => router.push(back);

  return (
    <ExampleForm
      lessonId={lessonId}
      courseId={courseId}
      topicId={topicId}
      initial={initial}
      onSaved={close}
      onCancel={close}
    />
  );
}
