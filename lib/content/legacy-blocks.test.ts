import assert from "node:assert/strict";
import test from "node:test";

import { legacyBlocks } from "./legacy-blocks";

const mediaId = "6f0c7f0a-1a2b-4c3d-8e9f-0123456789ab";

test("quita imágenes y videos del payload v2", () => {
  const blocks = legacyBlocks([
    { type: "p", text: "Hola" },
    {
      type: "image",
      mediaId,
      src: `/api/media/${mediaId}`,
      mime: "image/webp",
      width: 10,
      height: 10,
      alt: "x",
    },
    { type: "video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Clase" },
  ]);

  assert.deepEqual(blocks, [{ type: "p", text: "Hola" }]);
});
