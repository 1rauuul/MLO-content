export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbers"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] };

export const BLOCK_LABELS = {
  p: "Párrafo",
  h: "Subtítulo",
  bullets: "Viñetas",
  numbers: "Lista numerada",
  table: "Tabla",
} as const;

export type BlockType = keyof typeof BLOCK_LABELS;

export function emptyBlock(type: BlockType): ContentBlock {
  if (type === "table") return { type, header: [""], rows: [[""]] };
  if (type === "bullets" || type === "numbers") return { type, items: [""] };
  return { type, text: "" };
}

/** Valida la forma de los bloques que edita el panel. No es todavía la
 * validación completa del contrato v2 (esa llega al publicar). */
export function parseBlocks(raw: string): { blocks: ContentBlock[] } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: "El contenido no es JSON válido." };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { error: "Agrega al menos un bloque de contenido." };
  }

  const blocks: ContentBlock[] = [];

  for (const [index, item] of data.entries()) {
    const where = `Bloque ${index + 1}`;
    if (typeof item !== "object" || item === null) {
      return { error: `${where}: formato inválido.` };
    }

    const block = item as Record<string, unknown>;

    switch (block.type) {
      case "p":
      case "h": {
        if (typeof block.text !== "string" || !block.text.trim()) {
          return { error: `${where}: escribe el texto.` };
        }
        blocks.push({ type: block.type, text: block.text.trim() });
        break;
      }
      case "bullets":
      case "numbers": {
        if (!Array.isArray(block.items) || block.items.length === 0) {
          return { error: `${where}: agrega al menos un elemento.` };
        }
        const items = block.items.map((value) => (typeof value === "string" ? value.trim() : ""));
        if (items.some((value) => !value)) {
          return { error: `${where}: hay un elemento vacío.` };
        }
        blocks.push({ type: block.type, items });
        break;
      }
      case "table": {
        if (!Array.isArray(block.header) || block.header.length === 0) {
          return { error: `${where}: la tabla necesita encabezados.` };
        }
        const header = block.header.map((value) =>
          typeof value === "string" ? value.trim() : "",
        );
        if (header.some((value) => !value)) {
          return { error: `${where}: hay un encabezado vacío.` };
        }
        if (!Array.isArray(block.rows) || block.rows.length === 0) {
          return { error: `${where}: la tabla necesita al menos una fila.` };
        }
        const rows: string[][] = [];
        for (const row of block.rows) {
          if (!Array.isArray(row) || row.length !== header.length) {
            return { error: `${where}: cada fila debe tener ${header.length} columnas.` };
          }
          const cells = row.map((value) => (typeof value === "string" ? value.trim() : ""));
          if (cells.some((value) => !value)) {
            return { error: `${where}: hay una celda vacía.` };
          }
          rows.push(cells);
        }
        blocks.push({ type: "table", header, rows });
        break;
      }
      default:
        return { error: `${where}: tipo desconocido.` };
    }
  }

  return { blocks };
}
