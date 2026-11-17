import type { ImageBlock, VideoBlock } from "@/lib/content";
import {
  isImageMime,
  mediaSrc,
  youtubeThumbnail,
  youtubeVideoId,
} from "@/lib/content/media";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const REMOVE_BUTTON =
  '<button type="button" contenteditable="false" data-remove class="self-end text-xs text-ink-muted underline decoration-line-strong underline-offset-2 hover:text-ink">Quitar</button>';

export function htmlFromMediaBlock(block: ImageBlock | VideoBlock): string {
  if (block.type === "image") {
    const caption = block.caption
      ? `<figcaption class="text-xs leading-snug text-ink-muted">${escapeHtml(block.caption)}</figcaption>`
      : "";
    return [
      `<figure contenteditable="false" data-block="image"`,
      ` data-media-id="${escapeAttr(block.mediaId)}"`,
      ` data-mime="${escapeAttr(block.mime)}"`,
      ` data-width="${block.width}" data-height="${block.height}"`,
      ` data-alt="${escapeAttr(block.alt)}"`,
      ` data-caption="${escapeAttr(block.caption ?? "")}"`,
      ` class="my-3 flex flex-col gap-2 rounded-xl border border-line bg-surface-soft p-3">`,
      `<img src="${mediaSrc(block.mediaId)}" alt="${escapeAttr(block.alt)}" class="max-h-80 w-full rounded-lg bg-white object-contain">`,
      caption,
      REMOVE_BUTTON,
      "</figure>",
    ].join("");
  }

  const videoId = youtubeVideoId(block.url);
  const thumb = videoId
    ? `<img src="${youtubeThumbnail(videoId)}" alt="" class="max-h-80 w-full rounded-lg object-cover">`
    : "";
  return [
    `<figure contenteditable="false" data-block="video"`,
    ` data-url="${escapeAttr(block.url)}" data-title="${escapeAttr(block.title)}"`,
    ` class="my-3 flex flex-col gap-2 rounded-xl border border-line bg-surface-soft p-3">`,
    thumb,
    `<figcaption class="text-sm font-medium text-ink">${escapeHtml(block.title)}</figcaption>`,
    REMOVE_BUTTON,
    "</figure>",
  ].join("");
}

export function mediaBlockFromFigure(figure: HTMLElement): ImageBlock | VideoBlock | null {
  if (figure.dataset.block === "image") {
    const { mediaId, mime } = figure.dataset;
    const width = Number(figure.dataset.width);
    const height = Number(figure.dataset.height);
    const alt = figure.dataset.alt?.trim() ?? "";
    if (
      !mediaId ||
      !isImageMime(mime) ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      !alt
    ) {
      return null;
    }
    return {
      type: "image",
      mediaId,
      src: mediaSrc(mediaId),
      mime,
      width,
      height,
      alt,
      ...(figure.dataset.caption?.trim() ? { caption: figure.dataset.caption.trim() } : {}),
    };
  }

  if (figure.dataset.block === "video") {
    const { url, title } = figure.dataset;
    if (!url || !title) return null;
    return { type: "video", url, title };
  }

  return null;
}
