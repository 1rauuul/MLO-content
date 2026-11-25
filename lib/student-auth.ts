import { randomUUID, timingSafeEqual } from "node:crypto";

import { isUniqueViolation } from "./content/x03";
import { db } from "./db";
import { normalizeEmail } from "./email";
import {
  hashPassword,
  hashToken,
  newSessionToken,
  verifyPassword,
} from "./password";
import { PASSWORD_MAX_LENGTH, validatePassword } from "./password-policy";
import { isStudentRecoveryCode } from "./student-recovery";

export const STUDENT_SESSION_DAYS = 30;
export const MAX_LOGIN_ATTEMPTS = 10;
export const LOGIN_WINDOW_MINUTES = 15;

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
const EXTERNAL_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Hash scrypt válido de una contraseña desconocida, para no filtrar tiempos. */
const DUMMY_PASSWORD_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

export type StudentIdentity = {
  studentId: string;
  externalKey: string;
  username: string;
  displayName: string;
  email: string | null;
};

export type StudentRegistrationInput = {
  username: string;
  password: string;
  displayName: string;
  email: string;
};

export type StudentRegistrationFieldError =
  | "username_invalid"
  | "password_invalid"
  | "display_name_invalid"
  | "email_invalid";

export type RegisterStudentResult =
  | { ok: true; token: string; student: StudentIdentity }
  | {
      ok: false;
      error: "username_taken" | "email_taken" | StudentRegistrationFieldError;
    };

export type StudentLinkInput = {
  externalKey: string;
  username: string;
  password: string;
  displayName: string;
  code: string;
};

export type LinkStudentResult =
  | { ok: true; token: string; student: StudentIdentity }
  | {
      ok: false;
      error:
        | "invalid"
        | "invalid_code"
        | "password_invalid"
        | "username_taken"
        | "already_registered";
    };

export type UpdateStudentEmailResult =
  | { ok: true; email: string }
  | { ok: false; error: "invalid_email" | "invalid_credentials" | "email_taken" };

export type LoginStudentResult =
  | { ok: true; token: string; student: StudentIdentity }
  | { ok: false; error: "invalid_credentials" | "rate_limited" };

export type StudentKeyResolution = {
  externalKey: string;
  student: StudentIdentity | null;
};

type StudentRow = {
  student_id: string;
  external_key: string;
  name: string;
  username: string;
  email?: string | null;
  password_hash?: string;
};

export function normalizeStudentUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isExternalKey(value: string): boolean {
  return EXTERNAL_KEY_PATTERN.test(value);
}

export function isValidStudentUsername(value: string): boolean {
  return USERNAME_PATTERN.test(normalizeStudentUsername(value));
}

export function isValidStudentPassword(value: string): boolean {
  return validatePassword(value).valid;
}

/** El login no aplica la política nueva: las cuentas viejas deben poder entrar. */
export function isAcceptedStudentLoginPassword(value: string): boolean {
  return value.length > 0 && value.length <= PASSWORD_MAX_LENGTH;
}

export function isValidStudentName(value: string): boolean {
  const name = value.trim();
  return name.length >= 2 && name.length <= 80;
}

export function validateStudentRegistration(
  input: StudentRegistrationInput,
): StudentRegistrationFieldError | null {
  if (!isValidStudentUsername(input.username)) return "username_invalid";
  if (!isValidStudentPassword(input.password)) return "password_invalid";
  if (!isValidStudentName(input.displayName)) return "display_name_invalid";
  if (!normalizeEmail(input.email)) return "email_invalid";
  return null;
}

function mapStudent(row: StudentRow): StudentIdentity {
  return {
    studentId: row.student_id,
    externalKey: row.external_key,
    username: row.username,
    displayName: row.name,
    email: row.email ?? null,
  };
}

async function createStudentSession(studentId: string): Promise<string> {
  const token = newSessionToken();
  const expires = new Date(
    Date.now() + STUDENT_SESSION_DAYS * 24 * 60 * 60 * 1000,
  );
  await db()`insert into student_sessions (token_hash, student_id, expires_at)
    values (${hashToken(token)}, ${studentId}, ${expires.toISOString()})`;
  return token;
}

async function registrationConflict(
  username: string,
  email: string,
): Promise<"username_taken" | "email_taken"> {
  const [row] = await db()<{ reason: string }[]>`
    select case
      when exists (select 1 from student_accounts where username = ${username})
        then 'username_taken'
      when exists (select 1 from student_accounts where email = ${email})
        then 'email_taken'
      else 'username_taken'
    end as reason`;
  return row?.reason === "email_taken" ? "email_taken" : "username_taken";
}

