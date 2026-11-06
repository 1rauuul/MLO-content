import type { InvitationError } from "./core";

export const INVITATION_ERROR_STATUS: Record<InvitationError, number> = {
  invalid: 400,
  expired: 410,
  used: 409,
  revoked: 410,
  full: 409,
  already_member: 409,
};

export const INVITATION_ERROR_MESSAGE: Record<InvitationError, string> = {
  invalid: "La invitación no es válida.",
  expired: "La invitación venció.",
  used: "La invitación ya se usó.",
  revoked: "La invitación fue revocada.",
  full: "El grupo no tiene cupo disponible.",
  already_member: "Ya perteneces a un grupo de este curso.",
};

export function invitationErrorBody(error: InvitationError) {
  return { error, message: INVITATION_ERROR_MESSAGE[error] };
}
