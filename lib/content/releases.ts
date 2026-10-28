import { db } from "@/lib/db";

import type { CatalogManifest } from "./compose";
import type { PublishedLessonPayload } from "./serialize";

export type ReleaseSnapshot = {
  manifest: CatalogManifest;
  lessons: Record<string, PublishedLessonPayload>;
};

export async function getLatestRelease(catalogId: string): Promise<ReleaseSnapshot | null> {
  const rows = await db()<{ snapshot: ReleaseSnapshot }[]>`
    select r.snapshot
      from releases r
      join courses c on c.id = r.course_id
     where c.key = ${catalogId}
     order by r.version desc
     limit 1`;
  return rows[0]?.snapshot ?? null;
}

export function manifestFrom(
  snapshot: ReleaseSnapshot | null,
  catalogId: string,
): CatalogManifest | null {
  if (!snapshot?.manifest || snapshot.manifest.catalogId !== catalogId) return null;
  return snapshot.manifest;
}

export function lessonFrom(
  snapshot: ReleaseSnapshot | null,
  catalogId: string,
  lessonId: string,
): PublishedLessonPayload | null {
  const manifest = manifestFrom(snapshot, catalogId);
  if (!manifest) return null;
  if (!manifest.lessons.some((entry) => entry.lessonId === lessonId)) return null;

  const lesson = snapshot?.lessons?.[lessonId];
  if (!lesson || lesson.lessonId !== lessonId || lesson.catalogId !== catalogId) {
    return null;
  }
  return lesson;
}
