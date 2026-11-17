import type { ContentBlock } from "@/lib/content";

/** El contrato v2 no conoce imágenes ni video; los clientes antiguos fallan. */
export function legacyBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.filter((block) => block.type !== "image" && block.type !== "video");
}
