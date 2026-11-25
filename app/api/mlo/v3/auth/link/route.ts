import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import {
  clientIpFromHeaders,
  RATE_LIMITS,
  takeRateLimit,
} from "@/lib/rate-limit";
import { linkStudentAccount } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store" };

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status, headers: NO_STORE });
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const allowed =
    (await takeRateLimit(
      "student_link",
      `ip:${ip}`,
      RATE_LIMITS.studentLinkIp,
    )) &&
    (await takeRateLimit(
      "student_link",
      "global",
      RATE_LIMITS.studentLinkGlobal,
    ));
  if (!allowed) {
    return errorResponse(
      "rate_limited",
      "Demasiados intentos. Espera 15 minutos.",
      429,
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        externalKey?: unknown;
        username?: unknown;
        password?: unknown;
        displayName?: unknown;
        code?: unknown;
      }
    | null;

  const result = await linkStudentAccount({
    externalKey:
      typeof body?.externalKey === "string" ? body.externalKey : "",
    username: typeof body?.username === "string" ? body.username : "",
    password: typeof body?.password === "string" ? body.password : "",
    displayName:
      typeof body?.displayName === "string" ? body.displayName : "",
    code: typeof body?.code === "string" ? body.code : "",
  });

  if (result.ok) {
    return Response.json(
      { token: result.token, student: result.student },
      { status: 201, headers: NO_STORE },
    );
  }

  if (result.error === "already_registered") {
    return errorResponse(
      "already_registered",
      "Esa cuenta ya está en la nube. Inicia sesión con tu contraseña.",
      409,
    );
  }
  if (result.error === "username_taken") {
    return errorResponse("username_taken", "Ese usuario ya existe.", 409);
  }
  if (result.error === "password_invalid") {
    return errorResponse(
      "password_invalid",
      "La contraseña debe tener entre 8 y 128 caracteres, con mayúscula, minúscula, número y símbolo.",
      400,
    );
  }
  if (result.error === "invalid_code") {
    return errorResponse(
      "invalid_code",
      "El código no es válido o venció. Pide uno nuevo a tu docente.",
      400,
    );
  }
  return errorResponse("invalid", "Revisa los datos e inténtalo de nuevo.", 400);
}
