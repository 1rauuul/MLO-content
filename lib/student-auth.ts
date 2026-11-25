import { randomUUID } from "node:crypto";

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
  /** Obligatorio en cuentas nuevas; opcional al vincular por externalKey. */
  email?: string;
  externalKey?: string;
};

export type StudentRegistrationFieldError =
  | "username_invalid"
  | "password_invalid"
  | "display_name_invalid"
  | "email_invalid"
  | "external_key_invalid";

export type RegisterStudentResult =
  | { ok: true; token: string; student: StudentIdentity }
  | {
      ok: false;
      error:
        | "username_taken"
        | "email_taken"
        | "already_registered"
        | StudentRegistrationFieldError;
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

  const email = input.email?.trim() ?? "";
  const isLegacyLink = input.externalKey !== undefined;
  if ((!isLegacyLink || email.length > 0) && !normalizeEmail(email)) {
    return "email_invalid";
  }

  if (input.externalKey !== undefined && !isExternalKey(input.externalKey)) {
    return "external_key_invalid";
  }
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
  email: string | null,
  externalKey: string,
): Promise<"username_taken" | "email_taken" | "already_registered"> {
  const [row] = await db()<{ reason: string }[]>`
    select case
      when exists (select 1 from student_accounts where username = ${username})
        then 'username_taken'
      when ${email !== null} and exists (
        select 1 from student_accounts where email = ${email}
      ) then 'email_taken'
      when exists (
        select 1
          from student_accounts a
          join students s on s.id = a.student_id
         where s.external_key = ${externalKey}
      ) then 'already_registered'
      else 'username_taken'
    end as reason`;
  if (row?.reason === "email_taken") return "email_taken";
  if (row?.reason === "already_registered") return "already_registered";
  return "username_taken";
}

export async function registerStudent(
  input: StudentRegistrationInput,
): Promise<RegisterStudentResult> {
  const error = validateStudentRegistration(input);
  if (error) return { ok: false, error };

  const username = normalizeStudentUsername(input.username);
  const displayName = input.displayName.trim();
  const email = normalizeEmail(input.email ?? "");
  const externalKey = input.externalKey?.trim() || randomUUID();
  const passwordHash = await hashPassword(input.password);

  try {
    const student = await db().begin(async (tx) => {
      const [row] = await tx<{ id: string; external_key: string; name: string }[]>`
        insert into students (external_key, name)
        values (${externalKey}, ${displayName})
        on conflict (external_key) do update
          set name = excluded.name, updated_at = now()
        returning id, external_key, name`;

      const [account] = await tx<{ student_id: string }[]>`
        select student_id from student_accounts
         where student_id = ${row.id}
         limit 1`;
      if (account) return null;

      await tx`insert into student_accounts
        (student_id, username, email, password_hash)
        values (${row.id}, ${username}, ${email}, ${passwordHash})`;
      return row;
    });

    if (!student) return { ok: false, error: "already_registered" };

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
        error: await registrationConflict(username, email, externalKey),
      };
    }
    throw caught;
  }
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
    // La tabla no necesita historia larga; se limpia en cada fallo.
    await sql`delete from student_auth_attempts
      where username = ${username}
        and created_at < now() - interval '1 day'`;
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

/**
 * Identidad para progreso y clases. Con Bearer manda la sesión; sin él se
 * acepta `X-MLO-Student-Key` durante la transición.
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
  return { externalKey, student: null };
}

export async function logoutStudent(request: Request): Promise<void> {
  const token = bearerToken(request);
  if (!token) return;
  await db()`delete from student_sessions where token_hash = ${hashToken(token)}`;
}
