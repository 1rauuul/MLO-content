"use client";

import { useState } from "react";

import type {
  ActivityType,
  ExerciseConfig,
  ExerciseExample,
  ExerciseStep,
  ExerciseType,
} from "@/lib/content/model";
import type { ContentBlock } from "@/lib/content";
import {
  checkCrossword,
  checkFill,
  checkMatch,
  checkMcq,
  checkOrder,
  crosswordSolution,
  fillHoles,
  previewActivitySignature,
  type PreviewResult,
} from "@/lib/content/preview";

const TYPE_LABEL: Record<ActivityType, string> = {
  order: "Ordenar",
  fill: "Completar",
  match: "Relacionar",
  crossword: "Crucigrama",
  mcq: "Opción múltiple",
};

function Badge({ type }: { type: ActivityType }) {
  return <span className="badge badge-neutral">{TYPE_LABEL[type]}</span>;
}

function Steps({ steps }: { steps: ExerciseStep[] }) {
  return (
    <ol className="preview-steps">
      {steps.map((step, index) => (
        <li key={index}>
          <span className="font-medium text-ink-soft">{step.text}</span>
          <span className="block text-ink-muted">{step.why}</span>
        </li>
      ))}
    </ol>
  );
}

export function ExerciseExamplePreview({ example }: { example: ExerciseExample }) {
  return (
    <div className="rounded-lg bg-surface-soft p-3">
      <p className="eyebrow">Ejemplo</p>
      <p className="mt-1 font-medium text-ink-soft">{example.title}</p>
      <Steps steps={example.steps} />
      {example.hints.length > 0 && (
        <p className="mt-2 text-xs text-ink-muted">Pistas: {example.hints.join(" · ")}</p>
      )}
    </div>
  );
}

function Feedback({ result }: { result: PreviewResult | null }) {
  if (!result) return null;
  return (
    <p
      className={result.correct ? "preview-feedback-correct" : "preview-feedback-error"}
      role="status"
    >
      {result.message}
    </p>
  );
}

type ActivityRunnerProps = {
  type: ActivityType;
  config: ExerciseConfig;
  correctOrder: string[];
  options: string[];
  answer: number;
};

function ActivityRunner(props: ActivityRunnerProps) {
  // La firma remonta el estado interactivo solo cuando cambia el borrador
  // relevante; escribir el enunciado no reinicia la interacción.
  return (
    <ActivityRunnerState
      key={previewActivitySignature(props)}
      {...props}
    />
  );
}

