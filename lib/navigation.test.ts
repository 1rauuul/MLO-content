import assert from "node:assert/strict";
import test from "node:test";

import { backTo } from "./navigation";

test("backTo acepta solo rutas internas", () => {
  assert.equal(backTo("/grupos/abc"), "/grupos/abc");
  assert.equal(backTo("/"), "/");
  assert.equal(backTo("//evil.example"), null);
  assert.equal(backTo("/\\evil.example"), null);
  assert.equal(backTo("https://evil.example"), null);
  assert.equal(backTo("javascript:alert(1)"), null);
  assert.equal(backTo(undefined), null);
  assert.equal(backTo(["/grupos/abc"]), null);
});
