import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { db } from "./db";
import { issueStudentLinkCode, STUDENT_LINK_CODE_TTL_MINUTES } from "./student-link";

const studentIds: string[] = [];

after(async () => {
  for (const id of studentIds) {
    await db()`delete from student_link_codes where student_id = ${id}`;
    await db()`delete from student_accounts where student_id = ${id}`;
    await db()`delete from students where id = ${id}`;
  }
  await db().end({ timeout: 5 });
});

async function createStudent(): Promise<string> {
  const [student] = await db()<{ id: string }[]>`
    insert into students (external_key, name)
    values (${randomUUID()}, ${"Alumno de prueba"}) returning id`;
  studentIds.push(student.id);
  return student.id;
}

test("emite un código de 6 dígitos que vence en 30 minutos", async () => {
  const studentId = await createStudent();
  try {
    const issued = await issueStudentLinkCode(studentId);
    assert.ok(issued);
    assert.match(issued.code, /^\d{6}$/);
    assert.ok(issued.expiresAt.getTime() > Date.now());

    const [pending] = await db()<
      { pendientes: number; minutos: number; vigente: boolean }[]
    >`
      select count(*)::int as pendientes,
             (extract(epoch from max(expires_at - created_at)) / 60)::int as minutos,
             bool_and(expires_at > now()) as vigente
        from student_link_codes
       where student_id = ${studentId} and used_at is null`;
    assert.equal(pending.pendientes, 1);
    assert.ok(Math.abs(pending.minutos - STUDENT_LINK_CODE_TTL_MINUTES) <= 2);
    assert.equal(pending.vigente, true);
  } finally {
    await db()`delete from student_link_codes where student_id = ${studentId}`;
    await db()`delete from students where id = ${studentId}`;
  }
});

test("un segundo código invalida el pendiente anterior", async () => {
  const studentId = await createStudent();
  try {
    const first = await issueStudentLinkCode(studentId);
    const second = await issueStudentLinkCode(studentId);
    assert.ok(first && second);

    const rows = await db()<{ used_at: Date | null }[]>`
      select used_at from student_link_codes
       where student_id = ${studentId}
       order by created_at`;
    assert.equal(rows.length, 2);
    assert.ok(rows[0].used_at);
    assert.equal(rows[1].used_at, null);
  } finally {
    await db()`delete from student_link_codes where student_id = ${studentId}`;
    await db()`delete from students where id = ${studentId}`;
  }
});

test("no emite código si el alumno ya tiene cuenta o no existe", async () => {
  const studentId = await createStudent();
  try {
    await db()`insert into student_accounts (student_id, username, password_hash)
      values (${studentId}, ${`prueba-${randomUUID().slice(0, 8)}`}, ${"scrypt$test$test"})`;

    assert.equal(await issueStudentLinkCode(studentId), null);
    assert.equal(await issueStudentLinkCode(randomUUID()), null);
  } finally {
    await db()`delete from student_link_codes where student_id = ${studentId}`;
    await db()`delete from student_accounts where student_id = ${studentId}`;
    await db()`delete from students where id = ${studentId}`;
  }
});
