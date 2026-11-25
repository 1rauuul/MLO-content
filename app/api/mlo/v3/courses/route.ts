import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { accessControlEnabled } from "@/lib/content/v3";
import { listAuthorizedCourses } from "@/lib/content/v3-api";
import { resolveStudentKey } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  const identity = await resolveStudentKey(request);
  const studentKey = identity?.externalKey ?? "";

  if (!studentKey) {
    return Response.json(
      { error: "invalid", message: "Falta la identidad estable del alumno." },
      { status: 400, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  const courses = await listAuthorizedCourses(
    studentKey,
    accessControlEnabled(process.env.MLO_ACCESS_CONTROL),
  );

  return Response.json(courses, {
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}
