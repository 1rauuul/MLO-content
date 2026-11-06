export type InvitationEmail = {
  to: string;
  link: string;
};

export type InvitationDelivery = {
  sent: false;
  reason: "not_configured";
};

/**
 * Resend deshabilitado por DEC-10: sin SDK, sin credenciales y sin red. El
 * correo ya queda registrado en `class_invitations` para un envío futuro.
 */
export function sendInvitationEmail(
  email: InvitationEmail,
): InvitationDelivery {
  void email;
  return { sent: false, reason: "not_configured" };
}
