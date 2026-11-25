import assert from "node:assert/strict";
import test from "node:test";

import {
  TEACHER_INVITE_DAYS,
  TEACHER_RESEND_COOLDOWN_SECONDS,
  TEACHER_RESET_MINUTES,
  buildTeacherInviteLink,
  buildTeacherResetLink,
  isTeacherToken,
  teacherCooldownActive,
  teacherInviteExpiresAt,
  teacherResetExpiresAt,
  teacherTokenStatus,
} from "./teacher-accounts";

const NOW = new Date("2026-11-25T12:00:00.000Z");
const TOKEN = "a".repeat(43);

test("acepta tokens base64url de 32 bytes", () => {
  assert.equal(isTeacherToken(TOKEN), true);
  assert.equal(isTeacherToken("a".repeat(42)), false);
  assert.equal(isTeacherToken("a".repeat(44)), false);
  assert.equal(isTeacherToken("a".repeat(42) + "!"), false);
});

test("construye enlaces absolutos sin doble barra", () => {
  assert.equal(
    buildTeacherInviteLink("https://cms.test/", TOKEN),
    `https://cms.test/invitacion?token=${TOKEN}`,
  );
  assert.equal(
    buildTeacherResetLink("https://cms.test", TOKEN),
    `https://cms.test/restablecer?token=${TOKEN}`,
  );
});

test("calcula vencimientos de invitación y recuperación", () => {
  assert.equal(
    teacherInviteExpiresAt(NOW).getTime(),
    NOW.getTime() + TEACHER_INVITE_DAYS * 24 * 60 * 60 * 1000,
  );
  assert.equal(
    teacherResetExpiresAt(NOW).getTime(),
    NOW.getTime() + TEACHER_RESET_MINUTES * 60 * 1000,
  );
  assert.equal(TEACHER_INVITE_DAYS, 7);
  assert.equal(TEACHER_RESET_MINUTES, 60);
});

test("el estado prioriza usado, revocado, vencido y pendiente", () => {
  const base = {
    expires_at: new Date(NOW.getTime() + 60_000),
    used_at: null,
    revoked_at: null,
  };
  assert.equal(teacherTokenStatus(base, NOW), "pending");
  assert.equal(
    teacherTokenStatus({ ...base, used_at: NOW, revoked_at: NOW }, NOW),
    "used",
  );
  assert.equal(teacherTokenStatus({ ...base, revoked_at: NOW }, NOW), "revoked");
  assert.equal(
    teacherTokenStatus(
      { ...base, expires_at: new Date(NOW.getTime() - 1) },
      NOW,
    ),
    "expired",
  );
});

test("el enfriamiento de recuperación dura 60 segundos", () => {
  assert.equal(teacherCooldownActive(null, NOW), false);
  assert.equal(
    teacherCooldownActive(
      new Date(NOW.getTime() - (TEACHER_RESEND_COOLDOWN_SECONDS - 1) * 1000),
      NOW,
    ),
    true,
  );
  assert.equal(
    teacherCooldownActive(
      new Date(NOW.getTime() - (TEACHER_RESEND_COOLDOWN_SECONDS + 1) * 1000),
      NOW,
    ),
    false,
  );
  assert.equal(TEACHER_RESEND_COOLDOWN_SECONDS, 60);
});