export async function registerStudent(
  input: StudentRegistrationInput,
): Promise<RegisterStudentResult> {
  const error = validateStudentRegistration(input);
  if (error) return { ok: false, error };

  const username = normalizeStudentUsername(input.username);
  const displayName = input.displayName.trim();
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "email_invalid" };
  const externalKey = randomUUID();
  const passwordHash = await hashPassword(input.password);

  try {
    const student = await db().begin(async (tx) => {
      const [row] = await tx<{ id: string; external_key: string; name: string }[]>`
        insert into students (external_key, name)
        values (${externalKey}, ${displayName})
        returning id, external_key, name`;

      await tx`insert into student_accounts
        (student_id, username, email, password_hash)
        values (${row.id}, ${username}, ${email}, ${passwordHash})`;
      return row;
    });

    const token = await createStudentSession(student.id);
    return {
      ok: true,
      token,
      student: {
        studentId: student.id,
        externalKey: student.external_key,
        username,
        displayName: student.name,
        email,
      },
    };
  } catch (caught) {
    if (isUniqueViolation(caught)) {
      return {
        ok: false,
        error: await registrationConflict(username, email),
      };
    }
    throw caught;
  }
}

function sameLinkCode(code: string, stored: string): boolean {
  const actual = Buffer.from(hashToken(code), "hex");
  const expected = Buffer.from(stored, "hex");
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

/**
 * Vincula una cuenta local antigua a un externalKey existente. Solo se acepta
 * con un código de un solo uso emitido por el administrador: el UUID no es
 * secreto y por sí solo no prueba nada.
 */
export async function linkStudentAccount(
  input: StudentLinkInput,
): Promise<LinkStudentResult> {
  const externalKey = input.externalKey.trim();
  const code = input.code.trim();
  if (
    !isExternalKey(externalKey) ||
    !isValidStudentUsername(input.username) ||
    !isValidStudentName(input.displayName) ||
    !isStudentRecoveryCode(code)
  ) {
    return { ok: false, error: "invalid" };
  }
  if (!isValidStudentPassword(input.password)) {
    return { ok: false, error: "password_invalid" };
  }

  const username = normalizeStudentUsername(input.username);
  const displayName = input.displayName.trim();

  const [student] = await db()<{
    id: string;
    external_key: string;
    name: string;
  }[]>`
    select id, external_key, name
      from students
     where external_key = ${externalKey}
     limit 1`;
  if (!student) return { ok: false, error: "invalid_code" };

  const [existing] = await db()<{ student_id: string }[]>`
    select student_id from student_accounts
     where student_id = ${student.id}
     limit 1`;
  if (existing) return { ok: false, error: "already_registered" };

  const [link] = await db()<{
    id: string;
    code_hash: string;
    attempts: number;
  }[]>`
    select id, code_hash, attempts
      from student_link_codes
     where student_id = ${student.id}
       and used_at is null
       and expires_at > now()
     order by created_at desc
     limit 1`;
  if (!link) return { ok: false, error: "invalid_code" };

  if (link.attempts >= 5) {
    await db()`update student_link_codes
      set used_at = now()
      where id = ${link.id}`;
    return { ok: false, error: "invalid_code" };
  }

  if (!sameLinkCode(code, link.code_hash)) {
    const attempts = link.attempts + 1;
    await db()`update student_link_codes
      set attempts = ${attempts},
          used_at = case when ${attempts} >= 5 then now() else used_at end
      where id = ${link.id}`;
    return { ok: false, error: "invalid_code" };
  }

  const passwordHash = await hashPassword(input.password);
  try {
    await db().begin(async (tx) => {
      const [account] = await tx<{ student_id: string }[]>`
        insert into student_accounts
          (student_id, username, email, password_hash)
        values (${student.id}, ${username}, null, ${passwordHash})
        on conflict (student_id) do nothing
        returning student_id`;
      if (!account) throw new Error("already_registered");

      await tx`update students
        set name = ${displayName}, updated_at = now()
        where id = ${student.id}`;
      await tx`update student_link_codes
        set used_at = now()
        where student_id = ${student.id}
          and used_at is null`;
    });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "already_registered") {
      return { ok: false, error: "already_registered" };
    }
    if (isUniqueViolation(caught)) {
      return { ok: false, error: "username_taken" };
    }
    throw caught;
  }

  const token = await createStudentSession(student.id);
  return {
    ok: true,
    token,
    student: {
      studentId: student.id,
      externalKey: student.external_key,
      username,
      displayName,
      email: null,
    },
  };
}

