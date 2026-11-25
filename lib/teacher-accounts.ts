import type postgres from "postgres";

import { isUniqueViolation } from "./content/x03";
import { db } from "./db";
import {
  emailConfigured,
  normalizeEmail,
  type EmailDelivery,
} from "./email";
import { appBaseUrl } from "./media/signing";
import { hashPassword, hashToken, newSessionToken } from "./password";
import { validatePassword } from "./password-policy";
import {
  sendTeacherInvitationEmail,
  sendTeacherPasswordResetEmail,
} from "./teacher-emails";

export const TEACHER_INVITE_DAYS = 7;
export const TEACHER_RESET_MINUTES = 60;
export const TEACHER_RESEND_COOLDOWN_SECONDS = 60;

const TEACHER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
type Sql = postgres.TransactionSql;

export type TeacherTokenPurpose = "invite" | "reset";
export type TeacherTokenStatus = "pending" | "used" | "revoked" | "expired";

export type TeacherTokenPreview = {
  tokenId: string;
  teacherId: string;
  name: string;
  email: string;
  activatedAt: Date | null;
  expiresAt: Date;
  status: TeacherTokenStatus;
};

export type TeacherInvitationResult =
  | {
      ok: true;
      teacherId: string;
      email: string;
      name: string;
      link: string;
      delivery: EmailDelivery;
    }
  | {
      ok: false;
      error:
        | "invalid_name"
        | "invalid_email"
        | "email_taken"
        | "not_found"
        | "already_active"
        | "cooldown"
        | "config";
    };

export type TeacherTokenResult =
  | { ok: true; teacherId: string }
  | {
      ok: false;
      error: "invalid" | "used" | "revoked" | "expired" | "password" | "storage";
    };

export function isTeacherToken(value: string): boolean {
  return TEACHER_TOKEN_PATTERN.test(value);
}

export function teacherTokenStatus(
  state: { used_at: Date | null; revoked_at: Date | null; expires_at: Date },
  now: Date = new Date(),
): TeacherTokenStatus {
  if (state.used_at) return "used";
  if (state.revoked_at) return "revoked";
  if (state.expires_at.getTime() <= now.getTime()) return "expired";
  return "pending";
}

export function teacherInviteExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + TEACHER_INVITE_DAYS * 24 * 60 * 60 * 1000);
}

export function teacherResetExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + TEACHER_RESET_MINUTES * 60 * 1000);
}

export function teacherCooldownActive(
  lastCreatedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!lastCreatedAt) return false;
  return (
    now.getTime() - lastCreatedAt.getTime() <
    TEACHER_RESEND_COOLDOWN_SECONDS * 1000
  );
}

export function buildTeacherInviteLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/invitacion?token=${encodeURIComponent(token)}`;
}

export function buildTeacherResetLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/restablecer?token=${encodeURIComponent(token)}`;
}

function baseUrl(): string | null {
  try {
    return appBaseUrl();
  } catch {
    return null;
  }
}

async function createTeacherToken(
  tx: Sql,
  input: {
    teacherId: string;
    purpose: TeacherTokenPurpose;
    expiresAt: Date;
    createdBy?: string | null;
  },
): Promise<{ id: string; token: string; expiresAt: Date }> {
  await tx`update teacher_tokens
    set revoked_at = now()
    where teacher_id = ${input.teacherId}
      and purpose = ${input.purpose}
      and used_at is null
      and revoked_at is null`;

  const token = newSessionToken();
  const [row] = await tx<{ id: string; expires_at: Date }[]>`
    insert into teacher_tokens
      (teacher_id, purpose, token_hash, expires_at, created_by)
    values
      (${input.teacherId}, ${input.purpose}, ${hashToken(token)},
       ${input.expiresAt.toISOString()}, ${input.createdBy ?? null})
    returning id, expires_at`;

  return { id: row.id, token, expiresAt: row.expires_at };
}

async function recordDelivery(
  tokenId: string,
  delivery: EmailDelivery,
): Promise<void> {
  if (delivery.sent) {
    await db()`update teacher_tokens
      set sent_at = now(), delivery_error = null
      where id = ${tokenId}`;
    return;
  }
  await db()`update teacher_tokens
    set delivery_error = ${delivery.reason}
    where id = ${tokenId}`;
}

