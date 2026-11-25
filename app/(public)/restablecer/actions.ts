"use server";

import { redirect } from "next/navigation";

import { resetTeacherPassword } from "@/lib/teacher-accounts";

export type ResetPasswordState = { error?: string };

const ERRORS: Record<string, string> = {
  password: "La contraseña no cumple los requisitos.",
  used: "Este enlace ya se usó. Solicita uno nuevo.",
  revoked: "Este enlace fue reemplazado. Solicita uno nuevo.",
  expired: "El enlace venció. Solicita uno nuevo.",
  invalid: "Este enlace no es válido. Solicita uno nuevo.",
  storage: "No se pudo restablecer la contraseña. Inténtalo de nuevo.",
};

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  const result = await resetTeacherPassword(token, password);
  if (!result.ok) {
    return { error: ERRORS[result.error] ?? ERRORS.storage };
  }

  redirect("/login?restablecida=1");
}
