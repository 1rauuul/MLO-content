import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { registerStudent } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store" };

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status, headers: NO_STORE });
}

const FIELD_MESSAGES: Record<string, string> = {
  username_invalid:
    "El usuario debe tener entre 3 y 32 caracteres: letras minúsculas, números, punto, guion o guion bajo.",
  password_invalid:
    "La contraseña debe tener entre 8 y 128 caracteres, con mayúscula, minúscula, número y símbolo.",
  display_name_invalid: "El nombre debe tener entre 2 y 80 caracteres.",
  email_invalid: "El correo no es válido.",
  external_key_invalid: "La identidad del alumno no es un UUID válido.",
};

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        username?: unknown;
        password?: unknown;
        displayName?: unknown;
        email?: unknown;
        externalKey?: unknown;
      }
    | null;

  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName =
    typeof body?.displayName === "string" ? body.displayName : "";
  const email = typeof body?.email === "string" ? body.email : "";
  const rawExternalKey =
    typeof body?.externalKey === "string" ? body.externalKey.trim() : "";

  const result = await registerStudent({
    username,
    password,
    displayName,
    email: email || undefined,
    externalKey: rawExternalKey || undefined,
  });

  if (result.ok) {
    return Response.json(
      { token: result.token, student: result.student },
      { status: 201, headers: NO_STORE },
    );
  }

  if (result.error === "username_taken") {
    return errorResponse("username_taken", "Ese usuario ya existe.", 409);
  }
  if (result.error === "email_taken") {
    return errorResponse("email_taken", "Ese correo ya está registrado.", 409);
  }
  if (result.error === "already_registered") {
    return errorResponse(
      "already_registered",
      "Ese alumno ya tiene una cuenta.",
      409,
    );
  }
  if (result.error === "email_invalid") {
    return errorResponse("email_invalid", FIELD_MESSAGES.email_invalid, 400);
  }

  return errorResponse(
    "invalid",
    FIELD_MESSAGES[result.error] ?? "Datos inválidos.",
    400,
  );
}
