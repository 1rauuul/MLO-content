import { randomInt } from "node:crypto";

import { db } from "./db";
import { hashToken } from "./password";

export const STUDENT_LINK_CODE_TTL_MINUTES = 30;

export function generateStudentLinkCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function isStudentLinkCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export function canIssueStudentLink(input: {
  teacherId: string;
  role: "admin" | "maestro";
  classTeacherId: string;
  isMember: boolean;
}): boolean {
  return (
    input.isMember &&
    (input.role === "admin" || input.teacherId === input.classTeacherId)
  );
}

export async function issueStudentLinkCode(
  studentId: string,
): Promise<{ code: string; expiresAt: Date } | null> {
  const code = generateStudentLinkCode();
  const expiresAt = new Date(
    Date.now() + STUDENT_LINK_CODE_TTL_MINUTES * 60_000,
  );
  return db().begin(async (tx) => {
    // El bloqueo del alumno serializa dos clics simultáneos: el índice único
    // student_link_codes_pending_idx no debe decidir la carrera.
    const [student] = await tx<{ id: string }[]>`
      select id from students where id = ${studentId} for update`;
    if (!student) return null;

    const [account] = await tx<{ student_id: string }[]>`
      select student_id from student_accounts
       where student_id = ${studentId}
       limit 1`;
    if (account) return null;

    await tx`update student_link_codes
      set used_at = now()
      where student_id = ${studentId}
        and used_at is null`;
    await tx`insert into student_link_codes
      (student_id, code_hash, expires_at)
      values (${studentId}, ${hashToken(code)}, ${expiresAt.toISOString()})`;
    return { code, expiresAt };
  });
}
