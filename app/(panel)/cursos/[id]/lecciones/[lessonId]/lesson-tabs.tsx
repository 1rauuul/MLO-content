"use client";

import { useState, type ReactNode } from "react";

type Tab = "contenido" | "ejercicios" | "ejemplos";

export function LessonTabs({
  content,
  exercises,
  examples,
  exerciseCount,
  exampleCount,
}: {
  content: ReactNode;
  exercises: ReactNode;
  examples: ReactNode;
  exerciseCount: number;
  exampleCount: number;
}) {
  const [tab, setTab] = useState<Tab>("contenido");

  const tabs: { id: Tab; label: string }[] = [
    { id: "contenido", label: "Contenido" },
    { id: "ejercicios", label: `Ejercicios (${exerciseCount})` },
    { id: "ejemplos", label: `Ejemplos (${exampleCount})` },
  ];

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Secciones de la lección"
        className="flex flex-wrap gap-1 border-b border-line"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm transition-colors ${
              tab === item.id
                ? "border-accent font-medium text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "contenido" && content}
        {tab === "ejercicios" && exercises}
        {tab === "ejemplos" && examples}
      </div>
    </div>
  );
}
