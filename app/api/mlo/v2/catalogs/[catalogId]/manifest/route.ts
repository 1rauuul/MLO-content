import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { getLatestRelease, manifestFrom } from "@/lib/content/releases";

export const dynamic = "force-dynamic";

const CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await params;
  const manifest = manifestFrom(await getLatestRelease(catalogId), catalogId);

  if (!manifest) {
    return Response.json(
      {
        error: "not_found",
        message: `El curso ${catalogId} no tiene un release publicado.`,
      },
      { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  return Response.json(manifest, {
    headers: { ...CORS_HEADERS, "Cache-Control": CACHE },
  });
}
