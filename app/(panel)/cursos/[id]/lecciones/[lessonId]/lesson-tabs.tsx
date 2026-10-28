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
      <div className="flex flex-wrap gap-1 border-b border-zinc-200">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === item.id
                ? "border-zinc-900 font-medium text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "contenido" && content}
      {tab === "ejercicios" && exercises}
      {tab === "ejemplos" && examples}
    </div>
  );
}
