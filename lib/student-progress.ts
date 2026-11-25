import { db } from "./db";

const MAX_PROGRESS_BYTES = 2_000_000;

/** El pooler puede devolver jsonb como texto; el cliente espera un objeto. */
export function parseStoredProgress(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

/** El respaldo v5 de MLO; el cliente lo valida completo al descargarlo. */
export function isProgressPayload(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { version?: unknown }).version === 5
  );
}

export function progressPayloadTooLarge(value: unknown): boolean {
  return JSON.stringify(value).length > MAX_PROGRESS_BYTES;
}

export async function getStudentProgress(
  studentKey: string,
): Promise<{ progress: unknown; updatedAt: string } | null> {
  const [row] = await db()<{ payload: unknown; updated_at: Date }[]>`
    select p.payload, p.updated_at
      from student_progress p
      join students s on s.id = p.student_id
     where s.external_key = ${studentKey}
     limit 1`;

  if (!row) return null;
  return {
    progress: parseStoredProgress(row.payload),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function putStudentProgress(
  studentKey: string,
  studentName: string,
  progress: unknown,
): Promise<string> {
  const [student] = await db()<{ id: string }[]>`
    insert into students (external_key, name)
    values (${studentKey}, ${studentName})
    on conflict (external_key) do update
      set name = excluded.name, updated_at = now()
    returning id`;

  const [row] = await db()<{ updated_at: Date }[]>`
    insert into student_progress (student_id, payload, updated_at)
    values (${student.id}, ${JSON.stringify(progress)}::jsonb, now())
    on conflict (student_id) do update
      set payload = excluded.payload, updated_at = excluded.updated_at
    returning updated_at`;

  return row.updated_at.toISOString();
}
