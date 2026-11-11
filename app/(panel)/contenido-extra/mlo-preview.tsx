"use client";

import type { ContentBlock } from "@/lib/content";
import type { StudioContentType } from "@/lib/studio";

import {
  ExamplePreview,
  ExercisePreview,
  LessonReadingPreview,
} from "../cursos/[id]/lecciones/[lessonId]/preview";
import type { ExampleDraft } from "../cursos/[id]/lecciones/[lessonId]/example-form";
import type { ExerciseDraft } from "../cursos/[id]/lecciones/[lessonId]/exercise-form";
const LABELS: Record<StudioContentType, string> = {
  lesson: "Lección",
  example: "Ejemplo",
  exercise: "Ejercicio",
  evaluation: "Evaluación",
};

export type LessonDraft = {
  title: string;
  blocks: ContentBlock[];
};

export type EvaluationDraft = {
  title: string;
  description: string;
};

export function MloTopicPreview({
  type,
  lessonDraft,
  exampleDraft,
  exerciseDraft,
  evaluationDraft,
}: {
  type: StudioContentType;
  lessonDraft: LessonDraft;
  exampleDraft: ExampleDraft | null;
  exerciseDraft: ExerciseDraft | null;
  evaluationDraft: EvaluationDraft;
}) {
  const hasDraft: Record<StudioContentType, boolean> = {
    lesson: lessonDraft.title.trim().length > 0 || lessonDraft.blocks.length > 0,
    example: Boolean(exampleDraft?.title.trim() || exampleDraft?.prompt.trim()),
    exercise: Boolean(exerciseDraft?.prompt.trim()),
    evaluation: evaluationDraft.title.trim().length > 0,
  };

  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[38px] border-[9px] border-[#172033] bg-[#10151d] shadow-[0_22px_42px_#1720332b]">
      <div
        aria-hidden="true"
        className="flex items-center justify-between px-[18px] pb-[7px] pt-3 font-mono text-[9px] font-bold text-[#f4f7fb]"
      >
        <span>9:41</span>
        <span>● ● ● ▰</span>
      </div>

      <div className="max-h-[640px] space-y-4 overflow-y-auto p-4">
        <div>
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#9cabbc]">
            {LABELS[type]} en MLO
          </p>
          {type === "lesson" &&
            (hasDraft.lesson ? (
              <div className="mlo-preview rounded-2xl border border-[#324050] bg-[#1e2835] p-4">
                <LessonReadingPreview
                  title={lessonDraft.title}
                  eyebrow=""
                  body=""
                  codeSample=""
                  contextTitle=""
                  contextBody=""
                  synthesis={[]}
                  blocks={lessonDraft.blocks}
                  errors={[]}
                />
              </div>
            ) : (
              <EmptyPreview text="Escribe el título o agrega bloques para ver la lección." />
            ))}

          {type === "example" &&
            (exampleDraft && hasDraft.example ? (
              <div className="mlo-preview">
                <ExamplePreview
                  type={exampleDraft.type}
                  title={exampleDraft.title}
                  prompt={exampleDraft.prompt}
                  correctOrder={exampleDraft.correctOrder}
                  config={exampleDraft.config}
                  steps={exampleDraft.steps}
                  hints={exampleDraft.hints}
                  explanation={exampleDraft.explanation}
                />
              </div>
            ) : (
              <EmptyPreview text="Completa el ejemplo para verlo como lo verá el alumno." />
            ))}

          {type === "exercise" &&
            (exerciseDraft && hasDraft.exercise ? (
              <div className="mlo-preview">
                <ExercisePreview
                  type={exerciseDraft.type}
                  prompt={exerciseDraft.prompt}
                  instructions={exerciseDraft.instructions}
                  correctOrder={exerciseDraft.correctOrder}
                  config={exerciseDraft.config}
                  explanation={exerciseDraft.explanation}
                  example={exerciseDraft.example}
                />
              </div>
            ) : (
              <EmptyPreview text="Completa el ejercicio para verlo como lo verá el alumno." />
            ))}

          {type === "evaluation" &&
            (hasDraft.evaluation ? (
              <div className="rounded-2xl border border-[#324050] bg-[#1e2835] p-4">
                <span className="rounded-full bg-[#263447] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#ee6f7d]">
                  Evaluación
                </span>
                <h4 className="mt-2 text-lg font-semibold leading-snug text-[#f4f7fb]">
                  {evaluationDraft.title}
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-[#9cabbc]">
                  {evaluationDraft.description ||
                    "Preguntas y ejercicios para comprobar el avance del subtema."}
                </p>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-[#263447] px-3 py-2 text-sm text-[#f4f7fb]">
                  <span>Preguntas</span>
                  <span className="font-mono text-xs">0</span>
                </div>
                <div className="mt-2 flex items-center justify-between rounded-xl bg-[#263447] px-3 py-2 text-sm text-[#f4f7fb]">
                  <span>Ejercicios</span>
                  <span className="font-mono text-xs">0</span>
                </div>
                <p className="mt-3 text-center text-[11px] leading-snug text-[#9cabbc]">
                  Agrega preguntas después de crearla.
                </p>
                <p className="mt-2 rounded-xl bg-[#4d7cfe] px-3 py-2 text-center text-sm font-semibold text-white">
                  Iniciar evaluación
                </p>
              </div>
            ) : (
              <EmptyPreview text="Escribe el título para ver la evaluación en MLO." />
            ))}
        </div>
      </div>
    </div>
  );
}

function EmptyPreview({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-[#324050] px-4 py-6 text-center text-xs leading-relaxed text-[#9cabbc]">
      {text}
    </p>
  );
}
