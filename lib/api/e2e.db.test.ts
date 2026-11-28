import assert from "node:assert/strict";
import test, { after } from "node:test";

import { GET as classPreview } from "@/app/api/mlo/v3/classes/[code]/route";
import { POST as joinClass } from "@/app/api/mlo/v3/classes/[code]/join/route";
import { GET as groupRelease } from "@/app/api/mlo/v3/classes/[code]/release/route";
import { GET as listCourses } from "@/app/api/mlo/v3/courses/route";
import { GET as courseManifest } from "@/app/api/mlo/v3/catalogs/[catalogId]/manifest/route";
import { cleanupE2EFixture, seedE2EFixture } from "@/lib/api/e2e-fixtures";
import type { ReleaseV3 } from "@/lib/content/contract-v3";
import { db } from "@/lib/db";

after(async () => {
  await db().end({ timeout: 5 });
});

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

test("flujo HTTP v3: preview, join, release, cursos y manifest", async () => {
  const baseUrl = "http://localhost/api/mlo/v3";
  const fixture = await seedE2EFixture();

  try {
    assert.equal(fixture.published?.extras, 1);
    assert.equal(fixture.published?.v3Version, 1);
    const contentCourseId = fixture.contentCourseId;
    assert.ok(contentCourseId, "el grupo debe tener curso de contenido");

    const previewResponse = await classPreview(
      request(`${baseUrl}/classes/${fixture.joinCode}`),
      { params: Promise.resolve({ code: fixture.joinCode }) },
    );
    assert.equal(previewResponse.status, 200);
    const preview = (await previewResponse.json()) as {
      class: { id: string };
      course: { catalogId: string };
      published: { version: number } | null;
    };
    assert.equal(preview.class.id, fixture.classId);
    assert.equal(preview.course.catalogId, fixture.courseKey);
    assert.equal(preview.published?.version, 1);

    const joinResponse = await joinClass(
      new Request(`${baseUrl}/classes/${fixture.joinCode}/join`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": fixture.forwardedFor,
        },
        body: JSON.stringify({
          studentKey: fixture.studentKey,
          studentName: fixture.studentName,
        }),
      }),
      { params: Promise.resolve({ code: fixture.joinCode }) },
    );
    assert.equal(joinResponse.status, 200);
    const joined = (await joinResponse.json()) as {
      joined: boolean;
      course: { catalogId: string };
    };
    assert.equal(joined.joined, true);
    assert.equal(joined.course.catalogId, fixture.courseKey);

    const releaseResponse = await groupRelease(
      request(`${baseUrl}/classes/${fixture.joinCode}/release`, {
        "x-mlo-student-key": fixture.studentKey,
      }),
      { params: Promise.resolve({ code: fixture.joinCode }) },
    );
    assert.equal(releaseResponse.status, 200);
    const release = (await releaseResponse.json()) as ReleaseV3 & {
      kind: string;
      catalogId: string;
      additions: { lessonId: string; blocks: { type: string; text?: string }[] }[];
    };
    assert.equal(release.kind, "group");
    assert.equal(release.catalogId, fixture.courseKey);
    assert.equal(release.additions.length, 1);
    assert.equal(
      release.additions[0]?.lessonId,
      `${fixture.courseKey}-${fixture.lessonContentId}`,
    );
    assert.equal(release.additions[0]?.blocks[0]?.text, "Bloque solo del grupo E2E.");

    const coursesResponse = await listCourses(
      request(`${baseUrl}/courses`, { "x-mlo-student-key": fixture.studentKey }),
    );
    assert.equal(coursesResponse.status, 200);
    const courses = (await coursesResponse.json()) as {
      courses: { catalogId: string; version: number; level: string; icon: string }[];
    };
    const listed = courses.courses.find((item) => item.catalogId === fixture.courseKey);
    assert.ok(listed, "el curso del grupo debe aparecer en /courses");
    assert.equal(listed.version, 1);
    assert.equal(listed.level, "Fundamental");
    assert.equal(listed.icon, "code");

    const manifestResponse = await courseManifest(
      request(`${baseUrl}/catalogs/${fixture.courseKey}/manifest`, {
        "x-mlo-student-key": fixture.studentKey,
      }),
      { params: Promise.resolve({ catalogId: fixture.courseKey }) },
    );
    assert.equal(manifestResponse.status, 200);
    const manifest = (await manifestResponse.json()) as ReleaseV3 & {
      kind: string;
      catalogId: string;
    };
    assert.equal(manifest.kind, "course");
    assert.equal(manifest.catalogId, fixture.courseKey);
  } finally {
    await cleanupE2EFixture(fixture);
  }
});
