"use client";

import { useState } from "react";

import type { ExerciseConfig, ExerciseType } from "@/lib/content/model";
import {
  checkCrossword,
  checkFill,
  checkMatch,
  checkOrder,
  crosswordSolution,
  fillHoles,
  type PreviewResult,
} from "@/lib/content/preview";

const COLORS = ["#ee6f7d", "#45d39a", "#f3bc61", "#4d7cfe"];

const DEFAULT_INSTRUCTIONS: Record<ExerciseType, string> = {
  order:
    "Ordena las actividades según la secuencia estudiada. Arrastra las tarjetas o usa las flechas.",
  fill:
    "Toca una palabra y después un espacio. Toca una respuesta para devolverla al banco.",
  match:
    "Toca un concepto y después la definición que le corresponde. Cada par se marca con su color.",
  crossword:
    "Toca una celda y escribe la palabra que corresponde a la pista. Escribe sin tildes.",
};

function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronUp() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="size-4 shrink-0 text-[#718096]"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled = false,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="grid size-8 shrink-0 place-items-center rounded-xl border border-[#324050] bg-[#263447] text-[#f4f7fb] transition-colors hover:border-[#4d7cfe] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#324050]"
    >
      {children}
    </button>
  );
}

function ActivityHeader({
  eyebrow,
  title,
  instructions,
  progress,
}: {
  eyebrow: string;
  title: string;
  instructions: string;
  progress?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <IconButton label="Volver">
          <ChevronLeft />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#9cabbc]">
            {eyebrow}
          </p>
          <h3 className="mt-0.5 text-balance text-[20px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#f4f7fb]">
            {title}
          </h3>
        </div>
        {progress ? (
          <span className="pt-1 font-mono text-[10px] font-bold text-[#f4f7fb]">
            {progress}
          </span>
        ) : (
          <IconButton label="Siguiente">
            <ChevronRight />
          </IconButton>
        )}
      </div>

      {progress && (
        <div className="h-1 overflow-hidden rounded-full bg-[#263447]">
          <div
            className="h-full rounded-full bg-[#4d7cfe]"
            style={{ width: "10%" }}
          />
        </div>
      )}

      {instructions && (
        <p className="text-xs leading-relaxed text-[#9cabbc]">{instructions}</p>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        variant === "primary"
          ? "bg-[#4d7cfe] text-white hover:bg-[#6b91ff]"
          : "border border-[#324050] bg-[#263447] text-[#f4f7fb] hover:border-[#4d7cfe]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Feedback({ result }: { result: PreviewResult | null }) {
  if (!result) return null;
  return (
    <p
      className={`text-xs font-medium ${
        result.correct ? "text-[#45d39a]" : "text-[#ee6f7d]"
      }`}
      role="status"
    >
      {result.message}
    </p>
  );
}

function Hint({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="text-xs text-[#9cabbc]">{text}</p>;
}

function EmptyActivity({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[#324050] px-3 py-4 text-xs leading-relaxed text-[#9cabbc]">
      {text}
    </p>
  );
}

export function MloExerciseActivity({
  type,
  prompt,
  instructions,
  correctOrder,
  config,
  explanation,
}: {
  type: ExerciseType;
  prompt: string;
  instructions: string;
  correctOrder: string[];
  config: ExerciseConfig;
  explanation: string;
}) {
  if (type === "order") {
    return (
      <MloOrderActivity
        prompt={prompt}
        instructions={instructions}
        correctOrder={correctOrder}
        explanation={explanation}
      />
    );
  }

  if (type === "fill") {
    return (
      <MloFillActivity
        prompt={prompt}
        instructions={instructions}
        config={config}
        explanation={explanation}
      />
    );
  }

  if (type === "match") {
    return (
      <MloMatchActivity
        prompt={prompt}
        instructions={instructions}
        config={config}
        explanation={explanation}
      />
    );
  }

  return (
    <MloCrosswordActivity
      prompt={prompt}
      instructions={instructions}
      config={config}
      explanation={explanation}
    />
  );
}

function MloOrderActivity({
  prompt,
  instructions,
  correctOrder,
  explanation,
}: {
  prompt: string;
  instructions: string;
  correctOrder: string[];
  explanation: string;
}) {
  const [order, setOrder] = useState(() =>
    correctOrder.length > 1 ? [...correctOrder].reverse() : correctOrder,
  );
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setResult(null);
    setHint(null);
  };

  return (
    <div className="space-y-4">
      <ActivityHeader
        eyebrow="EJERCICIO · ORDENA"
        title={prompt || "Ejercicio de ordenar"}
        instructions={instructions || DEFAULT_INSTRUCTIONS.order}
      />

      {order.length === 0 ? (
        <EmptyActivity text="Agrega al menos dos elementos para ver la actividad." />
      ) : (
        <div className="space-y-2">
          {order.map((item, index) => {
            const color = COLORS[index % COLORS.length];
            return (
              <div
                key={`${item}-${index}`}
                className="flex items-center gap-2 rounded-[14px] border bg-[#1e2835] p-3"
                style={{ borderColor: color }}
              >
                <GripIcon />
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-md font-mono text-[10px] font-bold"
                  style={{ backgroundColor: `${color}24`, color }}
                >
                  {index + 1}
                </span>
                <p className="min-w-0 flex-1 text-sm leading-snug text-[#f4f7fb]">
                  {item}
                </p>
                <span className="flex shrink-0 gap-1.5">
                  <IconButton
                    label="Subir"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    <ChevronUp />
                  </IconButton>
                  <IconButton
                    label="Bajar"
                    onClick={() => move(index, 1)}
                    disabled={index === order.length - 1}
                  >
                    <ChevronDown />
                  </IconButton>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <ActionButton
        onClick={() => {
          setResult(checkOrder(correctOrder, order));
          setHint(null);
        }}
        className="w-full"
      >
        Comprobar
      </ActionButton>
      <Feedback result={result} />
      <Hint text={hint} />

      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          variant="secondary"
          onClick={() => {
            setHint("Fíjate en el orden cronológico de los elementos.");
            setResult(null);
          }}
        >
          <SearchIcon />
          Ver pista
        </ActionButton>
        <ActionButton
          variant="secondary"
          onClick={() => {
            setOrder([...correctOrder]);
            setResult(null);
            setHint(null);
          }}
        >
          Ver solución
        </ActionButton>
      </div>

      {explanation && (
        <p className="rounded-xl bg-[#263447] p-3 text-xs leading-relaxed text-[#9cabbc]">
          {explanation}
        </p>
      )}
    </div>
  );
}

function MloFillActivity({
  prompt,
  instructions,
  config,
  explanation,
}: {
  prompt: string;
  instructions: string;
  config: ExerciseConfig;
  explanation: string;
}) {
  const sentences = config.sentences ?? [];
  const holes = fillHoles(sentences);
  const bank = [...new Set([...holes, ...(config.bank ?? [])])].filter(Boolean);
  const [answers, setAnswers] = useState(() => holes.map(() => ""));
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const fillWord = (word: string) => {
    const index = answers.findIndex((answer) => !answer);
    if (index < 0) return;
    const next = [...answers];
    next[index] = word;
    setAnswers(next);
    setResult(null);
    setHint(null);
  };

  const clearHole = (index: number) => {
    const next = [...answers];
    next[index] = "";
    setAnswers(next);
    setResult(null);
  };

  const sentenceParts = sentences.map((sentence, sentenceIndex) => {
    const parts = sentence.split(/(\{\{.+?\}\})/g);
    const holesBefore = sentences.slice(0, sentenceIndex).reduce(
      (total, previous) => total + (previous.match(/\{\{/g)?.length ?? 0),
      0,
    );

    return {
      sentenceIndex,
      holesBefore,
      parts: parts.map((part, partIndex) => ({
        part,
        partIndex,
        holeOffset: parts
          .slice(0, partIndex)
          .filter((previous) => previous.startsWith("{{")).length,
      })),
    };
  });

  return (
    <div className="space-y-4">
      <ActivityHeader
        eyebrow="EJERCICIO · COMPLETA"
        title={prompt || "Ejercicio para completar"}
        instructions={instructions || DEFAULT_INSTRUCTIONS.fill}
      />

      {sentences.length === 0 ? (
        <EmptyActivity text="Agrega al menos una oración con espacios {{…}}." />
      ) : (
        <div className="space-y-3 text-sm leading-7 text-[#f4f7fb]">
          {sentenceParts.map(({ sentenceIndex, holesBefore, parts }) => (
            <p key={sentenceIndex}>
              {parts.map(({ part, partIndex, holeOffset }) => {
                if (!part.startsWith("{{")) {
                  return <span key={partIndex}>{part}</span>;
                }
                const current = holesBefore + holeOffset;
                return (
                  <button
                    key={partIndex}
                    type="button"
                    onClick={() => clearHole(current)}
                    className="mx-1 inline-flex min-w-16 justify-center border-b border-[#5a6b82] px-1 text-[#f4f7fb]"
                    aria-label={`Hueco ${current + 1}`}
                  >
                    {answers[current] || "\u00A0"}
                  </button>
                );
              })}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#9cabbc]">
          Palabras disponibles
        </p>
        <div className="flex flex-wrap gap-2">
          {bank.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => fillWord(word)}
              className="rounded-lg border border-[#324050] bg-[#263447] px-3 py-1.5 text-xs text-[#f4f7fb] transition-colors hover:border-[#4d7cfe]"
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          onClick={() => {
            setResult(checkFill(sentences, answers));
            setHint(null);
          }}
        >
          Comprobar
        </ActionButton>
        <ActionButton
          variant="secondary"
          onClick={() => {
            setAnswers(holes.map(() => ""));
            setResult(null);
            setHint(null);
          }}
        >
          Reiniciar
        </ActionButton>
      </div>
      <Feedback result={result} />
      <Hint text={hint} />

      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          variant="secondary"
          onClick={() => {
            setHint("Las respuestas están en las palabras disponibles.");
            setResult(null);
          }}
        >
          <SearchIcon />
          Ver pista
        </ActionButton>
        <ActionButton
          variant="secondary"
          onClick={() => {
            setAnswers(holes);
            setResult(null);
            setHint(null);
          }}
        >
          Ver solución
        </ActionButton>
      </div>

      {explanation && (
        <p className="rounded-xl bg-[#263447] p-3 text-xs leading-relaxed text-[#9cabbc]">
          {explanation}
        </p>
      )}
    </div>
  );
}

function MloMatchActivity({
  prompt,
  instructions,
  config,
  explanation,
}: {
  prompt: string;
  instructions: string;
  config: ExerciseConfig;
  explanation: string;
}) {
  const pairs = config.pairs ?? [];
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const rights = pairs.map((pair, index) => ({ text: pair.right, index })).reverse();

  const selectRight = (rightIndex: number) => {
    if (selectedLeft === null) return;
    setMatches((current) => ({ ...current, [selectedLeft]: rightIndex }));
    setSelectedLeft(null);
    setResult(null);
    setHint(null);
  };

  const selection: Record<string, string> = {};
  for (const [leftIndex, rightIndex] of Object.entries(matches)) {
    selection[pairs[Number(leftIndex)]?.left ?? ""] =
      pairs[Number(rightIndex)]?.right ?? "";
  }

  return (
    <div className="space-y-4">
      <ActivityHeader
        eyebrow="EJERCICIO · ENLAZA"
        title={prompt || "Ejercicio para relacionar"}
        instructions={instructions || DEFAULT_INSTRUCTIONS.match}
      />

      {pairs.length === 0 ? (
        <EmptyActivity text="Agrega al menos dos pares para ver la actividad." />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            {pairs.map((pair, index) => {
              const color = COLORS[index % COLORS.length];
              const selected = selectedLeft === index;
              return (
                <button
                  key={`${pair.left}-${index}`}
                  type="button"
                  onClick={() => setSelectedLeft(index)}
                  className="flex min-h-16 w-full items-center gap-2 rounded-[14px] border bg-[#1e2835] p-3 text-left text-xs leading-snug text-[#f4f7fb] transition-colors"
                  style={{
                    borderColor: color,
                    boxShadow: selected ? `0 0 0 2px ${color}55` : undefined,
                  }}
                >
                  <span
                    className="size-5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span>{pair.left || "Concepto"}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            {rights.map((right) => {
              const matchedLeft = Object.entries(matches).find(
                ([, value]) => value === right.index,
              )?.[0];
              const color =
                matchedLeft !== undefined
                  ? COLORS[Number(matchedLeft) % COLORS.length]
                  : "#324050";

              return (
                <button
                  key={`${right.text}-${right.index}`}
                  type="button"
                  onClick={() => selectRight(right.index)}
                  className="flex min-h-16 w-full items-center gap-2 rounded-[14px] border bg-[#1e2835] p-3 text-left text-xs leading-snug text-[#f4f7fb] transition-colors"
                  style={{ borderColor: color }}
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#263447] font-mono text-[9px] text-[#9cabbc]">
                    {right.index + 1}
                  </span>
                  <span>{right.text || "Definición"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          onClick={() => {
            setResult(checkMatch(pairs, selection));
            setHint(null);
          }}
        >
          Comprobar
        </ActionButton>
        <ActionButton
          variant="secondary"
          onClick={() => {
            setMatches({});
            setSelectedLeft(null);
            setResult(null);
            setHint(null);
          }}
        >
          Reintentar
        </ActionButton>
      </div>
      <Feedback result={result} />
      <Hint text={hint} />

      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          variant="secondary"
          onClick={() => {
            setHint("Asigna cada concepto a la definición que le corresponde.");
            setResult(null);
          }}
        >
          <SearchIcon />
          Ver pista
        </ActionButton>
        <ActionButton
          variant="secondary"
          onClick={() => {
            const solution: Record<number, number> = {};
            pairs.forEach((_, index) => {
              solution[index] = index;
            });
            setMatches(solution);
            setSelectedLeft(null);
            setResult(null);
            setHint(null);
          }}
        >
          Ver solución
        </ActionButton>
      </div>

      {explanation && (
        <p className="rounded-xl bg-[#263447] p-3 text-xs leading-relaxed text-[#9cabbc]">
          {explanation}
        </p>
      )}
    </div>
  );
}

function MloCrosswordActivity({
  prompt,
  instructions,
  config,
  explanation,
}: {
  prompt: string;
  instructions: string;
  config: ExerciseConfig;
  explanation: string;
}) {
  const solution = crosswordSolution(config);
  const entries = config.crossword?.entries ?? [];
  const [letters, setLetters] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  if (!solution) {
    return (
      <div className="space-y-4">
        <ActivityHeader
          eyebrow="EJERCICIO · CRUCIGRAMA"
          title={prompt || "Ejercicio de crucigrama"}
          instructions={instructions || DEFAULT_INSTRUCTIONS.crossword}
        />
        <EmptyActivity text="Completa la cuadrícula del crucigrama para verlo aquí." />
      </div>
    );
  }

  const numbers = new Map<string, number>();
  let counter = 0;
  for (const entry of [...entries].sort(
    (left, right) => left.row - right.row || left.col - right.col,
  )) {
    const key = `${entry.row}-${entry.col}`;
    if (!numbers.has(key)) {
      counter += 1;
      numbers.set(key, counter);
    }
  }

  const clues = entries.map((entry, index) => {
    const previous = entries.slice(0, index);
    const code =
      entry.direction === "across"
        ? `H${previous.filter((item) => item.direction === "across").length + 1}`
        : `V${previous.filter((item) => item.direction === "down").length + 1}`;
    return { code, entry };
  });

  const bank = [
    ...new Set([...entries.map((entry) => entry.word), ...(config.bank ?? [])]),
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <ActivityHeader
        eyebrow="EJERCICIO · CRUCIGRAMA"
        title={prompt || "Ejercicio de crucigrama"}
        instructions={instructions || DEFAULT_INSTRUCTIONS.crossword}
      />

      <div className="mx-auto grid w-full max-w-[300px] gap-px" style={{ gridTemplateColumns: `repeat(${solution.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: solution.rows * solution.cols }, (_, index) => {
          const row = Math.floor(index / solution.cols);
          const col = index % solution.cols;
          const key = `${row}-${col}`;
          const active = key in solution.cells;
          if (!active) return <span key={key} className="aspect-square" />;

          return (
            <div
              key={key}
              className="relative aspect-square border border-[#324050] bg-[#1e2835]"
            >
              {numbers.has(key) && (
                <span className="absolute left-0.5 top-0 font-mono text-[7px] leading-none text-[#9cabbc]">
                  {numbers.get(key)}
                </span>
              )}
              <input
                value={letters[key] ?? ""}
                maxLength={1}
                onChange={(event) => {
                  setLetters((current) => ({
                    ...current,
                    [key]: event.target.value.toUpperCase(),
                  }));
                  setResult(null);
                  setHint(null);
                }}
                aria-label={`Fila ${row + 1}, columna ${col + 1}`}
                className="h-full w-full bg-transparent pt-2 text-center text-[12px] font-semibold uppercase text-[#f4f7fb] outline-none"
              />
            </div>
          );
        })}
      </div>

      <div className="rounded-[12px] border border-[#324050] bg-[#263447] px-3 py-2.5 text-sm text-[#9cabbc]">
        Toca una pista para escribir
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#9cabbc]">
          Palabras disponibles
        </p>
        <div className="flex flex-wrap gap-2">
          {bank.map((word) => (
            <span
              key={word}
              className="rounded-lg border border-[#324050] bg-[#263447] px-3 py-1.5 text-xs text-[#f4f7fb]"
            >
              {word}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {clues.map(({ code, entry }, index) => (
          <div
            key={`${code}-${entry.word}-${index}`}
            className="rounded-[12px] border border-[#324050] bg-[#1e2835] p-3"
          >
            <p className="font-mono text-[9px] font-bold text-[#4d7cfe]">{code}</p>
            <p className="mt-1 text-xs leading-relaxed text-[#f4f7fb]">
              {entry.clue || "Pista pendiente."}
            </p>
            <p className="mt-1 text-[10px] text-[#9cabbc]">
              {entry.word.length} letras
            </p>
          </div>
        ))}
      </div>

      <ActionButton
        onClick={() => {
          setResult(checkCrossword(config, letters));
          setHint(null);
        }}
        className="w-full"
      >
        Comprobar crucigrama
      </ActionButton>
      <Feedback result={result} />
      <Hint text={hint} />

      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          variant="secondary"
          onClick={() => {
            setHint("Usa las pistas y el banco de palabras.");
            setResult(null);
          }}
        >
          <SearchIcon />
          Ver pista
        </ActionButton>
        <ActionButton
          variant="secondary"
          onClick={() => {
            setLetters(solution.cells);
            setResult(null);
            setHint(null);
          }}
        >
          Ver solución
        </ActionButton>
      </div>

      {explanation && (
        <p className="rounded-xl bg-[#263447] p-3 text-xs leading-relaxed text-[#9cabbc]">
          {explanation}
        </p>
      )}
    </div>
  );
}

export function MloEvaluationActivity({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const options = ["Opción A", "Opción B", "Opción C", "Opción D"];
  const question = description.trim() || "¿Qué concepto se evalúa en este subtema?";

  return (
    <div className="space-y-4">
      <ActivityHeader
        eyebrow="REACTIVO 01 · OPCIÓN MÚLTIPLE"
        title={title || "Evaluación"}
        instructions=""
        progress="1 / 10"
      />

      <p className="text-[15px] font-medium leading-relaxed text-[#f4f7fb]">
        {question}
      </p>

      <div className="space-y-2">
        {options.map((option, index) => {
          const active = selected === index;
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                setSelected(index);
                setFeedback(null);
              }}
              className={`flex w-full items-start gap-3 rounded-[14px] border p-3 text-left text-sm leading-snug transition-colors ${
                active
                  ? "border-[#4d7cfe] bg-[#263447] text-[#f4f7fb]"
                  : "border-[#324050] bg-[#1e2835] text-[#f4f7fb] hover:border-[#4d7cfe]"
              }`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold ${
                  active
                    ? "bg-[#4d7cfe] text-white"
                    : "bg-[#263447] text-[#9cabbc]"
                }`}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ActionButton variant="secondary" disabled>
          Anterior
        </ActionButton>
        <ActionButton
          onClick={() =>
            setFeedback(
              selected === null ? "Selecciona una opción." : "Respuesta enviada.",
            )
          }
        >
          Enviar
        </ActionButton>
      </div>
      {feedback && (
        <p
          className={`text-xs font-medium ${
            selected === null ? "text-[#ee6f7d]" : "text-[#45d39a]"
          }`}
          role="status"
        >
          {feedback}
        </p>
      )}

      <p className="text-center text-[10px] leading-snug text-[#9cabbc]">
        Vista de ejemplo. Agrega preguntas para verlas aquí.
      </p>
    </div>
  );
}
