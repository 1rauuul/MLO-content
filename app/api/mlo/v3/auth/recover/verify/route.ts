import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { confirmStudentPasswordReset } from "@/lib/student-recovery";

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
    | { email?: unknown; code?: unknown; password?: unknown }
    | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const code = typeof body?.code === "string" ? body.code : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const result = await confirmStudentPasswordReset({ email, code, password });
  if (!result.ok) {
    if (result.error === "password_invalid") {
      return errorResponse(
        "password_invalid",
        "La contraseña debe tener entre 8 y 128 caracteres, con mayúscula, minúscula, número y símbolo.",
        400,
      );
    }
    return errorResponse(
      "invalid_code",
      "El código no es válido o venció. Solicita uno nuevo.",
      400,
    );
  }

  return new Response(null, { status: 204, headers: NO_STORE });
}
