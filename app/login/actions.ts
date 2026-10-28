"use server";

import { redirect } from "next/navigation";

import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Escribe tu correo y contraseña." };
  }

  const rows = await db()<{ id: string; password_hash: string }[]>`
    select id, password_hash from teachers where email = ${email} limit 1`;

  const teacher = rows[0];
  if (!teacher || !(await verifyPassword(password, teacher.password_hash))) {
    return { error: "Correo o contraseña incorrectos." };
  }

  await createSession(teacher.id);
  redirect("/mis-cursos");
}
