import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { validateRelease } from "./contract-v3";
import {
  accessControlEnabled,
  buildAuthorizedCourseList,
  canAccessCourse,
  canAccessV2Catalog,
  computeEmpty,
  type CourseCandidate,
} from "./v3";
import { buildX02Fixtures } from "./x02-fixtures";

const fixtures = join(process.cwd(), "docs/contracts/fixtures/x02");
const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(join(fixtures, file), "utf8"));

function candidate(overrides: Partial<CourseCandidate>): CourseCandidate {
  return {
    catalogId: "demo",
    title: "Curso",
    status: "published",
    usesBase: false,
    isBase: false,
    hasAccess: false,
    version: 1,
    hash: "a".repeat(64),
    publishedAt: "2026-11-06T00:00:00.000Z",
    empty: true,
    ...overrides,
  };
}

test("el release v3 de X-02 es metadata válida y sin jerarquía", () => {
  const { manifest } = buildX02Fixtures();
  const result = validateRelease(manifest);
  if (!result.ok) assert.fail(result.error);

  assert.deepEqual(manifest.units, []);
  assert.deepEqual(manifest.topics, []);
  assert.deepEqual(manifest.lessons, []);
  assert.deepEqual(manifest.exercises, []);
  assert.deepEqual(manifest.examples, []);
  assert.deepEqual(manifest.evaluations, []);
  assert.deepEqual(manifest.questions, []);
  assert.equal(manifest.kind, "course");
  assert.equal(manifest.releaseId, "demo-1");
});

test("los fixtures x02 se generan con los mismos builders", () => {
  const expected = buildX02Fixtures();
  assert.deepEqual(readJson("manifest-empty.json"), expected.manifest);
  assert.deepEqual(readJson("course-list.json"), expected.courseList);
});

test("acceso: un curso adicional siempre exige concesión", () => {
  assert.equal(
    canAccessCourse({
      isBase: false,
      status: "published",
      hasGrant: true,
      accessControlOn: false,
    }),
    true,
  );
  assert.equal(
    canAccessCourse({
      isBase: false,
      status: "published",
      hasGrant: false,
      accessControlOn: false,
    }),
    false,
  );
});

test("acceso: el base respeta el flag de piloto", () => {
  assert.equal(
    canAccessCourse({
      isBase: true,
      status: "published",
      hasGrant: false,
      accessControlOn: false,
    }),
    true,
  );
  assert.equal(
    canAccessCourse({
      isBase: true,
      status: "published",
      hasGrant: false,
      accessControlOn: true,
    }),
    false,
  );
  assert.equal(
    canAccessCourse({
      isBase: true,
      status: "published",
      hasGrant: true,
      accessControlOn: true,
    }),
    true,
  );
  assert.equal(accessControlEnabled("on"), true);
  assert.equal(accessControlEnabled(undefined), false);
});

test("borradores y despublicados no se exponen aunque tengan acceso", () => {
  for (const status of ["draft", "unpublished"] as const) {
    assert.equal(
      canAccessCourse({
        isBase: false,
        status,
        hasGrant: true,
        accessControlOn: false,
      }),
      false,
    );
  }
});

test("la lista omite borradores, despublicados y cursos sin concesión", () => {
  const response = buildAuthorizedCourseList(
    [
      candidate({ catalogId: "base", isBase: true, hasAccess: false }),
      candidate({ catalogId: "granted", hasAccess: true }),
      candidate({ catalogId: "no-grant", hasAccess: false }),
      candidate({ catalogId: "draft", status: "draft", hasAccess: true }),
      candidate({ catalogId: "hidden", status: "unpublished", hasAccess: true }),
      candidate({ catalogId: "no-meta", version: null, hash: null, publishedAt: null }),
    ],
    false,
  );

  assert.deepEqual(
    response.courses.map((course) => course.catalogId),
    ["base", "granted"],
  );
  assert.equal(response.schemaVersion, 3);
});

test("v2: el base sigue público y los demás catálogos exigen acceso", () => {
  assert.equal(
    canAccessV2Catalog({
      catalogId: "base",
      status: "published",
      hasGrant: false,
      hasValidStudentKey: false,
    }),
    true,
  );

  assert.equal(
    canAccessV2Catalog({
      catalogId: "demo",
      status: "published",
      hasGrant: false,
      hasValidStudentKey: false,
    }),
    false,
  );
  assert.equal(
    canAccessV2Catalog({
      catalogId: "demo",
      status: "published",
      hasGrant: false,
      hasValidStudentKey: true,
    }),
    false,
  );
  assert.equal(
    canAccessV2Catalog({
      catalogId: "demo",
      status: "published",
      hasGrant: true,
      hasValidStudentKey: true,
    }),
    true,
  );
  for (const status of ["draft", "unpublished"] as const) {
    assert.equal(
      canAccessV2Catalog({
        catalogId: "demo",
        status,
        hasGrant: true,
        hasValidStudentKey: true,
      }),
      false,
    );
  }
});

test("empty distingue curso base y curso con referencia al base", () => {  assert.equal(
    computeEmpty({ isBase: true, usesBase: false, ownLessons: 0, baseLessons: 3 }),
    true,
  );
  assert.equal(
    computeEmpty({ isBase: false, usesBase: true, ownLessons: 0, baseLessons: 3 }),
    false,
  );
  assert.equal(
    computeEmpty({ isBase: false, usesBase: true, ownLessons: 0, baseLessons: 0 }),
    true,
  );
  assert.equal(
    computeEmpty({ isBase: false, usesBase: false, ownLessons: 0, baseLessons: 3 }),
    true,
  );
  assert.equal(
    computeEmpty({ isBase: false, usesBase: false, ownLessons: 1, baseLessons: 3 }),
    false,
  );
});
