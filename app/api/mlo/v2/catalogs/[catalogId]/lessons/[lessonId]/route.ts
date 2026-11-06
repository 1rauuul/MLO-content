import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { getLatestRelease, lessonFrom, manifestFrom } from "@/lib/content/releases";
import { hasV2CatalogAccess } from "@/lib/content/v3-api";

export const dynamic = "force-dynamic";

const CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const RESTRICTED_CACHE = "private, max-age=0, no-store";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ catalogId: string; lessonId: string }> },
) {
  const { catalogId, lessonId } = await params;
  const studentKey = request.headers.get("x-mlo-student-key")?.trim() ?? null;

  if (!(await hasV2CatalogAccess(catalogId, studentKey))) {
    return Response.json(
      {
        error: "not_found",
        message: `El curso ${catalogId} no tiene un release publicado.`,
      },
      { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  const release = await getLatestRelease(catalogId);

  if (!manifestFrom(release, catalogId)) {
    return Response.json(
      {
        error: "not_found",
        message: `El curso ${catalogId} no tiene un release publicado.`,
      },
      { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  const lesson = lessonFrom(release, catalogId, lessonId);
  if (!lesson) {
    return Response.json(
      {
        error: "not_found",
        message: `La lección ${lessonId} no existe en el release actual.`,
      },
      { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  return Response.json(lesson, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": catalogId === "base" ? CACHE : RESTRICTED_CACHE,
    },
  });
}
