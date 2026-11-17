import assert from "node:assert/strict";
import test from "node:test";

import { youtubeThumbnail, youtubeVideoId, youtubeWatchUrl } from "./media";

test("extrae el id de YouTube de sus cuatro formatos", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ]) {
    assert.equal(youtubeVideoId(url), "dQw4w9WgXcQ");
  }
  assert.equal(youtubeVideoId("https://vimeo.com/123"), null);
  assert.equal(youtubeVideoId("no es una url"), null);
});

test("construye la URL canónica y la miniatura", () => {
  assert.equal(youtubeWatchUrl("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(
    youtubeThumbnail("dQw4w9WgXcQ"),
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  );
});
