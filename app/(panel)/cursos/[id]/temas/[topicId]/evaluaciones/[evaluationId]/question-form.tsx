"use client";

import { useActionState, useState } from "react";

import type { CoreQuestion, ExerciseConfig } from "@/lib/content/model";
import { parseQuestionInput } from "@/lib/content/validate";
import { saveQuestion, type TopicResult } from "@/lib/actions/topics";
import { PreviewFrame } from "@/app/(panel)/preview-frame";

import { QuestionPreview } from "../../../../lecciones/[lessonId]/preview";

type Draft = {
  type: CoreQuestion["type"];
  prompt: string;
  optionsText: string;
  answer: number;
  configText: string;
  explanation: string;
};

function draftFrom(question?: CoreQuestion): Draft {
  return question
    ? {
        type: question.type,
        prompt: question.prompt,
        optionsText: (question.options ?? []).join("\n"),
        answer: question.answer ?? 0,
        configText: JSON.stringify(question.config ?? {}, null, 2),
        explanation: question.explanation ?? "",
      }
    : {
        type: "mcq",
        prompt: "",
        optionsText: "",
        answer: 0,
        configText: "{}",
        explanation: "",
      };
}

function parseConfig(value: string): ExerciseConfig {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as ExerciseConfig) : {};
  } catch {
    return {};
  }
}

export function QuestionForm({
  courseId,
  topicId,
  evaluationId,
  question,
  onDone,
}: {
  courseId: string;
  topicId: string;
  evaluationId: string;
  question?: CoreQuestion;
  onDone?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(draftFrom(question));
  const [state, action, pending] = useActionState<TopicResult, FormData>(saveQuestion, {});
  const patch = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values }));

  const options = draft.optionsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const data = {
    type: draft.type,
    prompt: draft.prompt,
    options: draft.type === "mcq" || draft.type === "order" ? options : [],
    answer: draft.answer,
    config: parseConfig(draft.configText),
    explanation: draft.explanation,
  };
  const validation = parseQuestionInput(data, { normalize: true });
  const previewError = "error" in validation ? validation.error : null;

  return (
    <form action={action} className="card space-y-4 border-line-strong p-5">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <input type="hidden" name="questionId" value={question?.content_id ?? ""} />
      <input type="hidden" name="data" value={JSON.stringify(data)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="eyebrow">Tipo</span>
          <select
            value={draft.type}
            onChange={(event) => patch({ type: event.target.value as Draft["type"] })}
            className="field"
          >
            <option value="mcq">Opción múltiple</option>
            <option value="order">Ordenar</option>
            <option value="fill">Completar</option>
            <option value="match">Relacionar</option>
            <option value="crossword">Crucigrama</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="eyebrow">Respuesta / índice</span>
          <input
            type="number"
            min={0}
            value={draft.answer}
            onChange={(event) => patch({ answer: Number(event.target.value) })}
            className="field"
          />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="eyebrow">Enunciado</span>
          <input
            value={draft.prompt}
            onChange={(event) => patch({ prompt: event.target.value })}
            className="field"
          />
        </label>
        {(draft.type === "mcq" || draft.type === "order") && (
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="eyebrow">
              {draft.type === "mcq" ? "Opciones (una por línea)" : "Secuencia correcta (una por línea)"}
            </span>
            <textarea
              value={draft.optionsText}
              onChange={(event) => patch({ optionsText: event.target.value })}
              rows={4}
              className="field font-mono text-xs"
            />
          </label>
        )}
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="eyebrow">Config JSON</span>
          <textarea
            value={draft.configText}
            onChange={(event) => patch({ configText: event.target.value })}
            rows={6}
            className="field font-mono text-xs"
          />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="eyebrow">Explicación</span>
          <input
            value={draft.explanation}
            onChange={(event) => patch({ explanation: event.target.value })}
            className="field"
          />
        </label>
      </div>

      <PreviewFrame label="MLO · Pregunta">
        <QuestionPreview
          key={`${draft.type}-${JSON.stringify(data.config)}-${options.join("|")}-${draft.answer}`}
          type={draft.type}
          prompt={draft.prompt}
          options={options}
          answer={draft.answer}
          config={data.config}
          explanation={draft.explanation}
          error={previewError}
        />
      </PreviewFrame>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Guardando…" : question ? "Guardar pregunta" : "Crear pregunta"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="btn btn-secondary btn-sm">
            Cerrar
          </button>
        )}
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        {state.ok && <p className="form-ok" role="status">Pregunta guardada.</p>}
      </div>
    </form>
  );
}
