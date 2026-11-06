import type { ReleaseV3 } from "./contract-v3";
import { hashValue } from "./hash";

export type CourseStatus = "draft" | "published" | "unpublished";

export type BaseRef = {
  catalogId: string;
  version: number;
  hash: string;
};

export type LatestRelease = {
  version: number;
  hash: string;
};

/** DEC-02: el baseRef solo existe si el curso declara uso del contenido base. */
export function resolveBaseRef(
  usesBase: boolean,
  latestBaseRelease: LatestRelease | null,
): BaseRef | null {
  if (!usesBase) return null;
  if (!latestBaseRelease) {
    throw new Error("El contenido base no tiene una release v2 publicada.");
  }
  return {
    catalogId: "base",
    version: latestBaseRelease.version,
    hash: latestBaseRelease.hash,
  };
}

/** Una sola secuencia de versiones para v2 y v3 del mismo curso. */
export function nextReleaseVersion(
  latestV2: number | null,
  latestV3: number | null,
): number {
  return Math.max(latestV2 ?? 0, latestV3 ?? 0) + 1;
}

/** El base solo entra en la composición v2 cuando el curso lo declara. */
export function sourceCourseIds(
  usesBase: boolean,
  baseId: string | null,
  courseId: string,
): string[] {
  return usesBase && baseId && baseId !== courseId ? [baseId, courseId] : [courseId];
}

export type EmptyReleaseInput = {
  catalogId: string;
  courseId: string;
  version: number;
  publishedAt: string;
  title: string;
  baseRef: BaseRef | null;
};

/**
 * X-02 publica metadatos v3 sin jerarquía real: las colecciones van vacías
 * hasta X-03. El hash cubre el documento completo con la canonicalización v3.
 */
export function buildEmptyV3Release(input: EmptyReleaseInput): ReleaseV3 {
  const content = {
    schemaVersion: 3 as const,
    kind: "course" as const,
    catalogId: input.catalogId,
    courseId: input.courseId,
    releaseId: `${input.catalogId}-${input.version}`,
    version: input.version,
    publishedAt: input.publishedAt,
    baseRef: input.baseRef,
    course: {
      title: input.title,
      description: "",
      visibility: "published" as const,
    },
    units: [],
    topics: [],
    lessons: [],
    evaluations: [],
    questions: [],
    exercises: [],
    examples: [],
    references: [],
    notices: [],
  };

  return { ...content, hash: hashValue(content) };
}

export type CourseListEntry = {
  catalogId: string;
  title: string;
  status: "published";
  usesBase: boolean;
  version: number;
  hash: string;
  publishedAt: string;
  empty: boolean;
};

export type CourseListResponse = {
  schemaVersion: 3;
  courses: CourseListEntry[];
};

export type CourseCandidate = {
  catalogId: string;
  title: string;
  status: CourseStatus;
  usesBase: boolean;
  isBase: boolean;
  hasAccess: boolean;
  version: number | null;
  hash: string | null;
  publishedAt: string | null;
  empty: boolean;
};

export function canAccessCourse(input: {
  isBase: boolean;
  status: CourseStatus;
  hasGrant: boolean;
  accessControlOn: boolean;
}): boolean {
  if (input.status !== "published") return false;
  // El flag de piloto solo permite el base empaquetado; nunca cursos adicionales.
  if (input.isBase && !input.accessControlOn) return true;
  return input.hasGrant;
}

export function accessControlEnabled(value: string | undefined): boolean {
  return value === "on";
}

/**
 * v2 sigue sirviendo el base sin cabecera. Cualquier otro catálogo exige
 * identidad válida, curso publicado y concesión explícita.
 */
export function canAccessV2Catalog(input: {
  catalogId: string;
  status: CourseStatus;
  hasGrant: boolean;
  hasValidStudentKey: boolean;
}): boolean {
  if (input.catalogId === "base") return true;
  return input.hasValidStudentKey && input.status === "published" && input.hasGrant;
}

export function computeEmpty(input: {
  isBase: boolean;
  usesBase: boolean;
  ownLessons: number;
  baseLessons: number;
}): boolean {
  if (input.isBase) return input.ownLessons === 0;
  return input.ownLessons === 0 && (!input.usesBase || input.baseLessons === 0);
}

export function buildAuthorizedCourseList(
  candidates: CourseCandidate[],
  accessControlOn: boolean,
): CourseListResponse {
  const courses: CourseListEntry[] = [];

  for (const candidate of candidates) {
    if (candidate.version === null || candidate.hash === null || candidate.publishedAt === null) {
      continue;
    }
    if (
      !canAccessCourse({
        isBase: candidate.isBase,
        status: candidate.status,
        hasGrant: candidate.hasAccess,
        accessControlOn,
      })
    ) {
      continue;
    }
    courses.push({
      catalogId: candidate.catalogId,
      title: candidate.title,
      status: "published",
      usesBase: candidate.usesBase,
      version: candidate.version,
      hash: candidate.hash,
      publishedAt: candidate.publishedAt,
      empty: candidate.empty,
    });
  }

  return { schemaVersion: 3, courses };
}
