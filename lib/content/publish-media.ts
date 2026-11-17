import type { ContentBlock } from "@/lib/content";
import { signedMediaUrl } from "@/lib/media/signing";

/** Cambia la ruta interna de la imagen por la URL firmada que verá MLO. */
export function publishMediaBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block) =>
    block.type === "image"
      ? { ...block, src: signedMediaUrl(block.mediaId) }
      : block,
  );
}
