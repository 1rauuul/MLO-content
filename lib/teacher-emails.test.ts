import assert from "node:assert/strict";
import test from "node:test";

import {
  sendTeacherInvitationEmail,
  teacherInvitationEmailContent,
  teacherPasswordResetEmailContent,
} from "./teacher-emails";

const EXPIRES = new Date("2026-12-02T18:30:00.000Z");

test("la invitación incluye nombre, enlace, quién invita y vencimiento", () => {
  const link = "https://cms.test/invitacion?token=abc";
  const content = teacherInvitationEmailContent({
    to: "maestro@test.dev",
    name: "<Ana & Cía>",
    invitedBy: "Profe <Eduardo>",
    link,
    expiresAt: EXPIRES,
  });

  assert.match(content.subject, /Activa tu cuenta/);
  assert.ok(content.text.includes(link));
  assert.ok(content.html.includes(link));
  assert.ok(content.text.includes("Profe <Eduardo>"));
  assert.ok(content.html.includes("Profe &lt;Eduardo&gt;"));
  assert.ok(content.html.includes("&lt;Ana &amp; Cía&gt;"));
  assert.ok(!content.html.includes("<Ana"));
  assert.match(content.text, /vence el/);
  assert.match(content.html, /vence el/);
});

test("la recuperación incluye el enlace y la vigencia con hora", () => {
  const link = "https://cms.test/restablecer?token=xyz";
  const content = teacherPasswordResetEmailContent({
    to: "maestro@test.dev",
    name: "Ana",
    link,
    expiresAt: EXPIRES,
  });

  assert.match(content.subject, /Restablece tu contraseña/);
  assert.ok(content.text.includes(link));
  assert.ok(content.html.includes(link));
  assert.match(content.text, /vence el/);
  assert.match(content.html, /vence el/);
  assert.match(content.text, /Si no fuiste tú/);
});

test("sin credenciales la entrega queda pendiente de configuración", async () => {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const from = process.env.EMAIL_FROM;
  delete process.env.EMAIL_PROVIDER_API_KEY;
  delete process.env.EMAIL_FROM;
  try {
    assert.deepEqual(
      await sendTeacherInvitationEmail({
        to: "maestro@test.dev",
        name: "Ana",
        link: "https://cms.test/invitacion?token=abc",
        expiresAt: EXPIRES,
      }),
      { sent: false, reason: "not_configured" },
    );
  } finally {
    if (apiKey === undefined) delete process.env.EMAIL_PROVIDER_API_KEY;
    else process.env.EMAIL_PROVIDER_API_KEY = apiKey;
    if (from === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = from;
  }
});
