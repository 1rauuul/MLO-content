"use server";

import { redirect } from "next/navigation";

import { createSession } from "@/lib/auth";
import { acceptTeacherInvitation } from "@/lib/teacher-accounts";

export type AcceptInvitationState = { error?: string };

const ERRORS: Record<string, string> = {
  password: "La contraseña no cumple los requisitos.",
  used: "Esta invitación ya fue usada. Inicia sesión o recupera tu contraseña.",
  revoked: "Este enlace fue reemplazado por uno nuevo. Pide el más reciente.",
  expired: "El enlace venció. Pide al administrador que reenvíe la invitación.",
  invalid: "Esta invitación no es válida.",
  storage: "No se pudo activar la cuenta. Inténtalo de nuevo.",
};

export async function acceptInvitation(
  _prev: AcceptInvitationState,
  formData: FormData,
): Promise<AcceptInvitationState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  const result = await acceptTeacherInvitation(token, password);
  if (!result.ok) {
    return { error: ERRORS[result.error] ?? ERRORS.storage };
  }

  await createSession(result.teacherId);
  redirect("/mis-cursos");
}
