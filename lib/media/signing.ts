import { createHmac, timingSafeEqual } from "node:crypto";

function mediaSecret(): string {
  const secret = process.env.MEDIA_SECRET?.trim();
  if (!secret) throw new Error("Falta MEDIA_SECRET para firmar las imágenes.");
  return secret;
}

export function appBaseUrl(): string {
  const value = process.env.APP_BASE_URL?.trim();
  if (value) return value.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("Falta APP_BASE_URL para publicar imágenes.");
}

export function signMediaId(id: string): string {
  return createHmac("sha256", mediaSecret()).update(id).digest("base64url");
}

export function verifyMediaSignature(id: string, signature: string): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signMediaId(id));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function signedMediaUrl(id: string): string {
  return `${appBaseUrl()}/api/media/${id}?sig=${signMediaId(id)}`;
}
