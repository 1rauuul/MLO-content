import { db } from "../db";
import { isStudentKey } from "../classes";
import type { ReleaseV3 } from "./contract-v3";
import {
  buildAuthorizedCourseList,
  canAccessCourse,
  canAccessV2Catalog,
  computeEmpty,
  type CourseCandidate,
  type CourseListResponse,
  type CourseStatus,
} from "./v3";

type CourseRow = {
  key: string;
  title: string;
  status: string;
  uses_base: boolean;
  is_base: boolean;
  own_lessons: number;
  base_lessons: number;
  has_grant: boolean;
  v3_version: number | null;
  v3_hash: string | null;
  v3_published_at: Date | null;
  v2_version: number | null;
  v2_hash: string | null;
  v2_published_at: Date | null;
};

function iso(value: Date | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

/**
 * Cursos publicados y autorizados para el alumno. El base puede caer a la
 * última release v2 como metadatos mientras no tenga v3.
 */
export async function listAuthorizedCourses(
  studentKey: string,
  accessControlOn: boolean,
): Promise<CourseListResponse> {
  const rows = await db()<CourseRow[]>`
    select c.key, c.title, c.status, c.uses_base, c.is_base,
           (select count(*)::int
              from lessons l
             where l.course_id = c.id and l.archived_at is null) as own_lessons,
           (select count(*)::int
              from lessons l
              join courses b on b.id = l.course_id and b.is_base
             where l.archived_at is null) as base_lessons,
           exists(
             select 1
               from course_access ca
               join students s on s.id = ca.student_id
              where ca.course_id = c.id
                and s.external_key = ${studentKey}
           ) as has_grant,
           v3.version as v3_version,
           v3.content_hash as v3_hash,
           v3.published_at as v3_published_at,
           v2.version as v2_version,
           v2.content_hash as v2_hash,
           v2.published_at as v2_published_at
      from courses c
      left join lateral (
        select version, content_hash, published_at
          from releases_v3
         where course_id = c.id
         order by version desc
         limit 1
      ) v3 on true
      left join lateral (
        select version, content_hash, published_at
          from releases
         where course_id = c.id
         order by version desc
         limit 1
      ) v2 on true
     where c.status = 'published'
       and c.archived_at is null
       and not c.is_group
     order by c.is_base desc, c.title`;

  const candidates: CourseCandidate[] = rows.map((row) => {
    const metadata =
      row.v3_version !== null
        ? {
            version: row.v3_version,
            hash: row.v3_hash,
            publishedAt: iso(row.v3_published_at),
          }
        : row.is_base && row.v2_version !== null
          ? {
              version: row.v2_version,
              hash: row.v2_hash,
              publishedAt: iso(row.v2_published_at),
            }
          : null;

    return {
      catalogId: row.key,
      title: row.title,
      status: row.status as CourseStatus,
      usesBase: row.uses_base,
      isBase: row.is_base,
      hasAccess: row.has_grant,
      version: metadata?.version ?? null,
      hash: metadata?.hash ?? null,
      publishedAt: metadata?.publishedAt ?? null,
      empty: computeEmpty({
        isBase: row.is_base,
        usesBase: row.uses_base,
        ownLessons: row.own_lessons,
        baseLessons: row.base_lessons,
      }),
    };
  });

  return buildAuthorizedCourseList(candidates, accessControlOn);
}

type ManifestRow = {
  is_base: boolean;
  status: string;
  has_grant: boolean;
  snapshot: { release?: ReleaseV3 } | null;
};

/** Manifiesto v3 autorizado. Devuelve null tanto si no existe como si no autoriza. */
export async function getAuthorizedManifest(
  catalogId: string,
  studentKey: string,
  accessControlOn: boolean,
): Promise<ReleaseV3 | null> {
  const rows = await db()<ManifestRow[]>`
    select c.is_base, c.status,
           exists(
             select 1
               from course_access ca
               join students s on s.id = ca.student_id
              where ca.course_id = c.id
                and s.external_key = ${studentKey}
           ) as has_grant,
           (
             select snapshot
               from releases_v3
              where course_id = c.id
              order by version desc
              limit 1
           ) as snapshot
      from courses c
     where c.key = ${catalogId}
       and c.archived_at is null
       and not c.is_group
     limit 1`;

  const row = rows[0];
  if (!row) return null;
  if (
    !canAccessCourse({
      isBase: row.is_base,
      status: row.status as CourseStatus,
      hasGrant: row.has_grant,
      accessControlOn,
    })
  ) {
    return null;
  }

  const release = row.snapshot?.release;
  if (!release || release.catalogId !== catalogId) return null;
  return release;
}

/**
 * Guard de las rutas v2 de catálogo. El base queda público sin cabecera; los
 * demás catálogos requieren identidad válida y concesión vigente.
 */
export async function hasV2CatalogAccess(
  catalogId: string,
  studentKey: string | null,
): Promise<boolean> {
  if (catalogId === "base") return true;

  const hasValidStudentKey = Boolean(studentKey && isStudentKey(studentKey));
  if (!hasValidStudentKey) return false;

  const [row] = await db()<
    { status: string; has_grant: boolean }[]
  >`
    select c.status,
           exists(
             select 1
               from course_access ca
               join students s on s.id = ca.student_id
              where ca.course_id = c.id
                and s.external_key = ${studentKey}
           ) as has_grant
      from courses c
     where c.key = ${catalogId}
       and c.archived_at is null
       and not c.is_group
     limit 1`;

  if (!row) return false;

  return canAccessV2Catalog({
    catalogId,
    status: row.status as CourseStatus,
    hasGrant: row.has_grant,
    hasValidStudentKey,
  });
}
