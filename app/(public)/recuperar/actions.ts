"use server";

import { requestTeacherPasswordReset } from "@/lib/teacher-accounts";

export type RequestResetState = { error?: string; ok?: boolean };

export async function requestReset(
  _prev: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "");

  try {
    const result = await requestTeacherPasswordReset(email);
    if (!result.ok) {
      return { error: "Escribe un correo válido." };
    }
    return { ok: true };
  } catch (error) {
    // La respuesta debe ser genérica aunque falle el envío o la base.
    console.error("[teachers] no se pudo procesar la recuperación", error);
    return { ok: true };
  }
}
