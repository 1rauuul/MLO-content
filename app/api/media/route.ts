import { createHash } from "node:crypto";

import { getSession } from "@/lib/auth";
import { MAX_MEDIA_BYTES, mediaSrc, type ImageMime } from "@/lib/content/media";
import { db } from "@/lib/db";
import { mediaMime } from "@/lib/media/image";

export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function dimension(value: FormDataEntryValue | null): number | null {
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 10000 ? parsed : null;
}

export async function POST(request: Request) {
  const teacher = await getSession();
  if (!teacher) return fail("No autenticado.", 401);

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      return fail("Origen no permitido.", 403);
    }
    if (originHost !== host) return fail("Origen no permitido.", 403);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return fail("Falta la imagen.", 400);
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return fail("La imagen no puede pasar de 3 MB.", 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = mediaMime(bytes);
  if (!mime) return fail("Solo se aceptan JPEG, PNG o WebP.", 415);

  const width = dimension(form.get("width"));
  const height = dimension(form.get("height"));
  if (!width || !height) return fail("Faltan las dimensiones de la imagen.", 400);

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const sql = db();

  const existing = await sql<
    { id: string; mime: ImageMime; width: number; height: number }[]
  >`select id, mime, width, height from media where sha256 = ${sha256} limit 1`;
  if (existing[0]) {
    return Response.json({
      id: existing[0].id,
      src: mediaSrc(existing[0].id),
      mime: existing[0].mime,
      width: existing[0].width,
      height: existing[0].height,
    });
  }

  try {
    const rows = await sql<{ id: string }[]>`
      insert into media (mime, bytes, byte_size, sha256, width, height, created_by)
      values (${mime}, ${Buffer.from(bytes)}, ${bytes.byteLength}, ${sha256},
              ${width}, ${height}, ${teacher.id})
      returning id`;
    return Response.json({
      id: rows[0].id,
      src: mediaSrc(rows[0].id),
      mime,
      width,
      height,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      const [row] = await sql<
        { id: string; mime: ImageMime; width: number; height: number }[]
      >`select id, mime, width, height from media where sha256 = ${sha256} limit 1`;
      if (row) {
        return Response.json({
          id: row.id,
          src: mediaSrc(row.id),
          mime: row.mime,
          width: row.width,
          height: row.height,
        });
      }
    }
    throw error;
  }
}
