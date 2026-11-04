"use client";

import type { CrosswordEntry, ExerciseStep, MatchPair } from "@/lib/content/model";

export const fieldClass = "field";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field-label">
      {label}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-danger btn-sm shrink-0"
      aria-label="Quitar"
    >
      Quitar
    </button>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-fit rounded-[var(--radius-control)] border border-dashed border-line-strong px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
    >
      {children}
    </button>
  );
}

export function TextList({
  label,
  values,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const update = (index: number, value: string) =>
    onChange(values.map((item, position) => (position === index ? value : item)));

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-soft">{label}</p>
      {hint && <p className="hint">{hint}</p>}
      {values.map((value, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={value}
            onChange={(event) => update(index, event.target.value)}
            placeholder={placeholder}
            className={fieldClass}
          />
          <RemoveButton onClick={() => onChange(values.filter((_, i) => i !== index))} />
        </div>
      ))}
      <AddButton onClick={() => onChange([...values, ""])}>Agregar</AddButton>
    </div>
  );
}

export function PairsEditor({
  pairs,
  onChange,
}: {
  pairs: MatchPair[];
  onChange: (pairs: MatchPair[]) => void;
}) {
  const update = (index: number, key: keyof MatchPair, value: string) =>
    onChange(
      pairs.map((pair, position) =>
        position === index ? { ...pair, [key]: value } : pair,
      ),
    );

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-soft">Pares</p>
      {pairs.map((pair, index) => (
        <div key={index} className="flex flex-wrap gap-2 sm:flex-nowrap">
          <input
            value={pair.left}
            onChange={(event) => update(index, "left", event.target.value)}
            placeholder="Izquierda"
            aria-label={`Izquierda ${index + 1}`}
            className={fieldClass}
          />
          <input
            value={pair.right}
            onChange={(event) => update(index, "right", event.target.value)}
            placeholder="Derecha"
            aria-label={`Derecha ${index + 1}`}
            className={fieldClass}
          />
          <RemoveButton onClick={() => onChange(pairs.filter((_, i) => i !== index))} />
        </div>
      ))}
      <AddButton onClick={() => onChange([...pairs, { left: "", right: "" }])}>
        Agregar par
      </AddButton>
    </div>
  );
}

export function StepsEditor({
  steps,
  onChange,
}: {
  steps: ExerciseStep[];
  onChange: (steps: ExerciseStep[]) => void;
}) {
  const update = (index: number, key: keyof ExerciseStep, value: string) =>
    onChange(
      steps.map((step, position) =>
        position === index ? { ...step, [key]: value } : step,
      ),
    );

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-soft">Pasos del ejemplo</p>
      {steps.map((step, index) => (
        <div
          key={index}
          className="space-y-2 rounded-[var(--radius-control)] border border-line bg-surface-soft/40 p-3"
        >
          <div className="flex items-start gap-2">
            <textarea
              value={step.text}
              onChange={(event) => update(index, "text", event.target.value)}
              placeholder="Qué se hace"
              aria-label={`Qué se hace en el paso ${index + 1}`}
              rows={2}
              className={fieldClass}
            />
            <RemoveButton onClick={() => onChange(steps.filter((_, i) => i !== index))} />
          </div>
          <textarea
            value={step.why}
            onChange={(event) => update(index, "why", event.target.value)}
            placeholder="Por qué se hace así"
            aria-label={`Por qué se hace así en el paso ${index + 1}`}
            rows={2}
            className={fieldClass}
          />
        </div>
      ))}
      <AddButton onClick={() => onChange([...steps, { text: "", why: "" }])}>
        Agregar paso
      </AddButton>
    </div>
  );
}

export function EntriesEditor({
  entries,
  onChange,
}: {
  entries: CrosswordEntry[];
  onChange: (entries: CrosswordEntry[]) => void;
}) {
  const update = <K extends keyof CrosswordEntry>(
    index: number,
    key: K,
    value: CrosswordEntry[K],
  ) =>
    onChange(
      entries.map((entry, position) =>
        position === index ? { ...entry, [key]: value } : entry,
      ),
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">Entradas del crucigrama</p>
      {entries.map((entry, index) => (
        <div
          key={index}
          className="space-y-2 rounded-[var(--radius-control)] border border-line bg-surface-soft/40 p-3"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={entry.word}
              onChange={(event) => update(index, "word", event.target.value)}
              placeholder="PALABRA"
              aria-label={`Palabra ${index + 1}`}
              className={`${fieldClass} font-mono uppercase`}
            />
            <input
              value={entry.clue}
              onChange={(event) => update(index, "clue", event.target.value)}
              placeholder="Pista"
              aria-label={`Pista ${index + 1}`}
              className={fieldClass}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="field-label text-xs">
              Fila
              <input
                type="number"
                min={0}
                value={entry.row}
                onChange={(event) => update(index, "row", Number(event.target.value))}
                className={fieldClass}
              />
            </label>
            <label className="field-label text-xs">
              Columna
              <input
                type="number"
                min={0}
                value={entry.col}
                onChange={(event) => update(index, "col", Number(event.target.value))}
                className={fieldClass}
              />
            </label>
            <label className="field-label text-xs">
              Dirección
              <select
                value={entry.direction}
                onChange={(event) =>
                  update(index, "direction", event.target.value as CrosswordEntry["direction"])
                }
                className={fieldClass}
              >
                <option value="across">Horizontal</option>
                <option value="down">Vertical</option>
              </select>
            </label>
            <div className="flex items-end">
              <RemoveButton onClick={() => onChange(entries.filter((_, i) => i !== index))} />
            </div>
          </div>
        </div>
      ))}
      <AddButton
        onClick={() =>
          onChange([
            ...entries,
            { word: "", clue: "", row: 0, col: 0, direction: "across" },
          ])
        }
      >
        Agregar entrada
      </AddButton>
    </div>
  );
}
