import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import {
  clientIpFromHeaders,
  RATE_LIMITS,
  takeRateLimit,
} from "@/lib/rate-limit";
import { loginStudent } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store" };

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status, headers: NO_STORE });
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: unknown; password?: unknown }
    | null;

  const ip = clientIpFromHeaders(request.headers);
  const allowed =
    (await takeRateLimit(
      "student_login",
      `ip:${ip}`,
      RATE_LIMITS.studentLoginIp,
    )) &&
    (await takeRateLimit(
      "student_login",
      "global",
      RATE_LIMITS.studentLoginGlobal,
    ));
  if (!allowed) {
    return errorResponse(
      "rate_limited",
      "Demasiados intentos. Espera 15 minutos.",
      429,
    );
  }

  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const result = await loginStudent(username, password);

  if (result.ok) {
    return Response.json(
      { token: result.token, student: result.student },
      { headers: NO_STORE },
    );
  }

  if (result.error === "rate_limited") {
    return errorResponse(
      "rate_limited",
      "Demasiados intentos. Espera 15 minutos.",
      429,
    );
  }

  return errorResponse(
    "invalid_credentials",
    "Usuario o contraseña incorrectos.",
    401,
  );
}
