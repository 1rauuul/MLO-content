import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { requestStudentPasswordReset } from "@/lib/student-recovery";

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
    | { email?: unknown }
    | null;
  const email = typeof body?.email === "string" ? body.email : "";

  const result = await requestStudentPasswordReset(email);
  if (!result.ok) {
    if (result.error === "invalid_email") {
      return errorResponse("invalid_email", "Escribe un correo válido.", 400);
    }
    return errorResponse(
      "email_unavailable",
      "No se pudo enviar el correo. Inténtalo más tarde.",
      503,
    );
  }

  return Response.json({ ok: true }, { status: 202, headers: NO_STORE });
}