async function sendInvitation(
  token: { id: string; token: string; expiresAt: Date },
  teacher: { name: string; email: string },
  link: string,
  invitedBy?: string | null,
  sendInvite: typeof sendTeacherInvitationEmail = sendTeacherInvitationEmail,
): Promise<EmailDelivery> {
  const delivery = await sendInvite({
    to: teacher.email,
    name: teacher.name,
    link,
    expiresAt: token.expiresAt,
    invitedBy: invitedBy ?? undefined,
  });
  await recordDelivery(token.id, delivery).catch(() => undefined);
  return delivery;
}

async function inviterName(teacherId: string): Promise<string | null> {
  const [row] = await db()<{ name: string }[]>`
    select name from teachers where id = ${teacherId} limit 1`;
  return row?.name ?? null;
}

export async function createPendingTeacher(input: {
  name: string;
  email: string;
  invitedBy: string;
}): Promise<TeacherInvitationResult> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "invalid_name" };
  }
  if (!email) return { ok: false, error: "invalid_email" };

  const base = baseUrl();
  if (!base) return { ok: false, error: "config" };

  const [existing] = await db()<{ id: string }[]>`
    select id from teachers where email = ${email} limit 1`;
  if (existing) return { ok: false, error: "email_taken" };

  try {
    const created = await db().begin(async (tx) => {
      const [teacher] = await tx<{ id: string }[]>`
        insert into teachers (name, email, password_hash, role, activated_at)
        values (${name}, ${email}, '', 'maestro', null)
        returning id`;
      const token = await createTeacherToken(tx, {
        teacherId: teacher.id,
        purpose: "invite",
        expiresAt: teacherInviteExpiresAt(),
        createdBy: input.invitedBy,
      });
      return { teacher, token };
    });

    const link = buildTeacherInviteLink(base, created.token.token);
    const delivery = await sendInvitation(
      created.token,
      { name, email },
      link,
      await inviterName(input.invitedBy),
    );

    return {
      ok: true,
      teacherId: created.teacher.id,
      email,
      name,
      link,
      delivery,
    };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "email_taken" };
    throw error;
  }
}

export async function resendTeacherInvitation(
  teacherId: string,
  invitedBy: string,
  deps: { sendInvite?: typeof sendTeacherInvitationEmail } = {},
): Promise<TeacherInvitationResult> {
  const sendInvite = deps.sendInvite ?? sendTeacherInvitationEmail;
  const base = baseUrl();
  if (!base) return { ok: false, error: "config" };

  // Un único bloqueo del maestro serializa el reenvío: dos pulsaciones
  // concurrentes no pueden insertar dos tokens sin enviar ni enviar dos correos.
  type ResendOutcome =
    | { error: "not_found" | "already_active" | "cooldown" }
    | {
        teacher: {
          id: string;
          name: string;
          email: string;
          activated_at: Date | null;
        };
        token: { id: string; token: string; expiresAt: Date };
      };

  const outcome = await db().begin<ResendOutcome>(async (tx) => {
    const [teacher] = await tx<{
      id: string;
      name: string;
      email: string;
      activated_at: Date | null;
    }[]>`
      select id, name, email, activated_at
        from teachers
       where id = ${teacherId}
       for update
       limit 1`;
    if (!teacher) return { error: "not_found" as const };
    if (teacher.activated_at) return { error: "already_active" as const };

    const [recent] = await tx<{ created_at: Date }[]>`
      select created_at
        from teacher_tokens
       where teacher_id = ${teacher.id}
         and purpose = 'invite'
       order by created_at desc
       limit 1`;
    if (teacherCooldownActive(recent?.created_at ?? null)) {
      return { error: "cooldown" as const };
    }

    const token = await createTeacherToken(tx, {
      teacherId: teacher.id,
      purpose: "invite",
      expiresAt: teacherInviteExpiresAt(),
      createdBy: invitedBy,
    });
    return { teacher, token };
  });

  if ("error" in outcome) return { ok: false, error: outcome.error };

  const link = buildTeacherInviteLink(base, outcome.token.token);
  const delivery = await sendInvitation(
    outcome.token,
    { name: outcome.teacher.name, email: outcome.teacher.email },
    link,
    await inviterName(invitedBy),
    sendInvite,
  );

  return {
    ok: true,
    teacherId: outcome.teacher.id,
    email: outcome.teacher.email,
    name: outcome.teacher.name,
    link,
    delivery,
  };
}

