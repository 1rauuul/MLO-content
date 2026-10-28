export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
