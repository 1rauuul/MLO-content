"use client";

import type {
  ExerciseConfig,
  ExerciseExample,
  ExerciseStep,
  ExerciseType,
} from "@/lib/content/model";

const TYPE_LABEL: Record<ExerciseType, string> = {
  order: "Ordenar",
  fill: "Completar",
  match: "Relacionar",
  crossword: "Crucigrama",
};

function Badge({ type }: { type: ExerciseType }) {
  return (
    <span className="badge badge-neutral">
      {TYPE_LABEL[type]}
    </span>
  );
}

function FillText({ sentence }: { sentence: string }) {
  const parts = sentence.split(/(\{\{.+?\}\})/g);
  return (
    <p>
      {parts.map((part, index) =>
        part.startsWith("{{") ? (
          <mark key={index} className="rounded bg-warning-soft px-1 text-ink">
            {part.slice(2, -2)}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

function CrosswordGrid({ config }: { config: ExerciseConfig }) {
  const crossword = config.crossword;
  if (!crossword) return null;

  const letters = new Map<string, string>();
  for (const entry of crossword.entries) {
    for (let offset = 0; offset < entry.word.length; offset += 1) {
      const row = entry.row + (entry.direction === "down" ? offset : 0);
      const col = entry.col + (entry.direction === "across" ? offset : 0);
      letters.set(`${row}-${col}`, entry.word[offset] ?? "");
    }
  }

  return (
    <div className="overflow-auto">
      <div
        className="inline-grid gap-px bg-line-strong"
        style={{ gridTemplateColumns: `repeat(${crossword.cols}, 1.5rem)` }}
      >
        {Array.from({ length: crossword.rows * crossword.cols }, (_, index) => {
          const row = Math.floor(index / crossword.cols);
          const col = index % crossword.cols;
          return (
            <div
              key={index}
              className="flex h-6 items-center justify-center bg-white text-xs font-medium text-ink-soft"
            >
              {letters.get(`${row}-${col}`) ?? ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TypePreview({
  type,
  config,
  correctOrder,
}: {
  type: ExerciseType;
  config: ExerciseConfig;
  correctOrder: string[];
}) {
  if (type === "order") {
    return (
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
        {correctOrder.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ol>
    );
  }

  if (type === "fill") {
    return (
      <div className="space-y-2 text-sm text-ink-soft">
        {(config.sentences ?? []).map((sentence, index) => (
          <FillText key={index} sentence={sentence} />
        ))}
        {(config.bank ?? []).length > 0 && (
          <p className="text-xs text-ink-muted">
            Palabras extra: {config.bank?.join(" · ")}
          </p>
        )}
      </div>
    );
  }

  if (type === "match") {
    return (
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {(config.pairs ?? []).map((pair, index) => (
          <div key={index} className="rounded-lg border border-line p-2">
            <strong className="block text-ink-soft">{pair.left}</strong>
            <span className="text-ink-muted">{pair.right}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <CrosswordGrid config={config} />
      <ul className="space-y-1 text-sm text-ink-soft">
        {(config.crossword?.entries ?? []).map((entry, index) => (
          <li key={index}>
            <span className="font-mono text-xs text-ink-faint">
              {entry.row},{entry.col} {entry.direction === "across" ? "H" : "V"}
            </span>{" "}
            {entry.word}: {entry.clue}
          </li>
        ))}
      </ul>
      {(config.bank ?? []).length > 0 && (
        <p className="text-xs text-ink-muted">Palabras extra: {config.bank?.join(" · ")}</p>
      )}
    </div>
  );
}

function Steps({ steps }: { steps: ExerciseStep[] }) {
  return (
    <ol className="space-y-2 text-sm">
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

export function ExercisePreview({
  type,
  prompt,
  instructions,
  correctOrder,
  config,
  explanation,
  example,
}: {
  type: ExerciseType;
  prompt: string;
  instructions: string;
  correctOrder: string[];
  config: ExerciseConfig;
  explanation: string;
  example: ExerciseExample | null;
}) {
  return (
    <div className="space-y-3 card p-4">
      <div className="flex items-center gap-2">
        <Badge type={type} />
        <p className="font-medium text-ink">{prompt || "Enunciado del ejercicio"}</p>
      </div>
      {instructions && <p className="text-sm text-ink-muted">{instructions}</p>}
      <TypePreview type={type} config={config} correctOrder={correctOrder} />
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
}: {
  type: ExerciseType;
  title: string;
  prompt: string;
  config: ExerciseConfig;
  steps: ExerciseStep[];
  hints: string[];
  explanation: string;
}) {
  return (
    <div className="space-y-3 card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge type={type} />
        <p className="font-medium text-ink">{title || "Título del ejemplo"}</p>
      </div>
      <p className="text-sm text-ink-soft">{prompt}</p>
      <TypePreview type={type} config={config} correctOrder={[]} />
      <Steps steps={steps} />
      {hints.length > 0 && (
        <p className="text-xs text-ink-muted">Pistas: {hints.join(" · ")}</p>
      )}
      {explanation && <p className="text-sm text-ink-muted">{explanation}</p>}
    </div>
  );
}
