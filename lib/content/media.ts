export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

export const MAX_MEDIA_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 1600;
export const MAX_ALT_LENGTH = 200;
export const MAX_CAPTION_LENGTH = 300;
export const MAX_VIDEO_TITLE_LENGTH = 120;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function isImageMime(value: unknown): value is ImageMime {
  return typeof value === "string" && (IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

export function mediaSrc(mediaId: string): string {
  return `/api/media/${mediaId}`;
}

export function youtubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
  let candidate: string | null = null;

  if (host === "youtu.be") {
    candidate = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (host === "youtube.com" || host === "music.youtube.com") {
    if (parsed.pathname === "/watch") {
      candidate = parsed.searchParams.get("v");
    } else {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed") {
        candidate = parts[1] ?? null;
      }
    }
  }

  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
