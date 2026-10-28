import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { getClassSnapshotByCode, normalizeJoinCode } from "@/lib/classes";

export const dynamic = "force-dynamic";

const CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const snapshot = await getClassSnapshotByCode(normalizeJoinCode(code));

  if (!snapshot) {
    return Response.json(
      {
        error: "not_found",
        message: "La clase todavía no tiene contenido publicado.",
      },
      { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  return Response.json(snapshot, {
    headers: { ...CORS_HEADERS, "Cache-Control": CACHE },
  });
}
