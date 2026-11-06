"use client";

import { useEffect, useState } from "react";

import { BLOCK_LABELS, emptyBlock, type BlockType, type ContentBlock } from "@/lib/content";

const buttonClass = "btn btn-secondary btn-sm";

const textareaClass = "field";

export function BlockEditor({
  initial,
  label = "Contenido de la lección",
  onChange,
}: {
  initial: ContentBlock[];
  label?: string;
  onChange?: (blocks: ContentBlock[]) => void;
}) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(initial);

  useEffect(() => {
    onChange?.(blocks);
  }, [blocks, onChange]);

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
          <label className="block text-xs text-ink-muted">
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
            <label className="block text-xs text-ink-muted">
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
            <label className="block text-xs text-ink-muted">
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
        <span className="mr-1 text-xs text-ink-muted">Agregar bloque:</span>
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
        <p className="rounded-[var(--radius-control)] border border-dashed border-line-strong p-4 text-sm text-ink-muted">
          {label} está vacío. Agrega el primer bloque.
        </p>
      )}

      {blocks.map((block, index) => (
        <article key={index} className="rounded-xl border border-line bg-surface-soft/40 p-4">
          <header className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              <span className="grid size-5 place-items-center rounded bg-surface font-mono text-[10px] text-ink-faint ring-1 ring-line">
                {index + 1}
              </span>
              {BLOCK_LABELS[block.type]}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                className={`${buttonClass} px-2`}
                aria-label="Subir bloque"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                className={`${buttonClass} px-2`}
                aria-label="Bajar bloque"
              >
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
