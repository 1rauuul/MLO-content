import assert from "node:assert/strict";
import test from "node:test";

import { validateRelease } from "./contract-v3";
import type { CoreCourse, CoreReference } from "./model";
import { apa7Authors, apa7Text, normalizedDoi, referenceUrl } from "./references";
import { parseReferenceInput, validateCatalogForPublish } from "./validate";
import { buildV3Release } from "./v3";
import { buildX05Fixture } from "./x05-fixtures";

const book: CoreReference = {
  content_id: "ref-apa-1",
  authors: ["Sommerville, I."],
  year: 2016,
  title: "Software Engineering",
  source: "Pearson",
  edition: "10.ª ed.",
  doi: "10.1000/182",
  url: "",
};

function courseWith(reference: CoreReference, linkIds: string[]): CoreCourse {
  return {
    schemaVersion: 2,
    title: "Curso",
    units: [
      {
        content_id: "u1",
        number: 1,
        title: "Unidad",
        description: "",
        difficulty: "Fundamental",
        color: "blue",
        position: 0,
      },
    ],
    topics: [
      { content_id: "t1", unit_content_id: "u1", title: "Subtema", summary: "", position: 0 },
    ],
    lessons: [
      {
        content_id: "l1.1",
        unit_content_id: "u1",
        topic_content_id: "t1",
        code: "1.1",
        title: "Lección",
        eyebrow: "",
        body: "",
        code_sample: "",
        context_title: "",
        context_body: "",
        synthesis: [],
        content: [{ type: "p", text: "Texto" }],
        position: 0,
        reference_content_ids: linkIds,
      },
    ],
    evaluations: [],
    exercises: [],
    examples: [],
    questions: [],
    references: [reference],
  };
}

test("APA 7: autores, año, edición y DOI", () => {
  assert.equal(
    apa7Text(book),
    "Sommerville, I. (2016). Software Engineering (10.ª ed.). Pearson. https://doi.org/10.1000/182",
  );
  assert.equal(referenceUrl(book), "https://doi.org/10.1000/182");
});

test("APA 7: varios autores, sin fecha y URL textual", () => {
  const reference: CoreReference = {
    content_id: "ref-apa-2",
    authors: ["Pressman, R. S.", "Maxim, B. R."],
    year: null,
    title: "Software Engineering: A Practitioner's Approach",
    source: "McGraw-Hill",
    edition: "",
    doi: "",
    url: "https://example.org/pressman",
  };
  assert.equal(
    apa7Text(reference),
    "Pressman, R. S., & Maxim, B. R. (s. f.). Software Engineering: A Practitioner's Approach. McGraw-Hill. https://example.org/pressman",
  );
  assert.equal(apa7Authors(["A, A.", "B, B.", "C, C."]), "A, A., B, B., & C, C.");
  assert.equal(normalizedDoi("https://doi.org/10.1000/182"), "10.1000/182");
  assert.equal(normalizedDoi("doi: 10.1000/182"), "10.1000/182");
});

test("el texto APA se guarda generado y no expone metadatos en el payload", () => {
  const release = buildX05Fixture();
  const references = release.references as { id: string; text: string; url?: string }[];
  assert.equal(references.length, 2);
  for (const reference of references) {
    assert.deepEqual(Object.keys(reference).sort(), reference.url ? ["id", "text", "url"] : ["id", "text"]);
    assert.ok(reference.text.length > 0);
  }
});

test("deduplica por id y conserva la primera aparición", () => {
  const release = buildV3Release({
    catalogId: "demo",
    courseId: "course",
    version: 1,
    publishedAt: "2026-11-06T00:00:00.000Z",
    title: "Curso",
    baseRef: null,
    course: courseWith(book, ["ref-apa-1", "ref-apa-1"]),
  });
  const result = validateRelease(release);
  if (!result.ok) assert.fail(result.error);

  assert.equal((release.references as unknown[]).length, 1);
  const lesson = (release.lessons as { referenceIds?: string[] }[])[0];
  assert.deepEqual(lesson.referenceIds, ["demo-ref-apa-1"]);
});

test("valida la referencia y que los enlaces resuelvan", () => {
  assert.doesNotThrow(() => validateCatalogForPublish(courseWith(book, ["ref-apa-1"])));
  assert.throws(
    () => validateCatalogForPublish(courseWith(book, ["ref-inexistente"])),
    /referencia inexistente/,
  );
  assert.throws(
    () =>
      validateCatalogForPublish(
        courseWith({ ...book, title: "" }, ["ref-apa-1"]),
      ),
    /título/,
  );
});

test("parseReferenceInput normaliza el año vacío y rechaza datos inválidos", () => {
  const parsed = parseReferenceInput({
    authors: ["  Sommerville, I.  "],
    year: "",
    title: " Software Engineering ",
    source: "",
    edition: "",
    doi: "",
    url: "",
  });
  if ("error" in parsed) assert.fail(parsed.error);
  assert.equal(parsed.value.year, null);
  assert.deepEqual(parsed.value.authors, ["Sommerville, I."]);
  assert.equal(parsed.value.title, "Software Engineering");

  const badYear = parseReferenceInput({ authors: ["A"], title: "T", year: "20" });
  assert.ok("error" in badYear);
  assert.match(badYear.error, /año/);
  const badUrl = parseReferenceInput({
    authors: ["A"],
    title: "T",
    url: "example.org",
  });
  assert.ok("error" in badUrl);
  assert.match(badUrl.error, /URL/);
  const noAuthors = parseReferenceInput({ authors: [], title: "T" });
  assert.ok("error" in noAuthors);
  assert.match(noAuthors.error, /autor/);
});
