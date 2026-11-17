import assert from "node:assert/strict";
import test from "node:test";

import { mediaMime } from "./image";

test("detecta JPEG, PNG y WebP por sus bytes", () => {
  assert.equal(mediaMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(
    mediaMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  );
  assert.equal(mediaMime(new TextEncoder().encode("RIFF0000WEBP")), "image/webp");
});

test("rechaza SVG y archivos arbitrarios", () => {
  assert.equal(mediaMime(new TextEncoder().encode("<svg></svg>")), null);
  assert.equal(mediaMime(new TextEncoder().encode('{"type":"image"}')), null);
});
