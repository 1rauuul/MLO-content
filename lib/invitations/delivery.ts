export type InvitationEmail = {
  to: string;
  link: string;
  className: string;
  courseTitle: string;
  teacherName: string;
  expiresAt: Date;
};

export type InvitationDelivery =
  | { sent: true; id: string }
  | { sent: false; reason: "not_configured" | "rejected" | "network" };

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
  const expires = formatExpiry(email.expiresAt);

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
      `La invitación vence el ${expires} y es de un solo uso.`,
      `Si no esperabas esta invitación, ignora este correo.`,
    ].join("\n"),
    html: `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,sans-serif;color:#172033">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e6ec;border-radius:12px;padding:28px">
      <p style="margin:0 0 16px;font-size:15px">Hola,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
        ${teacher} te invitó al grupo <strong>${group}</strong> del curso
        <strong>${course}</strong> en MLO.
      </p>
      <p style="margin:0 0 20px">
        <a href="${link}" style="display:inline-block;background:#172033;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px">
          Abrir MLO y unirme
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#5b6472">
        Si el botón no abre la aplicación, copia este enlace:
      </p>
      <p style="margin:0 0 20px;font-size:13px;word-break:break-all">
        <a href="${link}" style="color:#315fec">${link}</a>
      </p>
      <p style="margin:0;font-size:13px;color:#5b6472">
        La invitación vence el ${escapeHtml(expires)} y es de un solo uso.
        Si no esperabas esta invitación, ignora este correo.
      </p>
    </div>
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
