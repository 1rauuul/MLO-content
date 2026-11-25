"use client";

import { useActionState, useEffect, useState } from "react";

import { RequiredMark } from "@/app/(panel)/required-mark";
import { createUnit, type ActionResult } from "@/lib/actions/content";

const inputClass = "field";
const DIFFICULTIES = ["Fundamental", "Intermedio", "Avanzado"] as const;
const COLOR_OPTIONS = [
  { value: "blue", label: "Azul", swatch: "bg-blue-500" },
  { value: "violet", label: "Violeta", swatch: "bg-violet-500" },
  { value: "green", label: "Verde", swatch: "bg-emerald-500" },
  { value: "amber", label: "Ámbar", swatch: "bg-amber-500" },
  { value: "orange", label: "Naranja", swatch: "bg-orange-500" },
  { value: "rose", label: "Rosa", swatch: "bg-rose-500" },
  { value: "teal", label: "Turquesa", swatch: "bg-teal-500" },
] as const;

type UnitColor = (typeof COLOR_OPTIONS)[number]["value"];
type UnitDraft = {
  title: string;
  description: string;
  difficulty: (typeof DIFFICULTIES)[number];
  color: UnitColor;
};

const EMPTY_DRAFT: UnitDraft = {
  title: "",
  description: "",
  difficulty: "Fundamental",
  color: "blue",
};

function isDifficulty(value: unknown): value is UnitDraft["difficulty"] {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

function isUnitColor(value: unknown): value is UnitColor {
  return (
    typeof value === "string" &&
    (COLOR_OPTIONS as readonly { value: string }[]).some((option) => option.value === value)
  );
}

function hasDraft(draft: UnitDraft): boolean {
  return Boolean(
    draft.title.trim() ||
      draft.description.trim() ||
      draft.difficulty !== "Fundamental" ||
      draft.color !== "blue",
  );
}

function readDraft(storageKey: string): UnitDraft | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UnitDraft>;
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      difficulty: isDifficulty(parsed.difficulty) ? parsed.difficulty : "Fundamental",
      color: isUnitColor(parsed.color) ? parsed.color : "blue",
    };
  } catch {
    return null;
  }
}

function writeDraft(storageKey: string, draft: UnitDraft) {
  try {
    if (hasDraft(draft)) localStorage.setItem(storageKey, JSON.stringify(draft));
    else localStorage.removeItem(storageKey);
  } catch {
    // localStorage puede estar bloqueado; no bloquea el alta.
  }
}

export function CreateUnitForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createUnit, {});
  const [open, setOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const [draft, setDraft] = useState<UnitDraft>(EMPTY_DRAFT);
  const storageKey = `mlo:unit-draft:${courseId}`;

  const selectedColor =
    COLOR_OPTIONS.find((option) => option.value === draft.color) ?? COLOR_OPTIONS[0];

  const updateDraft = (next: UnitDraft) => {
    setDraft(next);
    writeDraft(storageKey, next);
  };

  const toggle = () => {
    if (!open) {
      const saved = readDraft(storageKey);
      if (saved && hasDraft(saved)) {
        setDraft(saved);
        setRestored(true);
      }
    }
    setOpen((current) => !current);
  };

  useEffect(() => {
    if (!state.ok) return;
    writeDraft(storageKey, EMPTY_DRAFT);
    // Sincronización deliberada con el resultado del servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(EMPTY_DRAFT);
    setRestored(false);
  }, [state.ok, storageKey]);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Crear unidad</h2>
          <p className="mt-0.5 text-xs text-ink-muted">Organiza los subtemas del curso.</p>
          {restored && (
            <p className="mt-1 text-xs text-accent" role="status">
              Borrador restaurado.
            </p>
          )}
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className="btn btn-primary btn-sm"
        >
          {open ? "Cerrar" : "Agregar unidad"}
        </button>
      </div>

      {open && (
        <form action={action} className="grid max-w-xl gap-3 border-t border-line p-5">
          <input type="hidden" name="courseId" value={courseId} />

          <label className="field-label">
            <span>Título de la unidad <RequiredMark /></span>
            <input
              name="title"
              required
              value={draft.title}
              onChange={(event) => updateDraft({ ...draft, title: event.target.value })}
              placeholder="Ej. Fundamentos"
              aria-invalid={Boolean(state.error)}
              aria-describedby={state.error ? "unit-form-error" : undefined}
              className={inputClass}
            />
          </label>
          <label className="field-label">
            Descripción breve
            <textarea
              name="description"
              rows={2}
              value={draft.description}
              onChange={(event) => updateDraft({ ...draft, description: event.target.value })}
              placeholder="Opcional"
              className={inputClass}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
            <label className="field-label">
              Nivel
              <select
                name="difficulty"
                value={draft.difficulty}
                onChange={(event) =>
                  updateDraft({
                    ...draft,
                    difficulty: event.target.value as UnitDraft["difficulty"],
                  })
                }
                className={inputClass}
              >
                {DIFFICULTIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              <span className="flex items-center gap-2">
                Color de identificación
                <span
                  className={`size-3 rounded-full ${selectedColor.swatch}`}
                  aria-hidden="true"
                />
              </span>
              <select
                name="color"
                value={draft.color}
                onChange={(event) =>
                  updateDraft({ ...draft, color: event.target.value as UnitColor })
                }
                className={inputClass}
              >
                {COLOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="submit" disabled={pending} className="btn btn-primary justify-self-start">
            {pending ? "Agregando…" : "Crear unidad"}
          </button>

          <p className="text-xs text-ink-faint">* Campo obligatorio</p>

          {state.error && (
            <p id="unit-form-error" className="form-error" role="alert">
              {state.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
