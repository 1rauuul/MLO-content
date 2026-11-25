import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { requireStudent, updateStudentEmail } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store" };

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status, headers: NO_STORE });
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function PUT(request: Request) {
  const student = await requireStudent(request);
  if (!student) {
    return errorResponse(
      "unauthorized",
      "Inicia sesión para actualizar tu correo.",
      401,
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const result = await updateStudentEmail({
    studentId: student.studentId,
    email,
    password,
  });
  if (!result.ok) {
    if (result.error === "email_taken") {
      return errorResponse("email_taken", "Ese correo ya está registrado.", 409);
    }
    if (result.error === "invalid_email") {
      return errorResponse("email_invalid", "El correo no es válido.", 400);
    }
    return errorResponse(
      "invalid_credentials",
      "La contraseña actual no es correcta.",
      400,
    );
  }

  return new Response(null, { status: 204, headers: NO_STORE });
}
