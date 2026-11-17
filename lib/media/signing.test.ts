import assert from "node:assert/strict";
import test from "node:test";

import { signedMediaUrl, signMediaId, verifyMediaSignature } from "./signing";

process.env.MEDIA_SECRET = "test-secret";
process.env.APP_BASE_URL = "https://cms.test";

const id = "6f0c7f0a-1a2b-4c3d-8e9f-0123456789ab";

test("firma una URL absoluta de medios", () => {
  const url = signedMediaUrl(id);
  assert.match(url, /^https:\/\/cms\.test\/api\/media\/[0-9a-f-]+\?sig=/);
  const signature = new URL(url).searchParams.get("sig") ?? "";
  assert.equal(verifyMediaSignature(id, signature), true);
});

test("rechaza firmas de otro id o manipuladas", () => {
  const signature = signMediaId(id);
  assert.equal(verifyMediaSignature("otro", signature), false);
  assert.equal(verifyMediaSignature(id, `${signature}x`), false);
  assert.equal(verifyMediaSignature(id, ""), false);
});

test("exige APP_BASE_URL en producción", () => {
  const base = process.env.APP_BASE_URL;
  const nodeEnv = process.env.NODE_ENV;
  const env = process.env as Record<string, string | undefined>;
  delete env.APP_BASE_URL;
  env.NODE_ENV = "production";
  try {
    assert.throws(() => signedMediaUrl(id), /APP_BASE_URL/);
  } finally {
    env.APP_BASE_URL = base;
    env.NODE_ENV = nodeEnv;
  }
});
