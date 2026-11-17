"use client";

import { useEffect, useRef, useState } from "react";

import type { ContentBlock } from "@/lib/content";

import { htmlFromMediaBlock, mediaBlockFromFigure } from "./media-blocks";
import { ImagePickerDialog, VideoPickerDialog } from "./media-picker";

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
      if (block.type === "image" || block.type === "video") {
        return htmlFromMediaBlock(block);
      }
      if (block.type === "p") return `<p>${escapeHtml(block.text)}</p>`;
      if (block.type === "h") return `<h2>${escapeHtml(block.text)}</h2>`;
      if (block.type === "bullets") {
        return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
      }
      if (block.type === "numbers") {
        return `<ol>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
      }
      if (block.type !== "table") return "";
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
  if (tag === "FIGURE") {
    const block = mediaBlockFromFigure(node as HTMLElement);
    return block ? [block] : [];
  }
  if (tag === "P") {
    if (node.querySelector("[data-block]")) {
      return Array.from(node.childNodes).flatMap(blocksFromNode);
    }
    return textBlocks(node.innerText);
  }
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
  allowMedia = false,
  onChange,
}: {
  initial: ContentBlock[];
  label?: string;
  allowMedia?: boolean;
  onChange?: (blocks: ContentBlock[]) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const selection = useRef<Range | null>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>(initial);
  const [picker, setPicker] = useState<"image" | "video" | null>(null);

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

  const saveSelection = () => {
    const current = window.getSelection();
    const editor = editorRef.current;
    if (!current || current.rangeCount === 0 || !editor) {
      selection.current = null;
      return;
    }
    const range = current.getRangeAt(0);
    selection.current = editor.contains(range.commonAncestorContainer)
      ? range.cloneRange()
      : null;
  };

  const insertMedia = (block: ContentBlock) => {
    if (block.type !== "image" && block.type !== "video") return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const current = window.getSelection();
    const range = selection.current;
    const html = `${htmlFromMediaBlock(block)}<p><br></p>`;

    // Insertar dentro de una lista, tabla o párrafo rompe el parseo: el bloque
    // debe quedar como hijo directo del editor.
    const anchor = range?.commonAncestorContainer ?? current?.anchorNode ?? null;
    const element =
      anchor instanceof HTMLElement ? anchor : anchor?.parentElement ?? null;
    const host =
      element?.closest("li, td, th")?.closest("ul, ol, table") ??
      element?.closest("p, h1, h2, h3, h4, h5, h6, blockquote, figure") ??
      null;

    if (host && editor.contains(host)) {
      host.insertAdjacentHTML("afterend", html);
      const inserted = host.nextElementSibling;
      const after = inserted?.nextElementSibling ?? inserted;
      if (current && after) {
        const next = document.createRange();
        next.setStartAfter(after);
        next.collapse(true);
        current.removeAllRanges();
        current.addRange(next);
      }
      selection.current = null;
      setPicker(null);
      syncBlocks();
      return;
    }

    if (current) {
      current.removeAllRanges();
      if (range && editor.contains(range.commonAncestorContainer)) {
        current.addRange(range);
      } else {
        const end = document.createRange();
        end.selectNodeContents(editor);
        end.collapse(false);
        current.addRange(end);
      }
    }
    document.execCommand("insertHTML", false, html);
    selection.current = null;
    setPicker(null);
    syncBlocks();
  };

  const removeMedia = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.closest("[data-remove]")) return;
    event.preventDefault();
    target.closest("figure")?.remove();
    syncBlocks();
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
        {allowMedia && (
          <>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                saveSelection();
                setPicker("image");
              }}
              className="btn btn-secondary btn-sm"
            >
              Imagen
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                saveSelection();
                setPicker("video");
              }}
              className="btn btn-secondary btn-sm"
            >
              Video
            </button>
          </>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        Pega el texto y selecciona un párrafo o una lista para aplicarle formato. El texto se
        pega sin estilos de Word para conservar el diseño de MLO.
      </p>

      {allowMedia && (
        <p className="text-xs text-ink-muted">
          Las imágenes se guardan con la lección y se ven sin conexión. Los videos se
          reproducen en MLO y requieren conexión.
        </p>
      )}

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
        onClick={removeMedia}
        className="min-h-64 rounded-xl border border-line bg-white p-4 text-sm leading-7 text-ink shadow-[inset_0_1px_2px_#1720330a] outline-none empty:before:pointer-events-none empty:before:text-ink-faint empty:before:content-[attr(data-placeholder)] focus:border-accent focus:ring-2 focus:ring-accent-soft [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:bg-surface-soft [&_th]:p-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
      />

      {blocks.length === 0 && (
        <p className="text-xs text-ink-faint">
          Agrega al menos un párrafo, una lista, una tabla, una imagen o un video antes de
          crear la lección.
        </p>
      )}

      {allowMedia && picker === "image" && (
        <ImagePickerDialog onClose={() => setPicker(null)} onInsert={insertMedia} />
      )}
      {allowMedia && picker === "video" && (
        <VideoPickerDialog onClose={() => setPicker(null)} onInsert={insertMedia} />
      )}
    </section>
  );
}
