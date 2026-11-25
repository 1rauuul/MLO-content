import { randomInt, timingSafeEqual } from "node:crypto";

import { db } from "./db";
import { escapeHtml, normalizeEmail, sendEmail } from "./email";
import { hashPassword, hashToken } from "./password";
import { validatePassword } from "./password-policy";

export const STUDENT_RECOVERY_CODE_TTL_MINUTES = 15;
export const STUDENT_RECOVERY_MAX_REQUESTS = 3;
export const STUDENT_RECOVERY_WINDOW_MINUTES = 15;
export const STUDENT_RECOVERY_MAX_ATTEMPTS = 5;

export type StudentRecoveryResult =
  | { ok: true }
  | { ok: false; error: "invalid_email" | "email_unavailable" };

export type StudentResetResult =
  | { ok: true }
  | { ok: false; error: "invalid_code" | "password_invalid" };

function emailConfigured(): boolean {
  return Boolean(
    process.env.EMAIL_PROVIDER_API_KEY?.trim() &&
      process.env.EMAIL_FROM?.trim(),
  );
}

export function generateStudentRecoveryCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function isStudentRecoveryCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

function sameRecoveryCode(code: string, stored: string): boolean {
  const actual = Buffer.from(hashToken(code), "hex");
  const expected = Buffer.from(stored, "hex");
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

function formatExpiry(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(value);
}

export function studentRecoveryEmailContent(input: {
  username: string;
  code: string;
  expiresAt: Date;
}): { subject: string; text: string; html: string } {
  const username = input.username.trim();
  const safeUsername = escapeHtml(username);
  const safeCode = escapeHtml(input.code);
  const expires = formatExpiry(input.expiresAt);

  return {
    subject: "Recupera tu contraseña de MLO",
    text: [
      `Hola, ${username}:`,
      ``,
      `Tu código para restablecer la contraseña de MLO es: ${input.code}`,
      ``,
      `Vence el ${expires}.`,
      `Tu usuario es ${username}.`,
      `Si no solicitaste este cambio, ignora este correo.`,
      ``,
      `MLO · Ingeniería de Software`,
    ].join("\n"),
    html: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Recupera tu contraseña</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
            <tr>
              <td style="padding:0 4px 14px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">MLO</td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #e4e8ee;border-radius:14px;padding:32px;font-family:Arial,Helvetica,sans-serif;">
                <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#315fec;">Cuenta de alumno</p>
                <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">Recupera tu contraseña</h1>
                <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#475569;">Hola, ${safeUsername}. Usa este código para elegir una nueva contraseña:</p>
                <p style="margin:24px 0 0;font-family:monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#0f172a;">${safeCode}</p>
                <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#475569;">Vence el ${expires}. Tu usuario es <strong>${safeUsername}</strong>.</p>
                <p style="margin:18px 0 0;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;line-height:1.5;color:#92400e;">Si no solicitaste este cambio, ignora este correo.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#667085;text-align:center;">MLO · Ingeniería de Software</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

export async function requestStudentPasswordReset(
  rawEmail: string,
): Promise<StudentRecoveryResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: "invalid_email" };
  // Se comprueba antes de buscar la cuenta para no filtrar su existencia.
  if (!emailConfigured()) return { ok: false, error: "email_unavailable" };

  const [account] = await db()<{
    student_id: string;
    username: string;
    name: string;
  }[]>`
    select a.student_id, a.username, s.name
      from student_accounts a
      join students s on s.id = a.student_id
     where a.email = ${email}
     limit 1`;
  if (!account) return { ok: true };

  const [recent] = await db()<{ count: number }[]>`
    select count(*)::int as count
      from student_password_resets
     where student_id = ${account.student_id}
       and created_at > now() - make_interval(mins => ${STUDENT_RECOVERY_WINDOW_MINUTES})`;
  if ((recent?.count ?? 0) >= STUDENT_RECOVERY_MAX_REQUESTS) {
    return { ok: true };
  }

  await db()`delete from student_password_resets
    where student_id = ${account.student_id}
      and created_at < now() - interval '1 day'`;
  await db()`update student_password_resets
    set used_at = now()
    where student_id = ${account.student_id}
      and used_at is null`;

  const code = generateStudentRecoveryCode();
  const expiresAt = new Date(
    Date.now() + STUDENT_RECOVERY_CODE_TTL_MINUTES * 60_000,
  );
  await db()`insert into student_password_resets
    (student_id, code_hash, expires_at)
    values (${account.student_id}, ${hashToken(code)}, ${expiresAt.toISOString()})`;

  const content = studentRecoveryEmailContent({
    username: account.username,
    code,
    expiresAt,
  });
  const delivery = await sendEmail({ to: email, ...content });
  if (!delivery.sent) {
    // Sin correo no hay forma de continuar; no se registra el código ni el destinatario.
    console.error("[students] recovery email not delivered:", delivery.reason);
  }
  return { ok: true };
}

export async function confirmStudentPasswordReset(input: {
  email: string;
  code: string;
  password: string;
}): Promise<StudentResetResult> {
  const email = normalizeEmail(input.email);
  const code = input.code.trim();
  if (!email || !isStudentRecoveryCode(code)) {
    return { ok: false, error: "invalid_code" };
  }
  if (!validatePassword(input.password).valid) {
    return { ok: false, error: "password_invalid" };
  }

  const [account] = await db()<{ student_id: string; username: string }[]>`
    select a.student_id, a.username
      from student_accounts a
     where a.email = ${email}
     limit 1`;
  if (!account) return { ok: false, error: "invalid_code" };

  const [reset] = await db()<{
    id: string;
    code_hash: string;
    attempts: number;
  }[]>`
    select id, code_hash, attempts
      from student_password_resets
     where student_id = ${account.student_id}
       and used_at is null
       and expires_at > now()
     order by created_at desc
     limit 1`;
  if (!reset) return { ok: false, error: "invalid_code" };

  if (reset.attempts >= STUDENT_RECOVERY_MAX_ATTEMPTS) {
    await db()`update student_password_resets
      set used_at = now()
      where id = ${reset.id}`;
    return { ok: false, error: "invalid_code" };
  }

  if (!sameRecoveryCode(code, reset.code_hash)) {
    const attempts = reset.attempts + 1;
    await db()`update student_password_resets
      set attempts = ${attempts},
          used_at = case when ${attempts} >= ${STUDENT_RECOVERY_MAX_ATTEMPTS}
                         then now()
                         else used_at
                    end
      where id = ${reset.id}`;
    return { ok: false, error: "invalid_code" };
  }

  const passwordHash = await hashPassword(input.password);
  await db().begin(async (tx) => {
    await tx`update student_accounts
      set password_hash = ${passwordHash}, updated_at = now()
      where student_id = ${account.student_id}`;
    await tx`update student_password_resets
      set used_at = now()
      where student_id = ${account.student_id}
        and used_at is null`;
    await tx`delete from student_sessions where student_id = ${account.student_id}`;
    await tx`delete from student_auth_attempts where username = ${account.username}`;
  });
  return { ok: true };
}
