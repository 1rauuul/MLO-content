import { escapeHtml, sendEmail, type EmailDelivery } from "@/lib/email";

export type TeacherInvitationEmail = {
  to: string;
  name: string;
  link: string;
  expiresAt: Date;
  invitedBy?: string;
};

export type TeacherPasswordResetEmail = {
  to: string;
  name: string;
  link: string;
  expiresAt: Date;
};

function formatDate(value: Date, withTime: boolean): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone: "America/Mexico_City",
  }).format(value);
}

function layout(input: {
  eyebrow: string;
  title: string;
  intro: string;
  link: string;
  cta: string;
  note: string;
  footer: string;
}): string {
  const link = escapeHtml(input.link);
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${input.title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
            <tr>
              <td style="padding:0 4px 14px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">
                MLO <span style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#5b6776;">Maestros</span>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #e4e8ee;border-radius:14px;padding:32px;font-family:Arial,Helvetica,sans-serif;">
                <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#315fec;">${input.eyebrow}</p>
                <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">${input.title}</h1>
                <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#475569;">${input.intro}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                  <tr>
                    <td align="center" style="background:#0f172a;border-radius:9px;">
                      <a href="${link}" style="display:block;padding:14px 20px;font-size:15px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;">${input.cta}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#5b6776;">Si el botón no abre, copia este enlace:<br><a href="${link}" style="color:#315fec;text-decoration:underline;word-break:break-all;">${link}</a></p>
                <p style="margin:20px 0 0;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;line-height:1.5;color:#92400e;">${input.note}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#667085;text-align:center;">
                ${input.footer}<br>MLO · Ingeniería de Software
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function teacherInvitationEmailContent(email: TeacherInvitationEmail): {
  subject: string;
  text: string;
  html: string;
} {
  const name = escapeHtml(email.name);
  const inviter = email.invitedBy
    ? escapeHtml(email.invitedBy)
    : "El administrador de MLO";
  const expires = escapeHtml(formatDate(email.expiresAt, false));
  const intro = `Hola, ${name}. ${inviter} te invitó a MLO como maestro. Crea tu contraseña para activar tu cuenta.`;

  return {
    subject: "Activa tu cuenta de maestro en MLO",
    text: [
      `Hola, ${email.name}:`,
      ``,
      `${email.invitedBy ?? "El administrador de MLO"} te invitó a MLO como maestro.`,
      `Crea tu contraseña para activar tu cuenta:`,
      email.link,
      ``,
      `El enlace vence el ${formatDate(email.expiresAt, false)} y es de un solo uso.`,
      `Si no esperabas esta invitación, ignora este correo.`,
      ``,
      `MLO · Ingeniería de Software`,
    ].join("\n"),
    html: layout({
      eyebrow: "Invitación de maestro",
      title: "Activa tu cuenta",
      intro,
      link: email.link,
      cta: "Crear mi contraseña",
      note: `El enlace vence el ${expires} y es de un solo uso.`,
      footer: "Este correo se envió porque un administrador te invitó al panel de maestros.",
    }),
  };
}

export function teacherPasswordResetEmailContent(
  email: TeacherPasswordResetEmail,
): { subject: string; text: string; html: string } {
  const expires = escapeHtml(formatDate(email.expiresAt, true));
  const intro = `Hola, ${escapeHtml(email.name)}. Recibimos una solicitud para restablecer tu contraseña. Elige una nueva para volver a entrar.`;

  return {
    subject: "Restablece tu contraseña de MLO",
    text: [
      `Hola, ${email.name}:`,
      ``,
      `Recibimos una solicitud para restablecer tu contraseña.`,
      `Elige una nueva aquí:`,
      email.link,
      ``,
      `El enlace vence el ${formatDate(email.expiresAt, true)}.`,
      `Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.`,
      ``,
      `MLO · Ingeniería de Software`,
    ].join("\n"),
    html: layout({
      eyebrow: "Recuperación de contraseña",
      title: "Elige una nueva contraseña",
      intro,
      link: email.link,
      cta: "Restablecer contraseña",
      note: `El enlace vence el ${expires}. Si no fuiste tú, ignora este correo.`,
      footer: "Este correo se envió porque alguien pidió restablecer tu contraseña.",
    }),
  };
}

export async function sendTeacherInvitationEmail(
  email: TeacherInvitationEmail,
): Promise<EmailDelivery> {
  return sendEmail({
    to: email.to,
    ...teacherInvitationEmailContent(email),
  });
}

export async function sendTeacherPasswordResetEmail(
  email: TeacherPasswordResetEmail,
): Promise<EmailDelivery> {
  return sendEmail({
    to: email.to,
    ...teacherPasswordResetEmailContent(email),
  });
}
