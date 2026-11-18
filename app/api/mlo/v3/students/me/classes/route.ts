import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { isStudentKey } from "@/lib/classes";
import { listStudentClasses } from "@/lib/student-classes";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store" };

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  const studentKey = (request.headers.get("x-mlo-student-key") ?? "").trim();
  if (!isStudentKey(studentKey)) {
    return Response.json(
      { error: "invalid", message: "Falta la identidad estable del alumno." },
      { status: 400, headers: NO_STORE },
    );
  }

  const classes = await listStudentClasses(studentKey);
  return Response.json({ classes }, { headers: NO_STORE });
}
