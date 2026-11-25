import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { resolveStudentKey } from "@/lib/student-auth";
import {
  getStudentProgress,
  isProgressPayload,
  progressPayloadTooLarge,
  putStudentProgress,
} from "@/lib/student-progress";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store" };

function invalid(message: string, status = 400) {
  return Response.json({ error: "invalid", message }, { status, headers: NO_STORE });
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  const identity = await resolveStudentKey(request);
  if (!identity) {
    return invalid("Falta la identidad estable del alumno.", 401);
  }

  const progress = await getStudentProgress(identity.externalKey);
  if (!progress) {
    return new Response(null, { status: 204, headers: NO_STORE });
  }
  return Response.json(progress, { headers: NO_STORE });
}

export async function PUT(request: Request) {
  const identity = await resolveStudentKey(request);
  if (!identity) {
    return invalid("Falta la identidad estable del alumno.", 401);
  }

  const body = (await request.json().catch(() => null)) as
    | { studentName?: unknown; progress?: unknown }
    | null;
  const studentName =
    identity.student?.displayName ??
    (typeof body?.studentName === "string" ? body.studentName.trim() : "");
  if (studentName.length < 2 || studentName.length > 80) {
    return invalid("El nombre del alumno no es válido.");
  }
  if (!isProgressPayload(body?.progress)) {
    return invalid("El progreso no es válido.");
  }
  if (progressPayloadTooLarge(body.progress)) {
    return invalid("El progreso es demasiado grande.", 413);
  }

  const updatedAt = await putStudentProgress(
    identity.externalKey,
    studentName,
    body.progress,
  );
  return Response.json({ updatedAt }, { headers: NO_STORE });
}
