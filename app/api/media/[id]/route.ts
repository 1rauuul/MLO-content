import { CORS_HEADERS } from "@/lib/api/cors";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyMediaSignature } from "@/lib/media/signing";

export const dynamic = "force-dynamic";

const MEDIA_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  return new Response("No encontrado.", {
    status: 404,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!MEDIA_ID.test(id)) return notFound();

  const signature = new URL(request.url).searchParams.get("sig") ?? "";
  let signed = false;
  if (signature) {
    try {
      signed = verifyMediaSignature(id, signature);
    } catch {
      signed = false;
    }
  }
  if (!signed && !(await getSession())) return notFound();

  const [row] = await db()<{ mime: string; bytes: Uint8Array; sha256: string }[]>`
    select mime, bytes, sha256 from media where id = ${id} limit 1`;
  if (!row) return notFound();

  const etag = `"${row.sha256}"`;
  const ifNoneMatch = request.headers.get("if-none-match") ?? "";
  if (
    ifNoneMatch
      .split(",")
      .map((tag) => tag.trim())
      .some((tag) => tag === etag || tag === `W/${etag}`)
  ) {
    return new Response(null, {
      status: 304,
      headers: { ...CORS_HEADERS, ETag: etag },
    });
  }

  return new Response(Buffer.from(row.bytes), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": row.mime,
      "Content-Length": String(row.bytes.byteLength),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      ETag: etag,
      "Cache-Control": signed
        ? "public, max-age=31536000, immutable"
        : "private, max-age=0, must-revalidate",
    },
  });
}
