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
      return {
        error:
          result.error === "invalid_email"
            ? "Escribe un correo válido."
            : "No se pudo enviar el correo. Inténtalo más tarde.",
      };
    }
    return { ok: true };
  } catch (error) {
    console.error("[teachers] no se pudo procesar la recuperación", error);
    return {
      error: "No se pudo procesar la solicitud. Inténtalo más tarde.",
    };
  }
}
