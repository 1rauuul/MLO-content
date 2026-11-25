import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";

import { db } from "./db";
import type { EmailDelivery, EmailMessage } from "./email";
import { hashPassword, hashToken, newSessionToken } from "./password";
import {
  confirmStudentPasswordReset,
  requestStudentPasswordReset,
} from "./student-recovery";
import {
  requestTeacherPasswordReset,
  resetTeacherPassword,
} from "./teacher-accounts";
import type { TeacherPasswordResetEmail } from "./teacher-emails";

// Correo de prueba: credenciales ficticias para que emailConfigured() responda
// true, y remitentes inyectados para no tocar nunca la API real de Resend.
const savedEnv = {
  apiKey: process.env.EMAIL_PROVIDER_API_KEY,
  from: process.env.EMAIL_FROM,
  baseUrl: process.env.APP_BASE_URL,
};
process.env.EMAIL_PROVIDER_API_KEY = "re_test";
process.env.EMAIL_FROM = "MLO <no-reply@test.dev>";
process.env.APP_BASE_URL = "http://cms.test";

const studentIds: string[] = [];
const teacherIds: string[] = [];

// Abre el pool de conexiones antes de las pruebas para que las solicitudes
// concurrentes no paguen la latencia de crear una conexión TLS nueva (que
// empujaría la segunda solicitud fuera de la ventana "en curso").
before(async () => {
  await Promise.all(Array.from({ length: 5 }, () => db()`select 1 as x`));
});

