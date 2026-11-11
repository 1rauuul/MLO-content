"use client";

import { useEffect, useRef, useState } from "react";

import type { ContentBlock } from "@/lib/content";

type Format = "title" | "paragraph" | "subtitle" | "bullets" | "numbers" | "table";

const TOOLS: { format: Format; label: string }[] = [
  { format: "title", label: "Título" },
  { format: "paragraph", label: "Párrafo" },
  { format: "subtitle", label: "Subtítulo" },
  { format: "bullets", label: "Viñetas" },
  { format: "numbers", label: "Lista numerada" },
  { format: "table", label: "Tabla" },
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function htmlFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "p") return `<p>${escapeHtml(block.text)}</p>`;
      if (block.type === "h") return `<h2>${escapeHtml(block.text)}</h2>`;
      if (block.type === "bullets") {
        return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
      }
      if (block.type === "numbers") {
        return `<ol>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
      }
      return `<table><thead><tr>${block.header
        .map((cell) => `<th>${escapeHtml(cell)}</th>`)
        .join("")}</tr></thead><tbody>${block.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`;
    })
    .join("");
}

function textBlocks(value: string): ContentBlock[] {
  return value
    .replaceAll("\u00a0", " ")
    .split(/\r?\n+/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ type: "p" as const, text }));
}

function blocksFromNode(node: Node): ContentBlock[] {
  if (node.nodeType === Node.TEXT_NODE) return textBlocks(node.textContent ?? "");
  if (!(node instanceof HTMLElement) || node.tagName === "BR") return [];

  const tag = node.tagName;
  if (tag === "P") return textBlocks(node.innerText);
  if (/^H[1-6]$/.test(tag)) {
    const text = node.innerText.trim();
    return text ? [{ type: "h", text }] : [];
  }
  if (tag === "UL" || tag === "OL") {
    const items = Array.from(node.children)
      .filter((item) => item.tagName === "LI")
      .map((item) => item.textContent?.trim() ?? "")
      .filter(Boolean);
    return items.length > 0 ? [{ type: tag === "UL" ? "bullets" : "numbers", items }] : [];
  }
  if (tag === "TABLE") {
    const rows = Array.from((node as HTMLTableElement).rows).map((row) =>
      Array.from(row.cells).map((cell) => cell.textContent?.trim() ?? ""),
    );
    const headerRow = rows.shift() ?? [""];
    return [{ type: "table", header: headerRow, rows: rows.length > 0 ? rows : [[""]] }];
  }
  if (tag === "DIV" && node.children.length === 0) return textBlocks(node.innerText);
  return Array.from(node.childNodes).flatMap(blocksFromNode);
}

function blocksFromEditor(editor: HTMLElement): ContentBlock[] {
  return Array.from(editor.childNodes).flatMap(blocksFromNode);
}

export function BlockEditor({
  initial,
  label = "Contenido de la lección",
  onChange,
}: {
  initial: ContentBlock[];
  label?: string;
  onChange?: (blocks: ContentBlock[]) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [blocks, setBlocks] = useState<ContentBlock[]>(initial);

  useEffect(() => {
    if (initialized.current || !editorRef.current) return;
    editorRef.current.innerHTML = htmlFromBlocks(initial);
    initialized.current = true;
  }, [initial]);

  useEffect(() => {
    onChange?.(blocks);
  }, [blocks, onChange]);

  const syncBlocks = () => {
    if (editorRef.current) setBlocks(blocksFromEditor(editorRef.current));
  };

  const formatSelection = (format: Format) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    if (format === "table") {
      document.execCommand(
        "insertHTML",
        false,
        "<table><thead><tr><th>Encabezado 1</th><th>Encabezado 2</th></tr></thead><tbody><tr><td>Dato 1</td><td>Dato 2</td></tr></tbody></table><p><br></p>",
      );
    } else if (format === "bullets") {
      document.execCommand("insertUnorderedList");
    } else if (format === "numbers") {
      document.execCommand("insertOrderedList");
    } else {
      const tag = format === "title" ? "H2" : format === "subtitle" ? "H3" : "P";
      document.execCommand("formatBlock", false, tag);
    }
    syncBlocks();
  };

  const pastePlainText = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData
      .getData("text/plain")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("");
    document.execCommand("insertHTML", false, html);
    syncBlocks();
  };

  return (
    <section className="space-y-3">
      <input type="hidden" name="content" value={JSON.stringify(blocks)} />

      <div className="flex flex-wrap items-center gap-2" aria-label="Formato de contenido">
        <span className="mr-1 text-xs text-ink-muted">Formato:</span>
        {TOOLS.map((tool) => (
          <button
            key={tool.format}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => formatSelection(tool.format)}
            className="btn btn-secondary btn-sm"
          >
            {tool.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-muted">
        Pega el texto y selecciona un párrafo o una lista para aplicarle formato. El texto se
        pega sin estilos de Word para conservar el diseño de MLO.
      </p>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder="Pega o escribe aquí el contenido de la lección…"
        onInput={syncBlocks}
        onBlur={syncBlocks}
        onPaste={pastePlainText}
        className="min-h-64 rounded-xl border border-line bg-white p-4 text-sm leading-7 text-ink shadow-[inset_0_1px_2px_#1720330a] outline-none empty:before:pointer-events-none empty:before:text-ink-faint empty:before:content-[attr(data-placeholder)] focus:border-accent focus:ring-2 focus:ring-accent-soft [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:bg-surface-soft [&_th]:p-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
      />

      {blocks.length === 0 && (
        <p className="text-xs text-ink-faint">
          Agrega al menos un párrafo, una lista o una tabla antes de crear la lección.
        </p>
      )}
    </section>
  );
}
