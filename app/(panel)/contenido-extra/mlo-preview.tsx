"use client";

import type { ContentBlock } from "@/lib/content";
import type { StudioContentType, StudioGroup, StudioTopic } from "@/lib/studio";

import {
  ExamplePreview,
  ExercisePreview,
  LessonReadingPreview,
} from "../cursos/[id]/lecciones/[lessonId]/preview";
import type { ExampleDraft } from "../cursos/[id]/lecciones/[lessonId]/example-form";
import type { ExerciseDraft } from "../cursos/[id]/lecciones/[lessonId]/exercise-form";
import { ContentTypeIcon } from "./content-icons";

const TONES: Record<StudioContentType, string> = {
  lesson: "#4d7cfe",
  example: "#45d39a",
  exercise: "#f3bc61",
  evaluation: "#ee6f7d",
};

const LABELS: Record<StudioContentType, string> = {
  lesson: "Lección",
  example: "Ejemplo",
  exercise: "Ejercicio",
  evaluation: "Evaluación",
};

const NOTES: Record<StudioContentType, string> = {
  lesson: "Concepto y síntesis",
  example: "Demostración guiada",
  exercise: "Práctica interactiva",
  evaluation: "Preguntas y ejercicios",
};

export type LessonDraft = {
  title: string;
  code: string;
  blocks: ContentBlock[];
};

export type EvaluationDraft = {
  title: string;
  description: string;
};

export function MloTopicPreview({
  group,
  topic,
  type,
  lessonDraft,
  exampleDraft,
  exerciseDraft,
  evaluationDraft,
}: {
  group: StudioGroup | null;
  topic: StudioTopic | null;
  type: StudioContentType;
  lessonDraft: LessonDraft;
  exampleDraft: ExampleDraft | null;
  exerciseDraft: ExerciseDraft | null;
  evaluationDraft: EvaluationDraft;
}) {
  const counts: Record<StudioContentType, number> = {
    lesson: topic?.lessons.length ?? 0,
    example: topic?.exampleCount ?? 0,
    exercise: topic?.exerciseCount ?? 0,
    evaluation: topic?.evaluationCount ?? 0,
  };
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
        <div
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-xl border border-[#324050] bg-[#1e2835] text-[#f4f7fb]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </div>

        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#4d7cfe]">
            {topic ? `Unidad ${topic.unitNumber} · Subtema` : group?.name ?? "Tu grupo"}
          </p>
          <h3 className="mt-1 text-balance text-[24px] font-semibold leading-[1.05] tracking-[-0.04em] text-[#f4f7fb]">
            {topic?.title ?? "Contenido del grupo"}
          </h3>
        </div>

        <div className="flex items-center gap-2.5 rounded-full border border-[#324050] bg-[#1e2835] px-3.5 py-2.5 text-sm font-semibold text-[#f4f7fb]">
          <span className="size-2.5 rounded-full bg-[#4d7cfe]" />
          En progreso
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(LABELS) as StudioContentType[]).map((item) => {
            const active = item === type;
            const draft = active && hasDraft[item];
            const count = counts[item];
            const note = draft
              ? "Tu borrador actual"
              : count > 0
                ? `${count} ${count === 1 ? "elemento" : "elementos"}`
                : NOTES[item];

            return (
              <div
                key={item}
                className="flex aspect-square flex-col justify-between rounded-[20px] border bg-[#1e2835] p-4"
                style={{
                  borderColor: active ? TONES[item] : "#324050",
                  boxShadow: active ? `0 0 0 1px ${TONES[item]}33` : undefined,
                }}
              >
                <span
                  className="grid size-9 place-items-center rounded-xl"
                  style={{
                    backgroundColor: `${TONES[item]}24`,
                    color: TONES[item],
                  }}
                >
                  <ContentTypeIcon type={item} className="size-5" />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-[#f4f7fb]">
                    {LABELS[item]}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[#9cabbc]">
                    {note}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <div>
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#9cabbc]">
            {LABELS[type]} en MLO
          </p>
          {type === "lesson" &&
            (hasDraft.lesson ? (
              <div className="mlo-preview rounded-2xl border border-[#324050] bg-[#1e2835] p-4">
                <LessonReadingPreview
                  title={lessonDraft.title}
                  eyebrow={lessonDraft.code ? `Lección ${lessonDraft.code}` : ""}
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
