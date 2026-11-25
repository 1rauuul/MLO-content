"use server";

import { redirect } from "next/navigation";

import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import { verifyPassword } from "@/lib/password";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Escribe tu correo y contraseña." };
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { error: "Correo o contraseña incorrectos." };
  }

  const rows = await db()<{
    id: string;
    password_hash: string;
    activated_at: Date | null;
  }[]>`
    select id, password_hash, activated_at
      from teachers
     where email = ${normalizedEmail}
     limit 1`;

  const teacher = rows[0];
  if (
    !teacher?.activated_at ||
    !teacher.password_hash ||
    !(await verifyPassword(password, teacher.password_hash))
  ) {
    return { error: "Correo o contraseña incorrectos." };
  }

  await createSession(teacher.id);
  redirect("/mis-cursos");
}