export async function getTeacherTokenPreview(
  token: string,
  purpose: TeacherTokenPurpose,
): Promise<TeacherTokenPreview | null> {
  if (!isTeacherToken(token)) return null;

  const [row] = await db()<{
    token_id: string;
    teacher_id: string;
    name: string;
    email: string;
    activated_at: Date | null;
    expires_at: Date;
    used_at: Date | null;
    revoked_at: Date | null;
  }[]>`
    select tt.id as token_id, tt.teacher_id, t.name, t.email, t.activated_at,
           tt.expires_at, tt.used_at, tt.revoked_at
      from teacher_tokens tt
      join teachers t on t.id = tt.teacher_id
     where tt.token_hash = ${hashToken(token)}
       and tt.purpose = ${purpose}
       and (tt.sent_at is not null or tt.purpose <> 'reset')
     limit 1`;
  if (!row) return null;

  return {
    tokenId: row.token_id,
    teacherId: row.teacher_id,
    name: row.name,
    email: row.email,
    activatedAt: row.activated_at,
    expiresAt: row.expires_at,
    status: teacherTokenStatus(row),
  };
}

export async function acceptTeacherInvitation(
  token: string,
  password: string,
): Promise<TeacherTokenResult> {
  if (!isTeacherToken(token)) return { ok: false, error: "invalid" };
  if (!validatePassword(password).valid) return { ok: false, error: "password" };

  const [row] = await db()<{
    token_id: string;
    teacher_id: string;
    activated_at: Date | null;
    expires_at: Date;
    used_at: Date | null;
    revoked_at: Date | null;
  }[]>`
    select tt.id as token_id, tt.teacher_id, t.activated_at,
           tt.expires_at, tt.used_at, tt.revoked_at
      from teacher_tokens tt
      join teachers t on t.id = tt.teacher_id
     where tt.token_hash = ${hashToken(token)}
       and tt.purpose = 'invite'
     limit 1`;
  if (!row) return { ok: false, error: "invalid" };

  const status = teacherTokenStatus(row);
  if (status !== "pending") return { ok: false, error: status };
  if (row.activated_at) return { ok: false, error: "used" };

  const passwordHash = await hashPassword(password);
  try {
    const teacherId = await db().begin(async (tx) => {
      const [teacher] = await tx<{ id: string }[]>`
        update teachers
           set password_hash = ${passwordHash}, activated_at = now()
         where id = ${row.teacher_id}
           and activated_at is null
         returning id`;
      if (!teacher) return null;

      const [consumed] = await tx<{ id: string }[]>`
        update teacher_tokens
           set used_at = now()
         where id = ${row.token_id}
           and used_at is null
           and revoked_at is null
         returning id`;
      if (!consumed) throw new Error("token already used");

      await tx`update teacher_tokens
        set revoked_at = now()
        where teacher_id = ${row.teacher_id}
          and purpose = 'invite'
          and used_at is null
          and revoked_at is null`;
      return teacher.id;
    });

    if (!teacherId) return { ok: false, error: "used" };
    return { ok: true, teacherId };
  } catch {
    return { ok: false, error: "storage" };
  }
}

export async function requestTeacherPasswordReset(
  rawEmail: string,
  deps: {
    sendReset?: typeof sendTeacherPasswordResetEmail;
    sendInvite?: typeof sendTeacherInvitationEmail;
    finalize?: () => Promise<void>;
  } = {},
): Promise<
  { ok: true } | { ok: false; error: "invalid_email" | "email_unavailable" }
