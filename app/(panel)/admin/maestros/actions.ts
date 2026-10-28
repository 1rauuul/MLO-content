"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export type CreateTeacherState = { error?: string; ok?: boolean };

export async function createTeacher(
  _prev: CreateTeacherState,
  formData: FormData,
): Promise<CreateTeacherState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { error: "Escribe el nombre del maestro." };
  if (!email.includes("@")) return { error: "Escribe un correo válido." };
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  try {
    await db()`insert into teachers (name, email, password_hash, role)
      values (${name}, ${email}, ${await hashPassword(password)}, 'maestro')`;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return { error: "Ya existe un maestro con ese correo." };
    throw error;
  }

  revalidatePath("/admin/maestros");
  return { ok: true };
}
