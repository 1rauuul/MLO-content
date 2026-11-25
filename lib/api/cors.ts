/**
 * Sin origen configurado solo se abre `*` en desarrollo; en producción las
 * peticiones del navegador quedan limitadas al mismo origen.
 */
export function corsAllowedOrigin(
  configured: string | undefined,
  production: boolean,
): string | null {
  const origin = configured?.trim();
  if (origin) return origin;
  return production ? null : "*";
}

const ALLOWED_ORIGIN = corsAllowedOrigin(
  process.env.CORS_ALLOWED_ORIGIN,
  process.env.NODE_ENV === "production",
);

export const CORS_HEADERS = {
  ...(ALLOWED_ORIGIN ? { "Access-Control-Allow-Origin": ALLOWED_ORIGIN } : {}),
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-MLO-Student-Key, Authorization",
  Vary: "Origin",
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
