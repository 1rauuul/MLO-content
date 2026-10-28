import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import {
  isStudentKey,
  leaveClassByCode,
  normalizeJoinCode,
} from "@/lib/classes";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string; studentKey: string }> },
) {
  const { code, studentKey } = await params;

  if (!isStudentKey(studentKey)) {
    return Response.json(
      { error: "invalid", message: "La identidad del alumno no es válida." },
      { status: 400, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  await leaveClassByCode(normalizeJoinCode(code), studentKey);
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}
