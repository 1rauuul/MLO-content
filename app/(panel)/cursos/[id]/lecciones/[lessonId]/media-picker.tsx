/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";

import type { ImageBlock, VideoBlock } from "@/lib/content";
import {
  isImageMime,
  MAX_ALT_LENGTH,
  MAX_CAPTION_LENGTH,
  MAX_IMAGE_DIMENSION,
  MAX_MEDIA_BYTES,
  MAX_VIDEO_TITLE_LENGTH,
  mediaSrc,
  youtubeThumbnail,
  youtubeVideoId,
  youtubeWatchUrl,
  type ImageMime,
} from "@/lib/content/media";

type CompressedImage = {
  blob: Blob;
  width: number;
  height: number;
  mime: ImageMime;
};

async function blobFromCanvas(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File): Promise<CompressedImage> {
  if (!isImageMime(file.type)) {
    throw new Error("Solo se aceptan JPEG, PNG o WebP.");
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo procesar la imagen.");
    context.drawImage(bitmap, 0, 0, width, height);

    let blob = await blobFromCanvas(canvas, "image/webp", 0.82);
    if (!blob || !isImageMime(blob.type)) {
      blob = await blobFromCanvas(canvas, "image/jpeg", 0.85);
    }
    if (!blob || !isImageMime(blob.type)) {
      throw new Error("No se pudo comprimir la imagen.");
    }
    if (blob.size > MAX_MEDIA_BYTES) {
      throw new Error("La imagen comprimida no puede pasar de 3 MB.");
    }
    return { blob, width, height, mime: blob.type };
  } finally {
    bitmap.close();
  }
}

function Overlay({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full max-w-lg space-y-4 p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ImagePickerDialog({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (block: ImageBlock) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const chooseFile = (next: File | null) => {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  };

  async function submit() {
    if (!file) {
      setError("Elige una imagen.");
      return;
    }
    if (!alt.trim()) {
      setError("Escribe el texto alternativo.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const body = new FormData();
      body.append("file", compressed.blob, "imagen");
      body.append("width", String(compressed.width));
      body.append("height", String(compressed.height));
      const response = await fetch("/api/media", { method: "POST", body });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo subir la imagen.");
      }
      const data = (await response.json()) as {
        id: string;
        mime: string;
        width: number;
        height: number;
      };
      if (!isImageMime(data.mime)) throw new Error("Formato de imagen no permitido.");
      onInsert({
        type: "image",
        mediaId: data.id,
        src: mediaSrc(data.id),
        mime: data.mime,
        width: data.width,
        height: data.height,
        alt: alt.trim(),
        ...(caption.trim() ? { caption: caption.trim() } : {}),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo subir la imagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay title="Insertar imagen" onClose={onClose}>
      <div
        className="space-y-3"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (
            event.key === "Enter" &&
            (event.target as HTMLElement).tagName !== "BUTTON"
          ) {
            event.preventDefault();
            void submit();
          }
        }}
      >
        <label className="field-label">
          Imagen (JPEG, PNG o WebP, máx. 3 MB)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            className="field"
          />
        </label>

        {preview && (
          <img
            src={preview}
            alt=""
            className="max-h-56 w-full rounded-lg border border-line bg-white object-contain"
          />
        )}

        <label className="field-label">
          Texto alternativo
          <input
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            maxLength={MAX_ALT_LENGTH}
            required
            placeholder="Describe la imagen"
            className="field"
          />
        </label>

        <label className="field-label">
          Pie de imagen (opcional)
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={MAX_CAPTION_LENGTH}
            className="field"
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="button" onClick={submit} disabled={busy} className="btn btn-primary">
          {busy ? "Subiendo…" : "Insertar imagen"}
        </button>
      </div>
    </Overlay>
  );
}

export function VideoPickerDialog({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (block: VideoBlock) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const videoId = youtubeVideoId(url);

  function submit() {
    if (!videoId) {
      setError("Usa un enlace de YouTube válido.");
      return;
    }
    if (!title.trim()) {
      setError("Escribe el título del video.");
      return;
    }
    onInsert({ type: "video", url: youtubeWatchUrl(videoId), title: title.trim() });
  }

  return (
    <Overlay title="Insertar video de YouTube" onClose={onClose}>
      <div
        className="space-y-3"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (
            event.key === "Enter" &&
            (event.target as HTMLElement).tagName !== "BUTTON"
          ) {
            event.preventDefault();
            submit();
          }
        }}
      >
        <label className="field-label">
          Enlace de YouTube
          <input
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError(null);
            }}
            required
            placeholder="https://www.youtube.com/watch?v=…"
            className="field"
          />
        </label>

        {videoId && (
          <img
            src={youtubeThumbnail(videoId)}
            alt=""
            className="max-h-56 w-full rounded-lg border border-line object-cover"
          />
        )}

        <label className="field-label">
          Título
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={MAX_VIDEO_TITLE_LENGTH}
            required
            placeholder="Cómo se verá en la lección"
            className="field"
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="button" onClick={submit} className="btn btn-primary">
          Insertar video
        </button>
      </div>
    </Overlay>
  );
}
