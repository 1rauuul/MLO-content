import assert from "node:assert/strict";
import test from "node:test";

import {
  countWords,
  courseDescriptionError,
  parseBlocks,
} from "./content";

test("acepta los cinco tipos de bloque", () => {
  const result = parseBlocks(
    JSON.stringify([
      { type: "p", text: "Hola" },
      { type: "h", text: "Título" },
      { type: "bullets", items: ["Uno", "Dos"] },
      { type: "numbers", items: ["Primero"] },
      { type: "table", header: ["A", "B"], rows: [["1", "2"]] },
    ]),
  );

  assert.ok("blocks" in result);
  assert.equal(result.blocks.length, 5);
});

test("rechaza una tabla con filas de otro largo", () => {
  const result = parseBlocks(
    JSON.stringify([{ type: "table", header: ["A", "B"], rows: [["1"]] }]),
  );

  assert.ok("error" in result);
});

const mediaId = "6f0c7f0a-1a2b-4c3d-8e9f-0123456789ab";

test("cuenta palabras y limita la descripción breve del curso", () => {
  assert.equal(countWords("  uno   dos\ntres  "), 3);
  assert.equal(courseDescriptionError("Texto corto"), null);

  const sixty = Array.from({ length: 60 }, () => "a").join(" ");
  assert.equal(courseDescriptionError(sixty), null);
  assert.match(
    courseDescriptionError(`${sixty} extra`) ?? "",
    /60 palabras/,
  );
  assert.match(courseDescriptionError("a".repeat(281)) ?? "", /280 caracteres/);
});

test("acepta imagen y video y normaliza sus campos", () => {
  const result = parseBlocks(
    JSON.stringify([
      { type: "image", mediaId, mime: "image/webp", width: 1280, height: 720, alt: "Diagrama" },
      { type: "video", url: "https://youtu.be/dQw4w9WgXcQ", title: "Clase" },
    ]),
  );

  assert.ok("blocks" in result);
  assert.equal(result.blocks[0].type, "image");
  assert.equal((result.blocks[0] as { src: string }).src, `/api/media/${mediaId}`);
  assert.equal(result.blocks[1].type, "video");
  assert.equal(
    (result.blocks[1] as { url: string }).url,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
});

test("rechaza imagen sin alt, MIME no permitido y video no YouTube", () => {
  assert.ok(
    "error" in
      parseBlocks(
        JSON.stringify([
          { type: "image", mediaId, mime: "image/webp", width: 1, height: 1, alt: "" },
        ]),
      ),
  );
  assert.ok(
    "error" in
      parseBlocks(
        JSON.stringify([
          { type: "image", mediaId, mime: "image/svg+xml", width: 1, height: 1, alt: "x" },
        ]),
      ),
  );
  assert.ok(
    "error" in
      parseBlocks(JSON.stringify([{ type: "video", url: "https://vimeo.com/123", title: "x" }])),
  );
});

test("rechaza un tipo desconocido y un texto vacío", () => {
  assert.ok("error" in parseBlocks(JSON.stringify([{ type: "audio", src: "x.mp3" }])));
  assert.ok("error" in parseBlocks(JSON.stringify([{ type: "p", text: "   " }])));
});

test("rechaza un arreglo vacío o JSON inválido", () => {
  assert.ok("error" in parseBlocks("[]"));
  assert.ok("error" in parseBlocks("{"));
});

test("requiere contenido de lectura además de subtítulos", () => {
  const result = parseBlocks(JSON.stringify([{ type: "h", text: "Solo un encabezado" }]));

  assert.deepEqual(result, {
    error: "Agrega al menos un párrafo, una lista, una tabla, una imagen o un video.",
  });
});
