import assert from "node:assert/strict";
import test from "node:test";

import { parseBlocks } from "./content";

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

test("rechaza un tipo desconocido y un texto vacío", () => {
  assert.ok("error" in parseBlocks(JSON.stringify([{ type: "image", src: "x.png" }])));
  assert.ok("error" in parseBlocks(JSON.stringify([{ type: "p", text: "   " }])));
});

test("rechaza un arreglo vacío o JSON inválido", () => {
  assert.ok("error" in parseBlocks("[]"));
  assert.ok("error" in parseBlocks("{"));
});
