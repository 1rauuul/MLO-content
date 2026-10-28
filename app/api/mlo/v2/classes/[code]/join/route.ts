import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import {
  classPreviewPayload,
  isStudentKey,
  joinClassByCode,
  normalizeJoinCode,
} from "@/lib/classes";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = (await request.json().catch(() => null)) as
    | { studentKey?: unknown; studentName?: unknown }
    | null;

  const studentKey = typeof body?.studentKey === "string" ? body.studentKey.trim() : "";
  const studentName = typeof body?.studentName === "string" ? body.studentName.trim() : "";

  if (!isStudentKey(studentKey)) {
    return Response.json(
      { error: "invalid", message: "Falta la identidad estable del alumno." },
      { status: 400, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }
  if (studentName.length < 2 || studentName.length > 80) {
    return Response.json(
      { error: "invalid", message: "El nombre del alumno no es válido." },
      { status: 400, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  const preview = await joinClassByCode(
    normalizeJoinCode(code),
    studentKey,
    studentName,
  );
  if (!preview) {
    return Response.json(
      { error: "not_found", message: "No existe una clase con ese código." },
      { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { ...classPreviewPayload(preview), joined: true },
    { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  );
}
