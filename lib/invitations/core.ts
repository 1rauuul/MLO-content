import { createHash, randomBytes } from "node:crypto";

export const INVITATION_TTL_DAYS = 3;
export const INVITATION_MAX_ATTEMPTS = 10;
export const INVITATION_TOKEN_BYTES = 32;
export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type InvitationError =
  | "invalid"
  | "expired"
  | "used"
  | "revoked"
  | "full"
  | "already_member";

export type InvitationStatus = "pending" | "used" | "expired" | "revoked";

export type InvitationState = {
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  attempt_count: number;
};

export type InvitationClaimContext = {
  archived: boolean;
  capacity: number | null;
  activeMembers: number;
  alreadyMember: boolean;
  now: Date;
};

/** 32 bytes aleatorios en base64url: 43 caracteres sin relleno. */
export function generateInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isInvitationToken(value: string): boolean {
  return INVITATION_TOKEN_PATTERN.test(value);
}

/** Acepta cualquier dominio; solo exige formato y normaliza a minúsculas. */
export function normalizeInvitationEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 5 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function invitationExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function invitationStatus(
  invitation: InvitationState,
  now: Date = new Date(),
): InvitationStatus {
  if (invitation.used_at) return "used";
  if (invitation.revoked_at) return "revoked";
  if (invitation.expires_at.getTime() <= now.getTime()) return "expired";
  return "pending";
}

export function buildInvitationLink(token: string): string {
  return `mloingenieriasoftware://join-class?token=${encodeURIComponent(token)}`;
}

/**
 * Primer error estable del reclamo. El límite de intentos se evalúa antes que
 * el estado para no revelar si el token existe cuando ya se agotó.
 */
export function invitationClaimError(
  invitation: InvitationState,
  context: InvitationClaimContext,
): InvitationError | null {
  if (invitation.attempt_count >= INVITATION_MAX_ATTEMPTS) return "invalid";
  if (invitation.used_at) return "used";
  if (invitation.revoked_at) return "revoked";
  if (invitation.expires_at.getTime() <= context.now.getTime()) return "expired";
  if (context.archived) return "invalid";
  if (context.alreadyMember) return "already_member";
  if (context.capacity !== null && context.activeMembers >= context.capacity) {
    return "full";
  }
  return null;
}
