"use client";

import { useState } from "react";

import { BLOCK_LABELS, emptyBlock, type BlockType, type ContentBlock } from "@/lib/content";

const buttonClass =
  "rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50";

const textareaClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

export function BlockEditor({
  initial,
  label = "Contenido de la lección",
}: {
  initial: ContentBlock[];
  label?: string;
}) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(initial);

  function replace(index: number, block: ContentBlock) {
    setBlocks((current) => current.map((item, i) => (i === index ? block : item)));
  }

  function move(index: number, delta: number) {
    setBlocks((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index: number) {
    setBlocks((current) => current.filter((_, i) => i !== index));
  }

  function renderEditor(block: ContentBlock, index: number) {
    switch (block.type) {
      case "p":
      case "h":
        return (
          <textarea
            rows={block.type === "h" ? 1 : 4}
            value={block.text}
            onChange={(event) => replace(index, { type: block.type, text: event.target.value })}
            className={textareaClass}
          />
        );

      case "bullets":
      case "numbers":
        return (
          <label className="block text-xs text-zinc-500">
            Un elemento por línea
            <textarea
              rows={4}
              value={block.items.join("\n")}
              onChange={(event) =>
                replace(index, { type: block.type, items: event.target.value.split("\n") })
              }
              className={textareaClass}
            />
          </label>
        );

      case "table":
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-500">
              Encabezados (uno por línea)
              <textarea
                rows={3}
                value={block.header.join("\n")}
                onChange={(event) =>
                  replace(index, {
                    type: "table",
                    header: event.target.value.split("\n"),
                    rows: block.rows,
                  })
                }
                className={textareaClass}
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Filas (una por línea, celdas separadas por |)
              <textarea
                rows={3}
                value={block.rows.map((row) => row.join(" | ")).join("\n")}
                onChange={(event) =>
                  replace(index, {
                    type: "table",
                    header: block.header,
                    rows: event.target.value
                      .split("\n")
                      .map((line) => line.split("|").map((cell) => cell.trim())),
                  })
                }
                className={textareaClass}
              />
            </label>
          </div>
        );
    }
  }

  return (
    <section className="space-y-3">
      <input type="hidden" name="content" value={JSON.stringify(blocks)} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-900">{label}</span>
        {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setBlocks((current) => [...current, emptyBlock(type)])}
            className={buttonClass}
          >
            + {BLOCK_LABELS[type]}
          </button>
        ))}
      </div>

      {blocks.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
          Agrega el primer bloque.
        </p>
      )}

      {blocks.map((block, index) => (
        <article key={index} className="rounded-lg border border-zinc-200 p-4">
          <header className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              {BLOCK_LABELS[block.type]}
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(index, -1)} className={buttonClass}>
                ↑
              </button>
              <button type="button" onClick={() => move(index, 1)} className={buttonClass}>
                ↓
              </button>
              <button type="button" onClick={() => remove(index)} className={buttonClass}>
                Quitar
              </button>
            </div>
          </header>
          {renderEditor(block, index)}
        </article>
      ))}
    </section>
  );
}
