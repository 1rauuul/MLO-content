import { notFound } from "next/navigation";

import { BackLink } from "@/app/(panel)/back-link";
import { requireTeacher } from "@/lib/auth";
import { classContentScope, getClassForRead } from "@/lib/classes";
import type {
  CoreExample,
  ExerciseConfig,
  ExerciseStep,
  ExerciseType,
} from "@/lib/content/model";
import { db } from "@/lib/db";

import { ExampleEditor } from "./editor";

type ExampleRow = {
  id: string;
  content_id: string;
  course_id: string;
  topic_id: string;
  lesson_id: string | null;
  type: ExerciseType;
  title: string;
  prompt: string;
  config: ExerciseConfig;
  steps: ExerciseStep[];
  hints: string[];
  explanation: string;
  position: number;
  owner_id: string | null;
  is_base: boolean;
};

export default async function ExampleEditorPage({
  params,
}: {
  params: Promise<{ id: string; exampleId: string }>;
}) {
  const teacher = await requireTeacher();
  const { id, exampleId } = await params;
  const klass = await getClassForRead(teacher, id);
  const scope = await classContentScope(klass);

  const [example] = await db()<ExampleRow[]>`
    select e.id, e.content_id, e.course_id, e.topic_id, e.lesson_id,
           e.type, e.title, e.prompt, e.config, e.steps, e.hints, e.explanation,
           e.position, c.owner_id, c.is_base
      from examples e
      join courses c on c.id = e.course_id
     where e.id = ${exampleId}
       and e.course_id in ${db()(scope)}
       and e.archived_at is null
     limit 1`;
  if (!example) notFound();

  const editable =
    teacher.role === "admin" || (!example.is_base && example.owner_id === teacher.id);
  if (!editable) notFound();

  const initial: CoreExample = {
    content_id: example.content_id,
    lesson_content_id: "",
    type: example.type,
    title: example.title,
    prompt: example.prompt,
    config: example.config,
    steps: example.steps,
    hints: example.hints,
    explanation: example.explanation,
    position: example.position,
  };

  return (
    <div className="space-y-6">
      <header>
        <BackLink href={`/grupos/${klass.id}/contenido`}>
          Volver al contenido
        </BackLink>
        <h1 className="page-title mt-1">Editar ejemplo</h1>
        <p className="page-lead">{example.title}</p>
      </header>

      <ExampleEditor
        groupId={klass.id}
        courseId={example.course_id}
        topicId={example.topic_id}
        lessonId={example.lesson_id ?? undefined}
        initial={initial}
      />
    </div>
  );
}
