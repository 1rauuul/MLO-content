import assert from "node:assert/strict";
import test from "node:test";

import {
  canIssueStudentLink,
  generateStudentLinkCode,
  isStudentLinkCode,
} from "./student-link";

test("el código de vinculación es de 6 dígitos", () => {
  const code = generateStudentLinkCode();
  assert.equal(isStudentLinkCode(code), true);
  assert.match(code, /^\d{6}$/);
});

test("solo el docente dueño o el admin emiten el código", () => {
  const base = {
    teacherId: "t1",
    role: "maestro" as const,
    classTeacherId: "t1",
    isMember: true,
  };
  assert.equal(canIssueStudentLink(base), true);
  assert.equal(canIssueStudentLink({ ...base, classTeacherId: "t2" }), false);
  assert.equal(canIssueStudentLink({ ...base, isMember: false }), false);
  assert.equal(
    canIssueStudentLink({ ...base, role: "admin", classTeacherId: "t2" }),
    true,
  );
});