export async function loginStudent(
  rawUsername: string,
  password: string,
): Promise<LoginStudentResult> {
  const username = normalizeStudentUsername(rawUsername);
  if (
    !isValidStudentUsername(username) ||
    !isAcceptedStudentLoginPassword(password)
  ) {
    return { ok: false, error: "invalid_credentials" };
  }

  const sql = db();
  const [attempt] = await sql<{ count: number }[]>`
    select count(*)::int as count
      from student_auth_attempts
     where username = ${username}
       and created_at > now() - interval '15 minutes'`;
  if ((attempt?.count ?? 0) >= MAX_LOGIN_ATTEMPTS) {
    return { ok: false, error: "rate_limited" };
  }

  const [account] = await sql<StudentRow[]>`
    select a.student_id, s.external_key, s.name, a.username, a.email, a.password_hash
      from student_accounts a
      join students s on s.id = a.student_id
     where a.username = ${username}
     limit 1`;

  const valid = account
    ? await verifyPassword(password, account.password_hash ?? "")
    : await verifyPassword(password, DUMMY_PASSWORD_HASH);

  if (!account || !valid) {
    await sql`insert into student_auth_attempts (username) values (${username})`;
    // Limpieza global: rotar usuarios no debe hacer crecer la tabla sin límite.
    await sql`delete from student_auth_attempts
      where created_at < now() - interval '1 day'`;
    return { ok: false, error: "invalid_credentials" };
  }

  await sql`delete from student_auth_attempts where username = ${username}`;
  const token = await createStudentSession(account.student_id);
  return { ok: true, token, student: mapStudent(account) };
}

export function bearerToken(request: Request): string | null {
  const header = (request.headers.get("authorization") ?? "").trim();
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

export async function requireStudent(
  request: Request,
): Promise<StudentIdentity | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const [row] = await db()<StudentRow[]>`
    select s.id as student_id, s.external_key, s.name, a.username, a.email
      from student_sessions ss
      join students s on s.id = ss.student_id
      join student_accounts a on a.student_id = s.id
     where ss.token_hash = ${hashToken(token)}
       and ss.expires_at > now()
     limit 1`;

  return row ? mapStudent(row) : null;
}

export async function updateStudentEmail(input: {
  studentId: string;
  email: string;
  password: string;
}): Promise<UpdateStudentEmailResult> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "invalid_email" };
  if (!input.password) return { ok: false, error: "invalid_credentials" };

  const [account] = await db()<{ password_hash: string }[]>`
    select password_hash
      from student_accounts
     where student_id = ${input.studentId}
     limit 1`;
  if (
    !account ||
    !(await verifyPassword(input.password, account.password_hash))
  ) {
    return { ok: false, error: "invalid_credentials" };
  }

  try {
    await db().begin(async (tx) => {
      await tx`update student_accounts
        set email = ${email}, updated_at = now()
        where student_id = ${input.studentId}`;
      await tx`update student_password_resets
        set used_at = now()
        where student_id = ${input.studentId}
          and used_at is null`;
    });
    return { ok: true, email };
  } catch (caught) {
    if (isUniqueViolation(caught)) return { ok: false, error: "email_taken" };
    throw caught;
  }
}

async function studentAccountExists(externalKey: string): Promise<boolean> {
  const [row] = await db()<{ student_id: string }[]>`
    select a.student_id
      from student_accounts a
      join students s on s.id = a.student_id
     where s.external_key = ${externalKey}
     limit 1`;
  return Boolean(row);
}

/**
 * Identidad para progreso y clases. Con Bearer manda la sesión; la cabecera
 * legacy solo sigue valiendo mientras el alumno no tenga cuenta en la nube.
 */
export async function resolveStudentKey(
  request: Request,
): Promise<StudentKeyResolution | null> {
  if (bearerToken(request)) {
    const student = await requireStudent(request);
    return student ? { externalKey: student.externalKey, student } : null;
  }

  const externalKey = (request.headers.get("x-mlo-student-key") ?? "").trim();
  if (!isExternalKey(externalKey)) return null;
  if (await studentAccountExists(externalKey)) return null;
  return { externalKey, student: null };
}

/**
 * Igual que `resolveStudentKey`, pero para rutas que reciben la llave en el
 * cuerpo o en la URL. Si hay Bearer, debe corresponder al mismo externalKey.
 */
export async function resolveStudentKeyValue(
  request: Request,
  externalKey: string,
): Promise<StudentKeyResolution | null> {
  const key = externalKey.trim();
  if (!isExternalKey(key)) return null;

  if (bearerToken(request)) {
    const student = await requireStudent(request);
    return student && student.externalKey === key
      ? { externalKey: key, student }
      : null;
  }
  if (await studentAccountExists(key)) return null;
  return { externalKey: key, student: null };
}

export async function logoutStudent(request: Request): Promise<void> {
  const token = bearerToken(request);
  if (!token) return;
  await db()`delete from student_sessions where token_hash = ${hashToken(token)}`;
}
