import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { db } from "./db";
import { RATE_LIMITS, takeRateLimit } from "./rate-limit";

const keys: string[] = [];

after(async () => {
  for (const key of keys) {
    await db()`delete from auth_rate_limits where key = ${key}`;
  }
  await db().end({ timeout: 5 });
});

test("40 alumnos caben en login, registro y vinculación por IP", async () => {
  const scopes = [
    ["student_login", RATE_LIMITS.studentLoginIp],
    ["student_register", RATE_LIMITS.studentRegisterIp],
    ["student_link", RATE_LIMITS.studentLinkIp],
  ] as const;
  for (const [scope, rule] of scopes) {
    const key = `test:${randomUUID()}`;
    keys.push(key);
    for (let index = 0; index < 40; index += 1) {
      assert.equal(await takeRateLimit(scope, key, rule), true);
    }
  }
});

test("el limiter bloquea al superar una regla pequeña", async () => {
  const key = `test:${randomUUID()}`;
  keys.push(key);
  const rule = { limit: 2, windowMinutes: 15 };
  assert.equal(await takeRateLimit("student_login", key, rule), true);
  assert.equal(await takeRateLimit("student_login", key, rule), true);
  assert.equal(await takeRateLimit("student_login", key, rule), false);
});