after(async () => {
  for (const id of studentIds) {
    await db()`delete from student_password_resets where student_id = ${id}`;
    await db()`delete from student_accounts where student_id = ${id}`;
    await db()`delete from students where id = ${id}`;
  }
  for (const id of teacherIds) {
    await db()`delete from teacher_tokens where teacher_id = ${id}`;
    await db()`delete from teachers where id = ${id}`;
  }
  if (savedEnv.apiKey === undefined) delete process.env.EMAIL_PROVIDER_API_KEY;
  else process.env.EMAIL_PROVIDER_API_KEY = savedEnv.apiKey;
  if (savedEnv.from === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = savedEnv.from;
  if (savedEnv.baseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = savedEnv.baseUrl;
  await db().end({ timeout: 5 });
});

async function createStudentAccount(): Promise<{
  studentId: string;
  email: string;
}> {
  const email = `alumno-${randomUUID()}@test.dev`;
  const username = `prueba-${randomUUID().slice(0, 12)}`;
  const [student] = await db()<{ id: string }[]>`
    insert into students (external_key, name)
    values (${randomUUID()}, 'Alumno de prueba') returning id`;
  studentIds.push(student.id);
  await db()`insert into student_accounts (student_id, username, email, password_hash)
    values (${student.id}, ${username}, ${email}, ${await hashPassword("Secreto1!")})`;
  return { studentId: student.id, email };
}

async function createTeacher(): Promise<{
  teacherId: string;
  email: string;
}> {
  const email = `maestro-${randomUUID()}@test.dev`;
  const name = `Maestro ${randomUUID().slice(0, 8)}`;
  const [teacher] = await db()<{ id: string }[]>`
    insert into teachers (name, email, password_hash, role, activated_at)
    values (${name}, ${email}, ${await hashPassword("Secreto1!")}, 'maestro', now())
    returning id`;
  teacherIds.push(teacher.id);
  return { teacherId: teacher.id, email };
}

function silenceConsoleError<T>(run: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => undefined;
  return run().finally(() => {
    console.error = original;
  });
}

test("fallo de envío del alumno borra el código nuevo y conserva el anterior", async () => {
  const { studentId, email } = await createStudentAccount();
  await db()`insert into student_password_resets
    (student_id, code_hash, expires_at, sent_at)
    values
    (${studentId}, ${hashToken("111111")}, now() + interval '15 minutes', now())`;

  const result = await silenceConsoleError(() =>
    requestStudentPasswordReset(email, {
      sendEmail: async (): Promise<EmailDelivery> => ({
        sent: false,
        reason: "network",
      }),
    }),
  );

  assert.deepEqual(result, { ok: false, error: "email_unavailable" });

  const rows = await db()<{ sent_at: Date | null; used_at: Date | null }[]>`
    select sent_at, used_at
      from student_password_resets
     where student_id = ${studentId}`;
  assert.equal(rows.length, 1, "solo debe quedar el código anterior");
  assert.ok(rows[0].sent_at);
  assert.equal(rows[0].used_at, null);
});

test("dos solicitudes concurrentes de alumno envían un solo correo", async () => {
  const { studentId, email } = await createStudentAccount();
  const sent: EmailMessage[] = [];
  const sender = async (message: EmailMessage): Promise<EmailDelivery> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    sent.push(message);
    return { sent: true, id: "email_test" };
  };

  const results = await Promise.all([
    requestStudentPasswordReset(email, { sendEmail: sender }),
    requestStudentPasswordReset(email, { sendEmail: sender }),
  ]);

  assert.deepEqual(results, [{ ok: true }, { ok: true }]);
  assert.equal(sent.length, 1, "debe enviarse un único correo");

  const rows = await db()<{ sent_at: Date | null }[]>`
    select sent_at
      from student_password_resets
     where student_id = ${studentId}
       and sent_at is not null`;
  assert.equal(rows.length, 1, "debe quedar un único código enviado");

  const match = sent[0].text.match(
    /código para restablecer la contraseña de MLO es: (\d{6})/,
  );
  assert.ok(match, "el correo debe contener el código");
  const code = match[1];

  const confirm = await confirmStudentPasswordReset({
    email,
    code,
    password: "NuevaClave1!",
  });
  assert.deepEqual(confirm, { ok: true });
});

test("fallo y éxito del maestro: sin token nuevo al fallar, éxito tras enviar", async () => {
  const { teacherId, email } = await createTeacher();

  // Token anterior enviado y fuera del cooldown de 60 s para que la solicitud
  // de éxito no devuelva antes por cooldown.
  await db()`insert into teacher_tokens
    (teacher_id, purpose, token_hash, expires_at, sent_at, created_at)
    values
    (${teacherId}, 'reset', ${hashToken(newSessionToken())},
     now() + interval '60 minutes', now(), now() - interval '5 minutes')`;

  const failResult = await silenceConsoleError(() =>
    requestTeacherPasswordReset(email, {
      sendReset: async (): Promise<EmailDelivery> => ({
        sent: false,
        reason: "network",
      }),
    }),
  );
  assert.deepEqual(failResult, { ok: false, error: "email_unavailable" });

  const afterFail = await db()<{
    id: string;
    revoked_at: Date | null;
    sent_at: Date | null;
  }[]>`
    select id, revoked_at, sent_at
      from teacher_tokens
     where teacher_id = ${teacherId}
       and purpose = 'reset'`;
  assert.equal(afterFail.length, 1, "al fallar no debe quedar token nuevo");
  assert.equal(afterFail[0].revoked_at, null, "el anterior sigue vigente");
  assert.ok(afterFail[0].sent_at);

  let capturedLink = "";
  const successResult = await requestTeacherPasswordReset(email, {
    sendReset: async (
      message: TeacherPasswordResetEmail,
    ): Promise<EmailDelivery> => {
      capturedLink = message.link;
      return { sent: true, id: "email_test" };
    },
  });
  assert.deepEqual(successResult, { ok: true });

  const match = capturedLink.match(/\/restablecer\?token=([A-Za-z0-9_-]{43})/);
  assert.ok(match, "el enlace debe incluir el token");
  const token = match[1];

  const reset = await resetTeacherPassword(token, "NuevaClave1!");
  assert.equal(reset.ok, true);
});
