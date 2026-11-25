import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { logoutStudent } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store" };

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  await logoutStudent(request);
  return new Response(null, { status: 204, headers: NO_STORE });
}
