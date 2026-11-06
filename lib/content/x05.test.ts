import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { validateRelease } from "./contract-v3";
import { buildX05Fixture } from "./x05-fixtures";

const fixture = JSON.parse(
  readFileSync(
    join(process.cwd(), "docs/contracts/fixtures/x05/references-release.json"),
    "utf8",
  ),
) as unknown;

type ReferenceDoc = {
  id: string;
  text: string;
  url?: string;
  authors?: unknown;
  year?: unknown;
  doi?: unknown;
};

const references = (): ReferenceDoc[] => (buildX05Fixture().references as ReferenceDoc[]);

test("el fixture x05 se genera con el builder real y valida", () => {
  assert.deepEqual(fixture, buildX05Fixture());
  const result = validateRelease(buildX05Fixture());
  if (!result.ok) assert.fail(result.error);
});

test("publica solo referencias adjuntas y deduplica por id", () => {
  const published = references();
  const ids = published.map((reference) => reference.id);

  assert.deepEqual(ids, ["demo-ref-apa-1", "demo-ref-apa-2"]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.includes("demo-ref-apa-3"), "la referencia sin adjuntar no se publica");
});

test("las referencias cubren los cinco tipos de elemento", () => {
  const release = buildX05Fixture();
  for (const collection of [
    release.lessons,
    release.evaluations,
    release.questions,
    release.exercises,
    release.examples,
  ] as { referenceIds?: string[] }[][]) {
    assert.ok(collection.some((item) => (item.referenceIds ?? []).length > 0));
  }
});

test("APA 7 en el fixture: autores, DOI y ausencia de fecha", () => {
  const [doi, noDate] = references();
  assert.equal(
    doi.text,
    "Sommerville, I. (2016). Software Engineering (10.ª ed.). Pearson. https://doi.org/10.1000/182",
  );
  assert.equal(doi.url, "https://doi.org/10.1000/182");
  assert.equal(
    noDate.text,
    "Pressman, R. S., & Maxim, B. R. (s. f.). Software Engineering: A Practitioner's Approach. McGraw-Hill. https://example.org/pressman",
  );
  assert.equal(noDate.url, "https://example.org/pressman");
});

test("el payload v3 conserva {id, text, url?} sin metadatos", () => {
  for (const reference of references()) {
    assert.deepEqual(
      Object.keys(reference).sort(),
      reference.url ? ["id", "text", "url"] : ["id", "text"],
    );
    assert.equal(reference.authors, undefined);
    assert.equal(reference.year, undefined);
    assert.equal(reference.doi, undefined);
  }
});
