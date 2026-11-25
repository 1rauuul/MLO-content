import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { accessControlEnabled } from "@/lib/content/v3";
import { getAuthorizedManifest } from "@/lib/content/v3-api";
import { resolveStudentKey } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const identity = await resolveStudentKey(request);
  const studentKey = identity?.externalKey ?? "";

  if (!studentKey) {
    return Response.json(
      { error: "invalid", message: "Falta la identidad estable del alumno." },
      { status: 400, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  const { catalogId } = await params;
  const release = await getAuthorizedManifest(
    catalogId,
    studentKey,
    accessControlEnabled(process.env.MLO_ACCESS_CONTROL),
  );

  if (!release) {
    return Response.json(
      { error: "not_found", message: "Curso no disponible." },
      { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  return Response.json(release, {
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}
