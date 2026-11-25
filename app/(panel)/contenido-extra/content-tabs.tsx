"use client";

import { useState, type ReactNode } from "react";

type Tab = "studio" | "extras";

export function ContentTabs({
  studio,
  extras,
  initialTab = "studio",
}: {
  studio: ReactNode;
  extras: ReactNode;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: { id: Tab; label: string }[] = [
    { id: "studio", label: "Contenido del grupo" },
    { id: "extras", label: "Aportaciones por lección" },
  ];

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Secciones de contenido"
        className="flex flex-wrap gap-1 border-b border-line"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            onClick={() => setTab(item.id)}
            className={`tab ${tab === item.id ? "tab-active" : "tab-inactive"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id="panel-studio"
        role="tabpanel"
        aria-labelledby="tab-studio"
        hidden={tab !== "studio"}
      >
        {studio}
      </div>
      <div
        id="panel-extras"
        role="tabpanel"
        aria-labelledby="tab-extras"
        hidden={tab !== "extras"}
      >
        {extras}
      </div>
    </div>
  );
}
