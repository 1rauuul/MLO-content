import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { validateRelease } from "./contract-v3";
import {
  buildGroupRelease,
  canJoinGroup,
  groupVisibility,
  publishedGroupRelease,
  type GroupReleaseInput,
} from "./group-release";
import { hashText } from "./hash";
import { buildX02Fixtures } from "./x02-fixtures";
import { assertPublishableCourse } from "./v3";
import { isUniqueViolation } from "./x03";
import { buildX04Fixture } from "./x04-fixtures";

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "docs/contracts/fixtures/x04/group-release.json"), "utf8"),
) as unknown;

test("el fixture x04 se genera con el builder real y valida", () => {
  assert.deepEqual(fixture, buildX04Fixture());
  const release = buildX04Fixture();
  const result = validateRelease(release);
  if (!result.ok) assert.fail(result.error);
});

test("el release de grupo tiene courseRef, additions e ids propios únicos", () => {
  const release = buildX04Fixture();
  assert.equal(release.kind, "group");
  assert.equal(release.groupId, "class-demo");
  assert.deepEqual(release.courseRef, {
    version: 1,
    hash: hashText("x04-parent-v1"),
  });

  const additions = release.additions as { lessonId: string; blocks: unknown[] }[];
  assert.deepEqual(additions, [
    {
      lessonId: "demo-l1.1",
      blocks: [{ type: "p", text: "Bloque adicional del grupo." }],
    },
  ]);

  const ids = [
    ...(release.units as { id: string }[]),
    ...(release.topics as { id: string }[]),
    ...(release.lessons as { id: string }[]),
    ...(release.exercises as { id: string }[]),
    ...(release.examples as { id: string }[]),
    ...(release.evaluations as { id: string }[]),
    ...(release.questions as { id: string }[]),
  ].map((item) => item.id);
  assert.ok(ids.every((id) => id.startsWith("g-class-demo-")));
  assert.equal(new Set(ids).size, ids.length);

  const evaluation = (release.evaluations as { id: string; exerciseIds: string[] }[])[0];
  assert.deepEqual(evaluation.exerciseIds, ["g-class-demo-gord1"]);
});

test("el builder conserva extras legacy sobre un subtema del padre", () => {
  const input: GroupReleaseInput = {
    catalogId: "demo",
    groupId: "class-demo",
    contentCourseId: "course-group-demo",
    version: 2,
    publishedAt: "2026-11-06T00:00:00.000Z",
    name: "Grupo A",
    visibility: "published",
    courseRef: { version: 1, hash: hashText("x04-parent-v1") },
    own: {
      schemaVersion: 2,
      title: "Grupo A",
      units: [],
      topics: [],
      lessons: [],
      evaluations: [],
      exercises: [],
      examples: [],
      questions: [],
    },
    additions: [],
    externalExercises: [
      {
        content_id: "extra-ex",
        lesson_content_id: "l1.1",
        topic_content_id: "t1",
        type: "order",
        prompt: "Extra",
        instructions: "",
        correct_order: ["A", "B"],
        config: {},
        explanation: "",
        example: null,
        position: 0,
      },
    ],
    externalExamples: [],
  };
  const built = buildGroupRelease(input);
  const exercise = (built.exercises as { id: string; topicId: string }[])[0];
  assert.equal(exercise.id, "g-class-demo-extra-ex");
  assert.equal(exercise.topicId, "demo-t1");
  assert.equal(validateRelease(built).ok, true);
});

test("el cupo y la segunda membresía se rechazan en la comprobación pura", () => {
  assert.deepEqual(
    canJoinGroup({ archived: false, capacity: null, activeMembers: 99, hasActiveMembershipInCourse: false }),
    { ok: true },
  );
  assert.deepEqual(
    canJoinGroup({ archived: true, capacity: null, activeMembers: 0, hasActiveMembershipInCourse: false }),
    { ok: false, reason: "archived" },
  );
  assert.deepEqual(
    canJoinGroup({ archived: false, capacity: 2, activeMembers: 2, hasActiveMembershipInCourse: false }),
    { ok: false, reason: "full" },
  );
  assert.deepEqual(
    canJoinGroup({ archived: false, capacity: null, activeMembers: 0, hasActiveMembershipInCourse: true }),
    { ok: false, reason: "duplicate" },
  );
});

test("archivar cambia la visibilidad del grupo", () => {
  assert.equal(groupVisibility({ archived: false }), "published");
  assert.equal(groupVisibility({ archived: true }), "unpublished");
});

test("la violación del índice de membresía se reconoce como rechazo controlado", () => {
  assert.equal(isUniqueViolation({ code: "23505" }), true);
  assert.equal(isUniqueViolation({ code: "23503" }), false);
  assert.equal(isUniqueViolation(null), false);
  assert.equal(isUniqueViolation("23505"), false);
});

test("solo se sirve un release de grupo publicado", () => {
  const published = buildX04Fixture();
  const served = publishedGroupRelease({ release: published });
  assert.equal(served?.version, 1);
  assert.match(String(served?.hash), /^[0-9a-f]{64}$/);

  assert.equal(publishedGroupRelease(null), null);
  assert.equal(publishedGroupRelease({}), null);
  assert.equal(publishedGroupRelease({ release: buildX02Fixtures().manifest }), null);

  const hidden = {
    ...published,
    group: { name: "Grupo A", visibility: "unpublished" },
  };
  assert.equal(publishedGroupRelease({ release: hidden }), null);
});

test("el curso interno de un grupo no se publica como curso", () => {
  assert.doesNotThrow(() => assertPublishableCourse({ is_group: false }));
  assert.throws(
    () => assertPublishableCourse({ is_group: true }),
    /no se publica como curso/,
  );
});
