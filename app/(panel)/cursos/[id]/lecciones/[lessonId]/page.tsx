import { notFound } from "next/navigation";

import { BackLink } from "@/app/(panel)/back-link";
import { requireTeacher } from "@/lib/auth";
import type { ContentBlock } from "@/lib/content";
import { db } from "@/lib/db";
import { backTo } from "@/lib/navigation";

import { LessonEditor } from "./lesson-editor";

type LessonRow = {
  id: string;
  course_id: string;
  code: string;
  title: string;
  eyebrow: string;
  body: string;
  code_sample: string;
  context_title: string;
  context_body: string;
  synthesis: string[];
  content: ContentBlock[];
  owner_id: string | null;
  is_base: boolean;
  course_title: string;
};

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lessonId: string }>;
  searchParams: Promise<{ volver?: string | string[] }>;
}) {
  const teacher = await requireTeacher();
  const { id: courseId, lessonId } = await params;
  const { volver } = await searchParams;
  const back = backTo(volver);

  const rows = await db()<LessonRow[]>`
    select l.id, l.course_id, l.code, l.title, l.eyebrow, l.body, l.code_sample,
           l.context_title, l.context_body, l.synthesis, l.content,
           c.owner_id, c.is_base, c.title as course_title
      from lessons l
      join courses c on c.id = l.course_id
     where l.id = ${lessonId}
       and l.course_id = ${courseId}
     limit 1`;

  const lesson = rows[0];
  if (!lesson) notFound();
  if (teacher.role !== "admin" && lesson.owner_id !== teacher.id) notFound();

  const canEdit =
    teacher.role === "admin" || (!lesson.is_base && lesson.owner_id === teacher.id);

  return (
    <div className="space-y-6">
      <header>
        <BackLink href={back ?? `/cursos/${courseId}`}>
          {back ? "Volver al contenido" : lesson.course_title}
        </BackLink>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="page-title">{lesson.title}</h1>
          <span className="rounded-lg bg-surface px-2 py-0.5 font-mono text-xs text-ink-soft ring-1 ring-line">
            {lesson.code}
          </span>
          {!canEdit && <span className="badge badge-warning">Solo lectura</span>}
        </div>
      </header>

      <LessonEditor
        allowMedia={!lesson.is_base}
        lesson={{
          id: lesson.id,
          code: lesson.code,
          title: lesson.title,
          eyebrow: lesson.eyebrow,
          body: lesson.body,
          codeSample: lesson.code_sample,
          contextTitle: lesson.context_title,
          contextBody: lesson.context_body,
          synthesis: lesson.synthesis ?? [],
          content: lesson.content ?? [],
        }}
      />
    </div>
  );
}