function ActivityRunnerState({ type, config, correctOrder, options, answer }: ActivityRunnerProps) {
  const [order, setOrder] = useState<string[]>(() =>
    type === "order" && correctOrder.length > 1 ? [...correctOrder].reverse() : correctOrder,
  );
  const [fill, setFill] = useState<string[]>(() =>
    fillHoles(config.sentences ?? []).map(() => ""),
  );
  const [match, setMatch] = useState<Record<string, string>>({});
  const [grid, setGrid] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);

  const holes = fillHoles(config.sentences ?? []);
  const solution = crosswordSolution(config);
  const bank = [...new Set([...holes, ...(config.bank ?? [])])].filter(Boolean);
  const rights = [...new Set((config.pairs ?? []).map((pair) => pair.right))];

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setResult(null);
  }

  function check() {
    if (type === "order") setResult(checkOrder(correctOrder, order));
    else if (type === "fill") setResult(checkFill(config.sentences ?? [], fill));
    else if (type === "match") setResult(checkMatch(config.pairs ?? [], match));
    else if (type === "crossword") setResult(checkCrossword(config, grid));
    else setResult(checkMcq(options, answer, selected));
  }

  function renderFill() {
    let holeIndex = 0;
    return (config.sentences ?? []).map((sentence, sentenceIndex) => {
      const parts = sentence.split(/(\{\{.+?\}\})/g);
      return (
        <p key={sentenceIndex} className="preview-activity-text">
          {parts.map((part, partIndex) => {
            if (!part.startsWith("{{")) return <span key={partIndex}>{part}</span>;
            const current = holeIndex;
            holeIndex += 1;
            return (
              <select
                key={partIndex}
                value={fill[current] ?? ""}
                onChange={(event) => {
                  const next = [...fill];
                  next[current] = event.target.value;
                  setFill(next);
                  setResult(null);
                }}
                className="preview-select"
                aria-label={`Palabra ${current + 1}`}
              >
                <option value="">…</option>
                {bank.map((word) => (
                  <option key={word} value={word}>
                    {word}
                  </option>
                ))}
              </select>
            );
          })}
        </p>
      );
    });
  }

  if (type === "order") {
    return (
      <div className="space-y-2">
        <ul className="space-y-1.5">
          {order.map((item, index) => (
            <li key={`${item}-${index}`} className="preview-order-row">
              <span>{item}</span>
              <span className="flex gap-1">
                <button type="button" className="preview-mini-btn" onClick={() => move(index, -1)}>
                  ↑
                </button>
                <button type="button" className="preview-mini-btn" onClick={() => move(index, 1)}>
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="preview-check" onClick={check}>
          Comprobar
        </button>
        <Feedback result={result} />
      </div>
    );
  }

  if (type === "fill") {
    return (
      <div className="space-y-2">
        {renderFill()}
        <button type="button" className="preview-check" onClick={check}>
          Comprobar
        </button>
        <Feedback result={result} />
      </div>
    );
  }

  if (type === "match") {
    return (
      <div className="space-y-2">
        {(config.pairs ?? []).map((pair, index) => (
          <label key={index} className="preview-match-row">
            <span>{pair.left}</span>
            <select
              value={match[pair.left] ?? ""}
              onChange={(event) => {
                setMatch({ ...match, [pair.left]: event.target.value });
                setResult(null);
              }}
              className="preview-select"
            >
              <option value="">Elige…</option>
              {rights.map((right) => (
                <option key={right} value={right}>
                  {right}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button type="button" className="preview-check" onClick={check}>
          Comprobar
        </button>
        <Feedback result={result} />
      </div>
    );
  }

  if (type === "crossword") {
    if (!solution) return <p className="text-sm text-danger">Falta la cuadrícula del crucigrama.</p>;
    return (
      <div className="space-y-2">
        <div
          className="preview-crossword"
          style={{ gridTemplateColumns: `repeat(${solution.cols}, minmax(1.5rem, 1fr))` }}
        >
          {Array.from({ length: solution.rows * solution.cols }, (_, index) => {
            const row = Math.floor(index / solution.cols);
            const col = index % solution.cols;
            const key = `${row}-${col}`;
            const active = key in solution.cells;
            return active ? (
              <input
                key={key}
                value={grid[key] ?? ""}
                maxLength={1}
                onChange={(event) => {
                  setGrid({ ...grid, [key]: event.target.value.toUpperCase() });
                  setResult(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                className="preview-cell"
                aria-label={`Fila ${row + 1}, columna ${col + 1}`}
              />
            ) : (
              <span key={key} className="preview-cell preview-cell-empty" />
            );
          })}
        </div>
        <button type="button" className="preview-check" onClick={check}>
          Comprobar
        </button>
        <Feedback result={result} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(options.length > 0 ? options : ["Opción 1", "Opción 2"]).map((option, index) => (
        <label key={index} className="preview-option">
          <input
            type="radio"
            name="preview-mcq"
            checked={selected === index}
            onChange={() => {
              setSelected(index);
              setResult(null);
            }}
          />
          {option || `Opción ${index + 1}`}
        </label>
      ))}
      <button type="button" className="preview-check" onClick={check}>
        Comprobar
      </button>
      <Feedback result={result} />
    </div>
  );
}

export function ExercisePreview({
  type,
  prompt,
  instructions,
  correctOrder,
  config,
  explanation,
  example,
  error,
}: {
  type: ExerciseType;
  prompt: string;
  instructions: string;
  correctOrder: string[];
  config: ExerciseConfig;
  explanation: string;
  example: ExerciseExample | null;
  error?: string | null;
}) {
  return (
    <div className="space-y-3 card p-4">
      <div className="flex items-center gap-2">
        <Badge type={type} />
        <p className="font-medium text-ink">{prompt || "Enunciado del ejercicio"}</p>
      </div>
      {instructions && <p className="text-sm text-ink-muted">{instructions}</p>}
      {error && <p className="form-error">{error}</p>}
      <ActivityRunner
        type={type}
        config={config}
        correctOrder={correctOrder}
        options={[]}
        answer={0}
      />
      {explanation && <p className="text-sm text-ink-muted">{explanation}</p>}
      {example && <ExerciseExamplePreview example={example} />}
    </div>
  );
}

export function ExamplePreview({
  type,
  title,
  prompt,
  config,
  steps,
  hints,
  explanation,
  error,
}: {
  type: ExerciseType;
  title: string;
  prompt: string;
  config: ExerciseConfig;
  steps: ExerciseStep[];
  hints: string[];
  explanation: string;
  error?: string | null;
}) {
  return (
    <div className="space-y-3 card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge type={type} />
        <p className="font-medium text-ink">{title || "Título del ejemplo"}</p>
      </div>
      <p className="text-sm text-ink-soft">{prompt}</p>
      {error && <p className="form-error">{error}</p>}
      <ActivityRunner
        type={type}
        config={config}
        correctOrder={[]}
        options={[]}
        answer={0}
      />
      <Steps steps={steps} />
      {hints.length > 0 && (
        <p className="text-xs text-ink-muted">Pistas: {hints.join(" · ")}</p>
      )}
      {explanation && <p className="text-sm text-ink-muted">{explanation}</p>}
    </div>
  );
}

export function QuestionPreview({
  type,
  prompt,
  options,
  answer,
  config,
  explanation,
  error,
}: {
  type: ActivityType;
  prompt: string;
  options: string[];
  answer: number;
  config: ExerciseConfig;
  explanation: string;
  error?: string | null;
}) {
  return (
    <div className="space-y-3 card p-4">
      <div className="flex items-center gap-2">
        <Badge type={type} />
        <p className="font-medium text-ink">{prompt || "Enunciado de la pregunta"}</p>
      </div>
      {error && <p className="form-error">{error}</p>}
      <ActivityRunner
        type={type}
        config={config}
        correctOrder={type === "order" ? options : []}
        options={options}
        answer={answer}
      />
      {explanation && <p className="text-sm text-ink-muted">{explanation}</p>}
    </div>
  );
}

export function LessonReadingPreview({
  title,
  eyebrow,
  body,
  codeSample,
  contextTitle,
  contextBody,
  synthesis,
  blocks,
  errors,
}: {
  title: string;
  eyebrow: string;
  body: string;
  codeSample: string;
  contextTitle: string;
  contextBody: string;
  synthesis: string[];
  blocks: ContentBlock[];
  errors: string[];
}) {
  return (
    <article className="space-y-4">
      {eyebrow && <p className="preview-eyebrow">{eyebrow}</p>}
      <h1 className="preview-title">{title || "Título de la lección"}</h1>
      {errors.length > 0 && (
        <ul className="preview-errors" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {body && <p className="preview-body">{body}</p>}

      {blocks.length === 0 ? (
        <p className="preview-empty">Todavía no hay bloques de contenido.</p>
      ) : (
        <div className="preview-prose">
          {blocks.map((block, index) => {
            if (block.type === "p") return <p key={index}>{block.text}</p>;
            if (block.type === "h") return <h2 key={index}>{block.text}</h2>;
            if (block.type === "bullets") {
              return (
                <ul key={index}>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              );
            }
            if (block.type === "numbers") {
              return (
                <ol key={index}>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ol>
              );
            }
            return (
              <div key={index} className="overflow-auto">
                <table>
                  <thead>
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex}>{cell}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {(contextTitle || contextBody) && (
        <section className="preview-context">
          {contextTitle && <h2>{contextTitle}</h2>}
          {contextBody && <p>{contextBody}</p>}
        </section>
      )}

      {codeSample && <pre className="preview-code">{codeSample}</pre>}

      {synthesis.length > 0 && (
        <section className="preview-synthesis">
          <h2>Síntesis</h2>
          <ul>
            {synthesis.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
