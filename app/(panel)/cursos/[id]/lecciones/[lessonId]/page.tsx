import Link from "next/link";
import { notFound } from "next/navigation";

import { requireTeacher } from "@/lib/auth";
import type { ContentBlock } from "@/lib/content";
import type { CoreExample, CoreExercise } from "@/lib/content/model";
import { db } from "@/lib/db";

import { ExamplesPanel } from "./examples-panel";
import { ExercisesPanel } from "./exercises-panel";
import { LessonEditor } from "./lesson-editor";
import { LessonTabs } from "./lesson-tabs";

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
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const teacher = await requireTeacher();
  const { id: courseId, lessonId } = await params;

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

  const exercises = await db()<CoreExercise[]>`
    select id, content_id, lesson_id as lesson_content_id, type, prompt, instructions,
           correct_order, config, explanation, example, position
      from exercises
     where lesson_id = ${lesson.id} and archived_at is null
     order by position, content_id`;
  const examples = await db()<CoreExample[]>`
    select id, content_id, lesson_id as lesson_content_id, type, title, prompt,
           config, steps, hints, explanation, position
      from examples
     where lesson_id = ${lesson.id} and archived_at is null
     order by position, content_id`;

  const canEdit =
    teacher.role === "admin" || (!lesson.is_base && lesson.owner_id === teacher.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/cursos/${courseId}`} className="text-sm text-zinc-500 hover:text-zinc-900">
          ← {lesson.course_title}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">{lesson.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Lección <span className="font-mono">{lesson.code}</span>
        </p>
      </div>

      <LessonTabs
        exerciseCount={exercises.length}
        exampleCount={examples.length}
        content={
          <LessonEditor
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
        }
        exercises={
          <ExercisesPanel
            lessonId={lesson.id}
            exercises={exercises}
            readOnly={!canEdit}
          />
        }
        examples={
          <ExamplesPanel lessonId={lesson.id} examples={examples} readOnly={!canEdit} />
        }
      />
    </div>
  );
}
