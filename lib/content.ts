import {
  isImageMime,
  MAX_ALT_LENGTH,
  MAX_CAPTION_LENGTH,
  MAX_VIDEO_TITLE_LENGTH,
  mediaSrc,
  youtubeVideoId,
  youtubeWatchUrl,
  type ImageMime,
} from "./content/media";

export type ImageBlock = {
  type: "image";
  mediaId: string;
  src: string;
  mime: ImageMime;
  width: number;
  height: number;
  alt: string;
  caption?: string;
};

export type VideoBlock = {
  type: "video";
  url: string;
  title: string;
};

export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbers"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | ImageBlock
  | VideoBlock;

const MEDIA_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      case "image": {
        if (typeof block.mediaId !== "string" || !MEDIA_ID.test(block.mediaId)) {
          return { error: `${where}: la imagen no tiene un identificador válido.` };
        }
        if (!isImageMime(block.mime)) {
          return { error: `${where}: el formato de imagen no está permitido.` };
        }
        const width = block.width;
        const height = block.height;
        if (
          !Number.isInteger(width) ||
          !Number.isInteger(height) ||
          (width as number) < 1 ||
          (height as number) < 1 ||
          (width as number) > 10000 ||
          (height as number) > 10000
        ) {
          return { error: `${where}: las dimensiones de la imagen no son válidas.` };
        }
        const alt = typeof block.alt === "string" ? block.alt.trim() : "";
        if (!alt || alt.length > MAX_ALT_LENGTH) {
          return { error: `${where}: escribe un texto alternativo de hasta ${MAX_ALT_LENGTH} caracteres.` };
        }
        const caption =
          typeof block.caption === "string" ? block.caption.trim() : "";
        if (caption.length > MAX_CAPTION_LENGTH) {
          return { error: `${where}: el pie de imagen no puede pasar de ${MAX_CAPTION_LENGTH} caracteres.` };
        }
        blocks.push({
          type: "image",
          mediaId: block.mediaId,
          src: mediaSrc(block.mediaId),
          mime: block.mime,
          width: width as number,
          height: height as number,
          alt,
          ...(caption ? { caption } : {}),
        });
        break;
      }
      case "video": {
        const videoId = typeof block.url === "string" ? youtubeVideoId(block.url) : null;
        if (!videoId) {
          return { error: `${where}: usa un enlace de YouTube válido.` };
        }
        const title = typeof block.title === "string" ? block.title.trim() : "";
        if (!title || title.length > MAX_VIDEO_TITLE_LENGTH) {
          return { error: `${where}: escribe un título de hasta ${MAX_VIDEO_TITLE_LENGTH} caracteres.` };
        }
        blocks.push({ type: "video", url: youtubeWatchUrl(videoId), title });
        break;
      }
      default:
        return { error: `${where}: tipo desconocido.` };
    }
  }

  if (!blocks.some((block) => block.type !== "h")) {
    return { error: "Agrega al menos un párrafo, una lista, una tabla, una imagen o un video." };
  }

  return { blocks };
}
