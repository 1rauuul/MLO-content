import assert from "node:assert/strict";
import test from "node:test";

import { clientIpFromHeaders, RATE_LIMITS } from "./rate-limit";

test("lee la IP del proxy", () => {
  assert.equal(
    clientIpFromHeaders(
      new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }),
    ),
    "1.2.3.4",
  );
  assert.equal(
    clientIpFromHeaders(new Headers({ "x-real-ip": "9.8.7.6" })),
    "9.8.7.6",
  );
  assert.equal(clientIpFromHeaders(new Headers()), "unknown");
});

test("los límites son positivos y con ventana de 15 minutos", () => {
  for (const rule of Object.values(RATE_LIMITS)) {
    assert.ok(rule.limit > 0);
    assert.equal(rule.windowMinutes, 15);
  }
});

test("los límites por IP soportan un aula compartida", () => {
  assert.ok(RATE_LIMITS.studentLoginIp.limit >= 100);
  assert.ok(RATE_LIMITS.studentRegisterIp.limit >= 50);
  assert.ok(RATE_LIMITS.studentLinkIp.limit >= 50);
  assert.ok(RATE_LIMITS.teacherLoginIp.limit >= 50);
});
