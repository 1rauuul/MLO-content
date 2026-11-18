import { notFound } from "next/navigation";

import { BackLink } from "@/app/(panel)/back-link";
import { requireTeacher } from "@/lib/auth";
import { classContentScope, getClassForRead } from "@/lib/classes";
import type {
  CoreExercise,
  ExerciseConfig,
  ExerciseExample,
  ExerciseType,
} from "@/lib/content/model";
import { db } from "@/lib/db";

import { ExerciseEditor } from "./editor";

type ExerciseRow = {
  id: string;
  content_id: string;
  course_id: string;
  topic_id: string;
  lesson_id: string | null;
  type: ExerciseType;
  prompt: string;
  instructions: string;
  correct_order: string[];
  config: ExerciseConfig;
  explanation: string;
  example: ExerciseExample | null;
  position: number;
  owner_id: string | null;
  is_base: boolean;
};

export default async function ExerciseEditorPage({
  params,
}: {
  params: Promise<{ id: string; exerciseId: string }>;
}) {
  const teacher = await requireTeacher();
  const { id, exerciseId } = await params;
  const klass = await getClassForRead(teacher, id);
  const scope = await classContentScope(klass);

  const [exercise] = await db()<ExerciseRow[]>`
    select x.id, x.content_id, x.course_id, x.topic_id, x.lesson_id,
           x.type, x.prompt, x.instructions, x.correct_order, x.config,
           x.explanation, x.example, x.position, c.owner_id, c.is_base
      from exercises x
      join courses c on c.id = x.course_id
     where x.id = ${exerciseId}
       and x.course_id in ${db()(scope)}
       and x.archived_at is null
     limit 1`;
  if (!exercise) notFound();

  const editable =
    teacher.role === "admin" || (!exercise.is_base && exercise.owner_id === teacher.id);
  if (!editable) notFound();

  const initial: CoreExercise = {
    content_id: exercise.content_id,
    lesson_content_id: "",
    type: exercise.type,
    prompt: exercise.prompt,
    instructions: exercise.instructions,
    correct_order: exercise.correct_order,
    config: exercise.config,
    explanation: exercise.explanation,
    example: exercise.example,
    position: exercise.position,
  };

  return (
    <div className="space-y-6">
      <header>
        <BackLink href={`/grupos/${klass.id}/contenido`}>
          Volver al contenido
        </BackLink>
        <h1 className="page-title mt-1">Editar ejercicio</h1>
        <p className="page-lead">{exercise.prompt}</p>
      </header>

      <ExerciseEditor
        groupId={klass.id}
        courseId={exercise.course_id}
        topicId={exercise.topic_id}
        lessonId={exercise.lesson_id ?? undefined}
        initial={initial}
      />
    </div>
  );
}
