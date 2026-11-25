"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import { verifyPassword } from "@/lib/password";
import {
  clientIpFromHeaders,
  RATE_LIMITS,
  takeRateLimit,
} from "@/lib/rate-limit";

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

  const ip = clientIpFromHeaders(await headers());
  const allowed =
    (await takeRateLimit(
      "teacher_login",
      `ip:${ip}`,
      RATE_LIMITS.teacherLoginIp,
    )) &&
    (await takeRateLimit(
      "teacher_login",
      `email:${normalizedEmail}`,
      RATE_LIMITS.teacherLoginEmail,
    )) &&
    (await takeRateLimit(
      "teacher_login",
      "global",
      RATE_LIMITS.teacherLoginGlobal,
    ));
  if (!allowed) {
    return {
      error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.",
    };
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
