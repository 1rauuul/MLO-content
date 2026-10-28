import { createHash } from "node:crypto";

/**
 * JSON estable: ordena las claves de los objetos para que el mismo contenido
 * produzca siempre el mismo hash. Los arreglos conservan su orden.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashValue(value: unknown): string {
  return hashText(canonicalJson(value));
}
