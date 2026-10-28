import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import {
  classPreviewPayload,
  getClassPreviewByCode,
  normalizeJoinCode,
} from "@/lib/classes";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const preview = await getClassPreviewByCode(normalizeJoinCode(code));

  if (!preview) {
    return Response.json(
      { error: "not_found", message: "No existe una clase con ese código." },
      { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  return Response.json(classPreviewPayload(preview), {
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}
