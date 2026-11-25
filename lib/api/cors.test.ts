import assert from "node:assert/strict";
import test from "node:test";

import { CORS_HEADERS, corsAllowedOrigin, corsPreflight } from "./cors";

test("CORS: desarrollo abre cualquier origen y las respuestas varían por Origin", () => {
  assert.equal(corsAllowedOrigin(undefined, false), "*");
  assert.equal(CORS_HEADERS["Access-Control-Allow-Origin"], "*");
  assert.equal(CORS_HEADERS.Vary, "Origin");
  assert.equal(corsPreflight().headers.get("vary"), "Origin");
});

test("CORS: el origen configurado manda y producción sin origen no abre CORS", () => {
  assert.equal(
    corsAllowedOrigin("https://panel.example.com", false),
    "https://panel.example.com",
  );
  assert.equal(corsAllowedOrigin("https://panel.example.com", true), "https://panel.example.com");
  assert.equal(corsAllowedOrigin("  https://panel.example.com  ", true), "https://panel.example.com");
  assert.equal(corsAllowedOrigin(undefined, true), null);
  assert.equal(corsAllowedOrigin("", true), null);
});
