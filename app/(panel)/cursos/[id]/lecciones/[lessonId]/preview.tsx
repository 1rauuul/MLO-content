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
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
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
          <mark key={index} className="rounded bg-amber-100 px-1 text-zinc-900">
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
        className="inline-grid gap-px bg-zinc-300"
        style={{ gridTemplateColumns: `repeat(${crossword.cols}, 1.5rem)` }}
      >
        {Array.from({ length: crossword.rows * crossword.cols }, (_, index) => {
          const row = Math.floor(index / crossword.cols);
          const col = index % crossword.cols;
          return (
            <div
              key={index}
              className="flex h-6 items-center justify-center bg-white text-xs font-medium text-zinc-700"
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
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700">
        {correctOrder.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ol>
    );
  }

  if (type === "fill") {
    return (
      <div className="space-y-2 text-sm text-zinc-700">
        {(config.sentences ?? []).map((sentence, index) => (
          <FillText key={index} sentence={sentence} />
        ))}
        {(config.bank ?? []).length > 0 && (
          <p className="text-xs text-zinc-500">
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
          <div key={index} className="rounded-lg border border-zinc-200 p-2">
            <strong className="block text-zinc-800">{pair.left}</strong>
            <span className="text-zinc-500">{pair.right}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <CrosswordGrid config={config} />
      <ul className="space-y-1 text-sm text-zinc-700">
        {(config.crossword?.entries ?? []).map((entry, index) => (
          <li key={index}>
            <span className="font-mono text-xs text-zinc-400">
              {entry.row},{entry.col} {entry.direction === "across" ? "H" : "V"}
            </span>{" "}
            {entry.word}: {entry.clue}
          </li>
        ))}
      </ul>
      {(config.bank ?? []).length > 0 && (
        <p className="text-xs text-zinc-500">Palabras extra: {config.bank?.join(" · ")}</p>
      )}
    </div>
  );
}

function Steps({ steps }: { steps: ExerciseStep[] }) {
  return (
    <ol className="space-y-2 text-sm">
      {steps.map((step, index) => (
        <li key={index}>
          <span className="font-medium text-zinc-800">{step.text}</span>
          <span className="block text-zinc-500">{step.why}</span>
        </li>
      ))}
    </ol>
  );
}

export function ExerciseExamplePreview({ example }: { example: ExerciseExample }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-400">Ejemplo</p>
      <p className="mt-1 font-medium text-zinc-800">{example.title}</p>
      <Steps steps={example.steps} />
      {example.hints.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">Pistas: {example.hints.join(" · ")}</p>
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
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Badge type={type} />
        <p className="font-medium text-zinc-900">{prompt || "Enunciado del ejercicio"}</p>
      </div>
      {instructions && <p className="text-sm text-zinc-500">{instructions}</p>}
      <TypePreview type={type} config={config} correctOrder={correctOrder} />
      {explanation && <p className="text-sm text-zinc-500">{explanation}</p>}
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
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge type={type} />
        <p className="font-medium text-zinc-900">{title || "Título del ejemplo"}</p>
      </div>
      <p className="text-sm text-zinc-700">{prompt}</p>
      <TypePreview type={type} config={config} correctOrder={[]} />
      <Steps steps={steps} />
      {hints.length > 0 && (
        <p className="text-xs text-zinc-500">Pistas: {hints.join(" · ")}</p>
      )}
      {explanation && <p className="text-sm text-zinc-500">{explanation}</p>}
    </div>
  );
}
