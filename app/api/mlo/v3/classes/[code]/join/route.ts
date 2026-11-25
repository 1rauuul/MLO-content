import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import {
  classPreviewPayload,
  joinClassByCode,
  normalizeJoinCode,
} from "@/lib/classes";
import {
  clientIpFromHeaders,
  RATE_LIMITS,
  takeRateLimit,
} from "@/lib/rate-limit";
import { resolveStudentKeyValue } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store" };

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const ip = clientIpFromHeaders(request.headers);
  const allowed =
    (await takeRateLimit("class_join", `ip:${ip}`, RATE_LIMITS.classJoinIp)) &&
    (await takeRateLimit("class_join", "global", RATE_LIMITS.classJoinGlobal));
  if (!allowed) {
    return Response.json(
      { error: "rate_limited", message: "Demasiados intentos. Espera 15 minutos." },
      { status: 429, headers: NO_STORE },
    );
  }

  const { code } = await params;
  const body = (await request.json().catch(() => null)) as
    | { studentKey?: unknown; studentName?: unknown }
    | null;

  const studentKey = typeof body?.studentKey === "string" ? body.studentKey.trim() : "";
  const studentName = typeof body?.studentName === "string" ? body.studentName.trim() : "";

  const identity = await resolveStudentKeyValue(request, studentKey);
  if (!identity) {
    return Response.json(
      { error: "invalid", message: "Falta la identidad estable del alumno." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (studentName.length < 2 || studentName.length > 80) {
    return Response.json(
      { error: "invalid", message: "El nombre del alumno no es válido." },
      { status: 400, headers: NO_STORE },
    );
  }

  const result = await joinClassByCode(
    normalizeJoinCode(code),
    identity.externalKey,
    studentName,
  );

  if (!result.ok && result.reason === "unpublished") {
    return Response.json(
      {
        error: "unpublished",
        message:
          "El grupo todavía no está publicado. Pídele a tu docente que lo publique.",
      },
      { status: 409, headers: NO_STORE },
    );
  }

  if (!result.ok || !result.preview) {
    return Response.json(
      { error: "not_found", message: "No existe una clase con ese código." },
      { status: 404, headers: NO_STORE },
    );
  }

  return Response.json(
    { ...classPreviewPayload(result.preview), joined: true },
    { headers: NO_STORE },
  );
}
