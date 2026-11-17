import assert from "node:assert/strict";
import test from "node:test";

import { publishMediaBlocks } from "./publish-media";

process.env.MEDIA_SECRET = "test-secret";
process.env.APP_BASE_URL = "https://cms.test";

const mediaId = "6f0c7f0a-1a2b-4c3d-8e9f-0123456789ab";

test("publica la imagen con URL absoluta firmada", () => {
  const blocks = publishMediaBlocks([
    {
      type: "image",
      mediaId,
      src: `/api/media/${mediaId}`,
      mime: "image/webp",
      width: 10,
      height: 10,
      alt: "x",
    },
    { type: "p", text: "Hola" },
    { type: "video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Clase" },
  ]);

  assert.equal(blocks[0].type, "image");
  assert.match(
    (blocks[0] as { src: string }).src,
    /^https:\/\/cms\.test\/api\/media\/[0-9a-f-]+\?sig=/,
  );
  assert.deepEqual(blocks[1], { type: "p", text: "Hola" });
  assert.equal(blocks[2].type, "video");
});

test("falla con un mensaje claro si falta MEDIA_SECRET", () => {
  const secret = process.env.MEDIA_SECRET;
  delete process.env.MEDIA_SECRET;
  try {
    assert.throws(
      () =>
        publishMediaBlocks([
          {
            type: "image",
            mediaId,
            src: `/api/media/${mediaId}`,
            mime: "image/webp",
            width: 10,
            height: 10,
            alt: "x",
          },
        ]),
      /MEDIA_SECRET/,
    );
  } finally {
    process.env.MEDIA_SECRET = secret;
  }
});
