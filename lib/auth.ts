import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { db } from "./db";
import { hashToken, newSessionToken } from "./password";

const COOKIE = "mlo_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export type Teacher = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "maestro";
};

export async function createSession(teacherId: string): Promise<void> {
  const token = newSessionToken();
  const expires = new Date(Date.now() + MAX_AGE * 1000);

  await db()`insert into sessions (token_hash, teacher_id, expires_at)
    values (${hashToken(token)}, ${teacherId}, ${expires.toISOString()})`;

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<Teacher | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db()<Teacher[]>`select t.id, t.name, t.email, t.role
    from sessions s
    join teachers t on t.id = s.teacher_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()
    limit 1`;

  return rows[0] ?? null;
}

export async function requireTeacher(): Promise<Teacher> {
  const teacher = await getSession();
  if (!teacher) redirect("/login");
  return teacher;
}

export async function requireAdmin(): Promise<Teacher> {
  const teacher = await requireTeacher();
  if (teacher.role !== "admin") notFound();
  return teacher;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await db()`delete from sessions where token_hash = ${hashToken(token)}`;
  }
  store.delete(COOKIE);
}
