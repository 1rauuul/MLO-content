import { db } from "./db";

export type CourseAccessRow = {
  student_id: string;
  name: string;
  external_key: string;
  granted_at: Date;
};

export async function listCourseAccess(courseId: string): Promise<CourseAccessRow[]> {
  return db()<CourseAccessRow[]>`
    select s.id as student_id, s.name, s.external_key, ca.granted_at
      from course_access ca
      join students s on s.id = ca.student_id
     where ca.course_id = ${courseId}
     order by s.name, s.external_key`;
}
