export type InvitationDeliveryReason =
  | "not_configured"
  | "rejected"
  | "network";

export type InvitationEmail = {
  to: string;
  link: string;
  classCode: string;
  className: string;
  courseTitle: string;
  teacherName: string;
  expiresAt: Date;
};

export type InvitationDelivery =
  | { sent: true; id: string }
  | { sent: false; reason: InvitationDeliveryReason };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatExpiry(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeZone: "America/Mexico_City",
  }).format(value);
}

export function invitationEmailContent(email: InvitationEmail): {
  subject: string;
  text: string;
  html: string;
} {
  const group = escapeHtml(email.className);
  const course = escapeHtml(email.courseTitle);
  const teacher = escapeHtml(email.teacherName);
  const link = escapeHtml(email.link);
  const classCode = escapeHtml(email.classCode);
  const expires = formatExpiry(email.expiresAt);
  const preheader = `${email.teacherName} te invitó a ${email.className} en MLO. Vence el ${expires}.`;

  return {
    subject: `Invitación a ${email.className}`,
    text: [
      `Hola,`,
      ``,
      `${email.teacherName} te invitó al grupo "${email.className}" del curso "${email.courseTitle}" en MLO.`,
      ``,
      `Abre este enlace desde tu dispositivo para unirte:`,
      email.link,
      ``,
      `Si el enlace no abre la aplicación, entra a MLO, elige "Unirme a una clase" y escribe el código de la clase:`,
      email.classCode,
      ``,
      `El enlace de invitación vence el ${expires} y es de un solo uso.`,
      `El código de la clase no vence.`,
      `Si no esperabas esta invitación, ignora este correo.`,
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
    <title>Invitación a ${group}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preheader)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
            <tr>
              <td style="padding:0 4px 14px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">MLO</td>
                    <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#5b6776;">Maestros</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #e4e8ee;border-radius:14px;overflow:hidden;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="height:4px;background:#0f172a;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:32px 32px 0;">
                      <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#315fec;">Invitación a un grupo</p>
                      <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">${group}</h1>
                      <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#475569;">
                        ${teacher} te invitó al curso <strong style="color:#0f172a;">${course}</strong> en MLO.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 32px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e4e8ee;border-radius:10px;">
                        <tr>
                          <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#5b6776;">Docente</td>
                          <td align="right" style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;font-weight:600;color:#0f172a;">${teacher}</td>
                        </tr>
                        <tr>
                          <td colspan="2" style="height:1px;background:#e4e8ee;font-size:0;line-height:0;">&nbsp;</td>
                        </tr>
                        <tr>
                          <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#5b6776;">Curso</td>
                          <td align="right" style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;font-weight:600;color:#0f172a;">${course}</td>
                        </tr>
                        <tr>
                          <td colspan="2" style="height:1px;background:#e4e8ee;font-size:0;line-height:0;">&nbsp;</td>
                        </tr>
                        <tr>
                          <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#5b6776;">Vence</td>
                          <td align="right" style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;font-weight:600;color:#0f172a;">${escapeHtml(expires)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 32px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" style="background:#0f172a;border-radius:9px;">
                            <a href="${link}" style="display:block;padding:14px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;">Abrir MLO y unirme</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5b6776;">
                      Si el botón no abre la aplicación, copia este enlace:<br>
                      <a href="${link}" style="color:#315fec;text-decoration:underline;word-break:break-all;">${link}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 32px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e4e8ee;">
                        <tr>
                          <td style="padding-top:20px;">
                            <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5b6776;">Código de la clase</p>
                            <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5b6776;">Entra a MLO, elige “Unirme a una clase” y escribe este código:</p>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e4e8ee;border-radius:8px;">
                              <tr>
                                <td style="padding:12px 14px;font-family:'Courier New',Courier,monospace;font-size:20px;line-height:1.4;font-weight:700;letter-spacing:0.16em;color:#0f172a;">${classCode}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 32px 32px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
                        <tr>
                          <td style="padding:12px 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#92400e;">
                            El enlace de invitación vence el <strong>${escapeHtml(expires)}</strong> y es de un solo uso. El código de la clase no vence. Si no esperabas este correo, ignóralo.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#667085;text-align:center;">
                MLO · Ingeniería de Software<br>
                Este correo se envió porque un docente te invitó a un grupo.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

/**
 * Envía la invitación con la API de Resend. Sin credenciales no intenta red:
 * la invitación queda creada y el enlace se muestra en el panel.
 */
export async function sendInvitationEmail(
  email: InvitationEmail,
): Promise<InvitationDelivery> {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };

  const content = invitationEmailContent(email);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email.to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return { sent: false, reason: "rejected" };

    const data = (await response.json().catch(() => null)) as
      | { id?: unknown }
      | null;
    return { sent: true, id: typeof data?.id === "string" ? data.id : "" };
  } catch {
    return { sent: false, reason: "network" };
  }
}
