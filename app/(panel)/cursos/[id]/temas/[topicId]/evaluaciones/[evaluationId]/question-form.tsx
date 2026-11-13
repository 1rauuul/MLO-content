"use client";

import { useActionState, useState } from "react";

import { PreviewFrame } from "@/app/(panel)/preview-frame";
import { saveQuestion, type TopicResult } from "@/lib/actions/topics";
import type { CoreQuestion, ExerciseConfig } from "@/lib/content/model";
import { parseQuestionInput } from "@/lib/content/validate";

import { EntriesEditor, PairsEditor, TextList } from "../../../../lecciones/[lessonId]/fields";
import { QuestionPreview } from "../../../../lecciones/[lessonId]/preview";

type Draft = {
  type: CoreQuestion["type"];
  prompt: string;
  options: string[];
  correctOption: string;
  config: ExerciseConfig;
  explanation: string;
};

function defaultConfig(type: Draft["type"]): ExerciseConfig {
  if (type === "fill") return { sentences: [""], bank: [] };
  if (type === "match") return { pairs: [{ left: "", right: "" }] };
  if (type === "crossword") {
    return {
      crossword: {
        rows: 8,
        cols: 8,
        entries: [{ word: "", clue: "", row: 0, col: 0, direction: "across" }],
      },
      bank: [],
    };
  }
  return {};
}

function draftFrom(question?: CoreQuestion): Draft {
  if (!question) {
    return {
      type: "mcq",
      prompt: "",
      options: ["", ""],
      correctOption: "",
      config: {},
      explanation: "",
    };
  }
  return {
    type: question.type,
    prompt: question.prompt,
    options: question.options ?? [],
    correctOption: question.options?.[question.answer] ?? "",
    config: question.config ?? defaultConfig(question.type),
    explanation: question.explanation ?? "",
  };
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
  const isChoice = draft.type === "mcq";
  const isOrder = draft.type === "order";
  const options = draft.options.map((item) => item.trim()).filter(Boolean);
  const data = {
    type: draft.type,
    prompt: draft.prompt,
    options: isChoice || isOrder ? options : [],
    answer: isChoice ? Math.max(0, options.indexOf(draft.correctOption)) : 0,
    config: draft.config,
    explanation: draft.explanation,
  };
  const validation = parseQuestionInput(data, { normalize: true });
  const previewError = "error" in validation ? validation.error : null;

  const changeType = (type: Draft["type"]) => {
    patch({
      type,
      options: type === "mcq" || type === "order" ? ["", ""] : [],
      correctOption: "",
      config: defaultConfig(type),
    });
  };

  return (
    <form action={action} className="card space-y-4 border-line-strong p-5">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <input type="hidden" name="questionId" value={question?.content_id ?? ""} />
      <input type="hidden" name="data" value={JSON.stringify(data)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">
          Tipo de pregunta
          <select value={draft.type} onChange={(event) => changeType(event.target.value as Draft["type"])} className="field">
            <option value="mcq">Opción múltiple</option>
            <option value="order">Ordenar</option>
            <option value="fill">Completar</option>
            <option value="match">Relacionar</option>
            <option value="crossword">Crucigrama</option>
          </select>
        </label>
        <label className="field-label sm:col-span-2">
          Enunciado
          <input
            value={draft.prompt}
            onChange={(event) => patch({ prompt: event.target.value })}
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "question-form-error" : undefined}
            className="field"
          />
        </label>
      </div>

      {isChoice && (
        <fieldset className="space-y-2 rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-medium text-ink">Opciones y respuesta correcta</legend>
          {draft.options.map((option, index) => (
            <label key={index} className="flex items-center gap-2">
              <input type="radio" name="correct-option" aria-label={`Marcar opción ${index + 1} como correcta`} checked={draft.correctOption === option && option.trim().length > 0} onChange={() => patch({ correctOption: option.trim() })} className="size-4" />
              <input value={option} onChange={(event) => {
                const next = [...draft.options];
                const previous = next[index];
                next[index] = event.target.value;
                patch({ options: next, correctOption: draft.correctOption === previous ? event.target.value.trim() : draft.correctOption });
              }} placeholder={`Opción ${index + 1}`} className="field" />
              <button type="button" onClick={() => patch({ options: draft.options.filter((_, itemIndex) => itemIndex !== index) })} className="btn btn-ghost btn-sm" aria-label="Quitar opción">×</button>
            </label>
          ))}
          <button type="button" onClick={() => patch({ options: [...draft.options, ""] })} className="btn btn-secondary btn-sm">Agregar opción</button>
        </fieldset>
      )}

      {isOrder && <TextList label="Secuencia correcta" values={draft.options} onChange={(options: string[]) => patch({ options })} placeholder="Elemento en orden" hint="Escribe los elementos en el orden que el alumno debe formar." />}

      {draft.type === "fill" && (
        <div className="space-y-4">
          <TextList label="Oraciones" values={draft.config.sentences ?? []} onChange={(sentences: string[]) => patch({ config: { ...draft.config, sentences } })} placeholder="El {{software}} se mantiene." hint="Cada espacio va entre dobles llaves: {{palabra}}." />
          <TextList label="Palabras extra" values={draft.config.bank ?? []} onChange={(bank: string[]) => patch({ config: { ...draft.config, bank } })} placeholder="Distractor" />
        </div>
      )}

      {draft.type === "match" && <PairsEditor pairs={draft.config.pairs ?? []} onChange={(pairs) => patch({ config: { ...draft.config, pairs } })} />}

      {draft.type === "crossword" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-ink-soft"><span>Filas</span><input type="number" min={1} value={draft.config.crossword?.rows ?? 8} onChange={(event) => patch({ config: { ...draft.config, crossword: { rows: Number(event.target.value), cols: draft.config.crossword?.cols ?? 8, entries: draft.config.crossword?.entries ?? [] } } })} className="field" /></label>
            <label className="space-y-1 text-sm text-ink-soft"><span>Columnas</span><input type="number" min={1} value={draft.config.crossword?.cols ?? 8} onChange={(event) => patch({ config: { ...draft.config, crossword: { rows: draft.config.crossword?.rows ?? 8, cols: Number(event.target.value), entries: draft.config.crossword?.entries ?? [] } } })} className="field" /></label>
          </div>
          <EntriesEditor entries={draft.config.crossword?.entries ?? []} onChange={(entries) => patch({ config: { ...draft.config, crossword: { rows: draft.config.crossword?.rows ?? 8, cols: draft.config.crossword?.cols ?? 8, entries } } })} />
          <TextList label="Palabras extra" values={draft.config.bank ?? []} onChange={(bank: string[]) => patch({ config: { ...draft.config, bank } })} placeholder="PALABRA" />
        </div>
      )}

      <label className="field-label">
        Explicación al terminar
        <input value={draft.explanation} onChange={(event) => patch({ explanation: event.target.value })} className="field" />
      </label>

      <PreviewFrame label="MLO · Pregunta">
        <QuestionPreview key={`${draft.type}-${JSON.stringify(data.config)}-${options.join("|")}-${data.answer}`} type={draft.type} prompt={draft.prompt} options={options} answer={data.answer} config={data.config} explanation={draft.explanation} error={previewError} />
      </PreviewFrame>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Guardando…" : question ? "Guardar pregunta" : "Agregar pregunta"}</button>
        {onDone && <button type="button" onClick={onDone} className="btn btn-secondary btn-sm">Cerrar</button>}
        {state.error && <p id="question-form-error" className="form-error" role="alert">{state.error}</p>}
        {state.ok && <p className="form-ok" role="status">Pregunta guardada.</p>}
      </div>
    </form>
  );
}
