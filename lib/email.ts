/** Validación de correo del panel: cualquier dominio, formato básico. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 5 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export type EmailDeliveryReason = "not_configured" | "rejected" | "network";

export type EmailDelivery =
  | { sent: true; id: string }
  | { sent: false; reason: EmailDeliveryReason };

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Envía un correo con Resend. Sin credenciales no intenta red: el llamador
 * decide si muestra el enlace o mantiene una respuesta genérica.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailDelivery> {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
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
