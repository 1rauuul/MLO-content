import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { leaveClassByCode, normalizeJoinCode } from "@/lib/classes";
import { resolveStudentKeyValue } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string; studentKey: string }> },
) {
  const { code, studentKey } = await params;

  const identity = await resolveStudentKeyValue(request, studentKey);
  if (!identity) {
    return Response.json(
      { error: "invalid", message: "La identidad del alumno no es válida." },
      { status: 400, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  await leaveClassByCode(normalizeJoinCode(code), identity.externalKey);
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}
