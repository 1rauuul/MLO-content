"use server";

import { revalidatePath } from "next/cache";

import { requireEditableCourse } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseReferenceInput } from "@/lib/content/validate";

export type ReferenceResult = { error?: string; ok?: boolean };

const KINDS = ["lesson", "evaluation", "question", "exercise", "example"] as const;
type Kind = (typeof KINDS)[number];

function formJson(formData: FormData): unknown {
  try {
    return JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return null;
  }
}

function refresh(courseId: string): void {
  revalidatePath(`/cursos/${courseId}`);
  revalidatePath(`/cursos/${courseId}/referencias`);
}

function nextReferenceId(ids: string[]): string {
  let next = 1;
  for (const id of ids) {
    const match = /^ref-(\d+)$/.exec(id);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  return `ref-${next}`;
}

async function elementId(
  kind: Kind,
  contentId: string,
  courseId: string,
): Promise<string | null> {
  const sql = db();
  const rows =
    kind === "lesson"
      ? await sql<{ id: string }[]>`
          select id from lessons
           where content_id = ${contentId} and course_id = ${courseId}
             and archived_at is null limit 1`
      : kind === "evaluation"
        ? await sql<{ id: string }[]>`
            select id from evaluations
             where content_id = ${contentId} and course_id = ${courseId}
               and archived_at is null limit 1`
        : kind === "question"
          ? await sql<{ id: string }[]>`
              select q.id
                from questions q
                join evaluations e on e.id = q.evaluation_id
               where q.content_id = ${contentId} and q.course_id = ${courseId}
                 and q.archived_at is null and e.archived_at is null limit 1`
          : kind === "exercise"
            ? await sql<{ id: string }[]>`
                select id from exercises
                 where content_id = ${contentId} and course_id = ${courseId}
                   and archived_at is null limit 1`
            : await sql<{ id: string }[]>`
                select id from examples
                 where content_id = ${contentId} and course_id = ${courseId}
                   and archived_at is null limit 1`;
  return rows[0]?.id ?? null;
}

export async function saveReference(
  _prev: ReferenceResult,
  formData: FormData,
): Promise<ReferenceResult> {
  const teacher = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  const course = await requireEditableCourse(teacher, courseId);

  const parsed = parseReferenceInput(formJson(formData));
  if ("error" in parsed) return { error: parsed.error };

  const sql = db();
  const referenceId = String(formData.get("referenceId") ?? "");
  const input = parsed.value;

  if (referenceId) {
    const rows = await sql<{ id: string }[]>`
      select id from content_references
       where content_id = ${referenceId} and course_id = ${course.id}
       limit 1`;
    if (!rows[0]) return { error: "La referencia no existe en este curso." };

    await sql`
      update content_references
         set authors = ${sql.json(input.authors)},
             year = ${input.year},
             title = ${input.title},
             source = ${input.source},
             edition = ${input.edition},
             doi = ${input.doi},
             url = ${input.url}
       where id = ${rows[0].id}`;
  } else {
    const ids = await sql<{ content_id: string }[]>`
      select content_id from content_references where course_id = ${course.id}`;
    await sql`
      insert into content_references
        (course_id, content_id, authors, year, title, source, edition, doi, url)
      values
        (${course.id}, ${nextReferenceId(ids.map((row) => row.content_id))},
         ${sql.json(input.authors)}, ${input.year}, ${input.title}, ${input.source},
         ${input.edition}, ${input.doi}, ${input.url})`;
  }

  refresh(course.id);
  return { ok: true };
}

export async function deleteReference(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const course = await requireEditableCourse(
    teacher,
    String(formData.get("courseId") ?? ""),
  );
  const referenceId = String(formData.get("referenceId") ?? "");

  await db()`
    delete from content_references
     where content_id = ${referenceId} and course_id = ${course.id}`;
  refresh(course.id);
}

export async function setElementReferences(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const course = await requireEditableCourse(
    teacher,
    String(formData.get("courseId") ?? ""),
  );
  const kind = String(formData.get("kind") ?? "") as Kind;
  if (!KINDS.includes(kind)) return;

  const elementContentId = String(formData.get("elementContentId") ?? "");
  const targetId = await elementId(kind, elementContentId, course.id);
  if (!targetId) return;

  const requested = [
    ...new Set(formData.getAll("referenceIds").map(String).filter(Boolean)),
  ];
  const sql = db();
  const available = requested.length
    ? await sql<{ id: string }[]>`
        select id from content_references
         where course_id = ${course.id}
           and content_id in ${sql(requested)}
           and archived_at is null`
    : [];
  if (available.length !== requested.length) return;

  await sql.begin(async (tx) => {
    if (kind === "lesson") {
      await tx`delete from lesson_references where lesson_id = ${targetId}`;
      for (const reference of available) {
        await tx`insert into lesson_references (lesson_id, reference_id)
                 values (${targetId}, ${reference.id})`;
      }
    } else if (kind === "evaluation") {
      await tx`delete from evaluation_references where evaluation_id = ${targetId}`;
      for (const reference of available) {
        await tx`insert into evaluation_references (evaluation_id, reference_id)
                 values (${targetId}, ${reference.id})`;
      }
    } else if (kind === "question") {
      await tx`delete from question_references where question_id = ${targetId}`;
      for (const reference of available) {
        await tx`insert into question_references (question_id, reference_id)
                 values (${targetId}, ${reference.id})`;
      }
    } else if (kind === "exercise") {
      await tx`delete from exercise_references where exercise_id = ${targetId}`;
      for (const reference of available) {
        await tx`insert into exercise_references (exercise_id, reference_id)
                 values (${targetId}, ${reference.id})`;
      }
    } else {
      await tx`delete from example_references where example_id = ${targetId}`;
      for (const reference of available) {
        await tx`insert into example_references (example_id, reference_id)
                 values (${targetId}, ${reference.id})`;
      }
    }
  });

  refresh(course.id);
}
