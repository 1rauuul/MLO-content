import { corsPreflight, CORS_HEADERS } from "@/lib/api/cors";
import { isStudentKey, normalizeJoinCode } from "@/lib/classes";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type GroupRelease = {
  kind?: string;
  group?: { visibility?: string };
};

function notFound() {
  return Response.json(
    { error: "not_found", message: "Grupo no disponible." },
    { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  );
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const studentKey = (request.headers.get("x-mlo-student-key") ?? "").trim();
  if (!isStudentKey(studentKey)) {
    return Response.json(
      { error: "invalid", message: "Falta la identidad estable del alumno." },
      { status: 400, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  const { code } = await params;
  const [row] = await db()<{ snapshot: { release?: GroupRelease } | null }[]>`
    select r.snapshot
      from class_releases_v3 r
      join classes c on c.id = r.class_id
      join class_members m on m.class_id = c.id and m.active
      join students s on s.id = m.student_id
     where c.join_code = ${normalizeJoinCode(code)}
       and c.archived_at is null
       and s.external_key = ${studentKey}
     order by r.version desc
     limit 1`;

  const release = row?.snapshot?.release;
  if (!release || release.kind !== "group") return notFound();
  if (release.group?.visibility !== "published") return notFound();

  return Response.json(release, {
    headers: { ...CORS_HEADERS, "Cache-Control": "private, max-age=0, no-store" },
  });
}
