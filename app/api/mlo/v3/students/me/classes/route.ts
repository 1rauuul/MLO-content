import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { listStudentClasses } from "@/lib/student-classes";
import { resolveStudentKey } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store" };

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  const identity = await resolveStudentKey(request);
  if (!identity) {
    return Response.json(
      { error: "invalid", message: "Falta la identidad estable del alumno." },
      { status: 401, headers: NO_STORE },
    );
  }

  const classes = await listStudentClasses(identity.externalKey);
  return Response.json({ classes }, { headers: NO_STORE });
}
