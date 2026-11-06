import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { isStudentKey } from "@/lib/classes";
import {
  INVITATION_ERROR_STATUS,
  invitationErrorBody,
} from "@/lib/invitations/api";
import {
  claimInvitation,
  describeClaimedMembership,
} from "@/lib/invitations/invitations";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store" };

function invalid(message: string) {
  return Response.json(
    { error: "invalid", message },
    { status: 400, headers: NO_STORE },
  );
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const studentKey = (request.headers.get("x-mlo-student-key") ?? "").trim();
  if (!isStudentKey(studentKey)) {
    return invalid("Falta la identidad estable del alumno.");
  }

  const body = (await request.json().catch(() => null)) as
    | { token?: unknown; studentName?: unknown }
    | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) return invalid("Falta el token de la invitación.");

  const rawName =
    typeof body?.studentName === "string" ? body.studentName.trim() : "";
  if (rawName && (rawName.length < 2 || rawName.length > 80)) {
    return invalid("El nombre del alumno no es válido.");
  }

  const result = await claimInvitation(token, {
    studentKey,
    studentName: rawName || "Alumno",
  });

  if (!result.ok) {
    return Response.json(invitationErrorBody(result.error), {
      status: INVITATION_ERROR_STATUS[result.error],
      headers: NO_STORE,
    });
  }

  const membership = await describeClaimedMembership(result.membership);
  if (!membership) {
    return Response.json(invitationErrorBody("invalid"), {
      status: 400,
      headers: NO_STORE,
    });
  }

  const { published, ...data } = membership;
  return Response.json(
    { ok: true, membership: data, published },
    { headers: NO_STORE },
  );
}