> {
  const sendReset = deps.sendReset ?? sendTeacherPasswordResetEmail;
  const sendInvite = deps.sendInvite ?? sendTeacherInvitationEmail;
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: "invalid_email" };
  // Se comprueba antes de buscar la cuenta para no filtrar su existencia.
  if (!emailConfigured()) return { ok: false, error: "email_unavailable" };
  const base = baseUrl();
  if (!base) return { ok: false, error: "email_unavailable" };

  const [teacher] = await db()<{
    id: string;
    name: string;
    email: string;
    activated_at: Date | null;
  }[]>`
    select id, name, email, activated_at
      from teachers
     where email = ${email}
     limit 1`;
  if (!teacher) return { ok: true };

  const purpose: TeacherTokenPurpose = teacher.activated_at ? "reset" : "invite";

  const token = newSessionToken();
  const expiresAt =
    purpose === "reset" ? teacherResetExpiresAt() : teacherInviteExpiresAt();
  const link =
    purpose === "reset"
      ? buildTeacherResetLink(base, token)
      : buildTeacherInviteLink(base, token);

  // Guarda el token sin enviar antes de mandar el correo. El bloqueo del
  // maestro serializa las solicitudes concurrentes: si ya hay un token vivo
  // sin enviar o el cooldown sigue activo, se devuelve ok sin enviar otro.
  const newId = await db().begin(async (tx) => {
    const [locked] = await tx<{ id: string }[]>`
      select id from teachers where id = ${teacher.id} for update`;
    if (!locked) return null;

    const [pending] = await tx<{ id: string }[]>`
      select id
        from teacher_tokens
       where teacher_id = ${teacher.id}
         and purpose = ${purpose}
         and used_at is null
         and revoked_at is null
         and sent_at is null
         and created_at > now() - interval '1 minute'
       limit 1`;
    if (pending) return null;

    const [recent] = await tx<{ created_at: Date }[]>`
      select created_at
        from teacher_tokens
       where teacher_id = ${teacher.id}
         and purpose = ${purpose}
       order by created_at desc
       limit 1`;
    if (teacherCooldownActive(recent?.created_at ?? null)) return null;

    const [row] = await tx<{ id: string }[]>`
      insert into teacher_tokens
        (teacher_id, purpose, token_hash, expires_at, sent_at)
      values
        (${teacher.id}, ${purpose}, ${hashToken(token)},
         ${expiresAt.toISOString()}, null)
      returning id`;
    return row.id;
  });

  if (newId === null) return { ok: true };

  const delivery =
    purpose === "reset"
      ? await sendReset({
          to: teacher.email,
          name: teacher.name,
          link,
          expiresAt,
        })
      : await sendInvite({
          to: teacher.email,
          name: teacher.name,
          link,
          expiresAt,
        });
  if (!delivery.sent) {
    console.error(
      "[teachers] password recovery email not delivered:",
      delivery.reason,
    );
    await db()`delete from teacher_tokens where id = ${newId}`;
    return { ok: true };
  }

  const finalize =
    deps.finalize ??
    (async () => {
      await db().begin(async (tx) => {
        // Revoca primero los tokens anteriores del mismo propósito: el índice
        // parcial único solo cubre filas con sent_at no nulo.
        await tx`update teacher_tokens
          set revoked_at = now()
          where teacher_id = ${teacher.id}
            and purpose = ${purpose}
            and used_at is null
            and revoked_at is null
            and id <> ${newId}`;
        await tx`update teacher_tokens
          set sent_at = now()
          where id = ${newId}`;
      });
    });

  try {
    await finalize();
  } catch (error) {
    console.error("[teachers] recovery finalization failed; retrying:", error);
    try {
      await finalize();
    } catch (retryError) {
      console.error(
        "[teachers] recovery finalization failed after retry:",
        retryError,
      );
      await db()`delete from teacher_tokens where id = ${newId}`.catch(
        () => undefined,
      );
    }
  }
  return { ok: true };
}

export async function resetTeacherPassword(
  token: string,
  password: string,
): Promise<TeacherTokenResult> {
  if (!isTeacherToken(token)) return { ok: false, error: "invalid" };
  if (!validatePassword(password).valid) return { ok: false, error: "password" };

  const [row] = await db()<{
    token_id: string;
    teacher_id: string;
    expires_at: Date;
    used_at: Date | null;
    revoked_at: Date | null;
  }[]>`
    select tt.id as token_id, tt.teacher_id, tt.expires_at,
           tt.used_at, tt.revoked_at
      from teacher_tokens tt
     where tt.token_hash = ${hashToken(token)}
       and tt.purpose = 'reset'
       and tt.sent_at is not null
     limit 1`;
  if (!row) return { ok: false, error: "invalid" };

  const status = teacherTokenStatus(row);
  if (status !== "pending") return { ok: false, error: status };

  const passwordHash = await hashPassword(password);
  try {
    const teacherId = await db().begin(async (tx) => {
      const [consumed] = await tx<{ id: string }[]>`
        update teacher_tokens
           set used_at = now()
         where id = ${row.token_id}
           and used_at is null
           and revoked_at is null
         returning id`;
      if (!consumed) throw new Error("token already used");

      const [teacher] = await tx<{ id: string }[]>`
        update teachers
           set password_hash = ${passwordHash},
               activated_at = coalesce(activated_at, now())
         where id = ${row.teacher_id}
         returning id`;
      if (!teacher) throw new Error("teacher missing");

      await tx`delete from sessions where teacher_id = ${row.teacher_id}`;
      await tx`update teacher_tokens
        set revoked_at = now()
        where teacher_id = ${row.teacher_id}
          and purpose = 'reset'
          and used_at is null
          and revoked_at is null`;
      return teacher.id;
    });

    return { ok: true, teacherId };
  } catch {
    return { ok: false, error: "storage" };
  }
}
