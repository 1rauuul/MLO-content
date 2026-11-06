import { hashText } from "./hash";
import {
  buildAuthorizedCourseList,
  buildEmptyV3Release,
  type CourseCandidate,
  type CourseListResponse,
} from "./v3";
import type { ReleaseV3 } from "./contract-v3";

const PUBLISHED_AT = "2026-11-06T00:00:00.000Z";

/**
 * Entradas fijas de los fixtures x02. Se usan tanto para generarlos como para
 * comprobar su paridad en las pruebas.
 */
export function buildX02Fixtures(): {
  manifest: ReleaseV3;
  courseList: CourseListResponse;
} {
  const manifest = buildEmptyV3Release({
    catalogId: "demo",
    courseId: "course-empty",
    version: 1,
    publishedAt: PUBLISHED_AT,
    title: "Curso vacío (demo)",
    baseRef: null,
  });

  const candidates: CourseCandidate[] = [
    {
      catalogId: "base",
      title: "Ingeniería de Software",
      status: "published",
      usesBase: false,
      isBase: true,
      hasAccess: true,
      version: 7,
      hash: hashText("x02-base-v7"),
      publishedAt: "2026-11-05T00:00:00.000Z",
      empty: false,
    },
    {
      catalogId: "demo",
      title: "Curso vacío (demo)",
      status: "published",
      usesBase: false,
      isBase: false,
      hasAccess: true,
      version: 1,
      hash: manifest.hash,
      publishedAt: PUBLISHED_AT,
      empty: true,
    },
  ];

  return { manifest, courseList: buildAuthorizedCourseList(candidates, true) };
}
