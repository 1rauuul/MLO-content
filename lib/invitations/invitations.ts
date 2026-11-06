import { isUniqueViolation } from "../content/x03";
import { db } from "../db";
import {
  runInvitationClaim,
  type ClaimAdapter,
  type ClaimResult,
  type ClaimStore,
  type ClaimSubject,
  type ClaimSuccess,
} from "./claim";
import {
  buildInvitationLink,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  invitationStatus,
  isInvitationToken,
  normalizeInvitationEmail,
  INVITATION_MAX_ATTEMPTS,
  type InvitationStatus,
} from "./core";

export type CreatedInvitation = {
  id: string;
  email: string;
  expiresAt: Date;
  token: string;
  link: string;
};

export type InvitationListItem = {
  id: string;
  email: string;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  attempt_count: number;
  status: InvitationStatus;
};

export type ClaimedMembership = {
  studentId: string;
  classId: string;
  classCode: string;
  className: string;
  teacherName: string;
  courseId: string;
  courseCatalogId: string;
  joinedAt: Date;
  published: { version: number; hash: string; publishedAt: string } | null;
};

export type CreateInvitationResult =
  | { ok: true; invitation: CreatedInvitation }
  | { ok: false; error: "invalid_email" | "not_found" };

export async function createInvitation(input: {
  classId: string;
  email: string;
  createdBy: string;
}): Promise<CreateInvitationResult> {
  const email = normalizeInvitationEmail(input.email);
  if (!email) return { ok: false, error: "invalid_email" };

  return db().begin(async (tx) => {
    const [klass] = await tx<{ course_id: string }[]>`
      select course_id from classes where id = ${input.classId} limit 1`;
    if (!klass) return { ok: false as const, error: "not_found" as const };

    const token = generateInvitationToken();
    const expiresAt = invitationExpiresAt();
    const [row] = await tx<{ id: string; expires_at: Date }[]>`
      insert into class_invitations
        (class_id, course_id, email, token_hash, expires_at, created_by)
      values
        (${input.classId}, ${klass.course_id}, ${email},
         ${hashInvitationToken(token)}, ${expiresAt.toISOString()}, ${input.createdBy})
      returning id, expires_at`;

    return {
      ok: true as const,
      invitation: {
        id: row.id,
        email,
        expiresAt: row.expires_at,
        token,
        link: buildInvitationLink(token),
      },
    };
  });
}

export async function listInvitations(
  classId: string,
): Promise<InvitationListItem[]> {
  const now = new Date();
  const rows = await db()<
    {
      id: string;
      email: string;
      created_at: Date;
      expires_at: Date;
      used_at: Date | null;
      revoked_at: Date | null;
      attempt_count: number;
    }[]
  >`
    select id, email, created_at, expires_at, used_at, revoked_at, attempt_count
      from class_invitations
     where class_id = ${classId}
     order by created_at desc`;

  return rows.map((row) => ({
    ...row,
    status: invitationStatus(row, now),
  }));
}

export async function revokeInvitation(
  classId: string,
  invitationId: string,
): Promise<boolean> {
  const rows = await db()`
    update class_invitations
       set revoked_at = now(), updated_at = now()
     where id = ${invitationId}
       and class_id = ${classId}
       and used_at is null
       and revoked_at is null
    returning id`;
  return rows.length > 0;
}

/** Adaptador real: una transacción con bloqueo de invitación y clase. */
function postgresClaimAdapter(): ClaimAdapter {
  return {
    transaction<T>(work: (store: ClaimStore) => Promise<T>): Promise<T> {
      return db().begin((tx) => {
        const store: ClaimStore = {
          async lockInvitation(tokenHash) {
            const [row] = await tx<
              {
                id: string;
                class_id: string;
                course_id: string;
                expires_at: Date;
                used_at: Date | null;
                revoked_at: Date | null;
                attempt_count: number;
              }[]
            >`
              select id, class_id, course_id, expires_at, used_at, revoked_at, attempt_count
                from class_invitations
               where token_hash = ${tokenHash}
               for update`;
            return row ?? null;
          },

          async lockClass(classId) {
            const [row] = await tx<
              {
                id: string;
                course_id: string;
                capacity: number | null;
                archived_at: Date | null;
              }[]
            >`
              select id, course_id, capacity, archived_at
                from classes
               where id = ${classId}
               for update`;
            return row ?? null;
          },

          async countAttempt(invitationId) {
            await tx`
              update class_invitations
                 set attempt_count = least(attempt_count + 1, ${INVITATION_MAX_ATTEMPTS}),
                     updated_at = now()
               where id = ${invitationId}`;
          },

          async membership(studentKey, classId, courseId) {
            const [row] = await tx<{ here: boolean; in_course: boolean }[]>`
              select
                exists(
                  select 1
                    from class_members m
                    join students s on s.id = m.student_id
                   where s.external_key = ${studentKey}
                     and m.class_id = ${classId}
                     and m.active
                ) as here,
                exists(
                  select 1
                    from class_members m
                    join students s on s.id = m.student_id
                   where s.external_key = ${studentKey}
                     and m.course_id = ${courseId}
                     and m.active
                ) as in_course`;
            return {
              here: row?.here ?? false,
              inCourse: row?.in_course ?? false,
            };
          },

          async countActiveMembers(classId) {
            const [row] = await tx<{ count: number }[]>`
              select count(*)::int as count
                from class_members
               where class_id = ${classId} and active`;
            return row?.count ?? 0;
          },

          async upsertStudent(studentKey, studentName) {
            const [row] = await tx<{ id: string }[]>`
              insert into students (external_key, name)
              values (${studentKey}, ${studentName})
              on conflict (external_key) do update
                set name = excluded.name, updated_at = now()
              returning id`;
            return row.id;
          },

          async joinClass(studentId, classId, courseId) {
            await tx`
              insert into class_members (class_id, student_id, course_id, active)
              values (${classId}, ${studentId}, ${courseId}, true)
              on conflict (class_id, student_id) do update
                set active = true,
                    course_id = excluded.course_id,
                    joined_at = now()`;
          },

          async grantBaseAccess(studentId) {
            const [base] = await tx<{ id: string }[]>`
              select id from courses where is_base limit 1`;
            if (!base) return;
            await tx`
              insert into course_access (course_id, student_id)
              values (${base.id}, ${studentId})
              on conflict (course_id, student_id) do nothing`;
          },

          async consume(invitationId) {
            await tx`
              update class_invitations
                 set used_at = now(), updated_at = now()
               where id = ${invitationId}
                 and used_at is null
                 and revoked_at is null`;
          },
        };

        return work(store);
      }) as Promise<T>;
    },
  };
}

/**
 * Consume una invitación una sola vez. `adapter` existe para pruebas con una
 * transacción en memoria; la API siempre usa PostgreSQL.
 */
export async function claimInvitation(
  token: string,
  subject: ClaimSubject,
  options: { adapter?: ClaimAdapter; now?: Date } = {},
): Promise<ClaimResult> {
  if (!isInvitationToken(token)) return { ok: false, error: "invalid" };

  const adapter = options.adapter ?? postgresClaimAdapter();
  try {
    return await adapter.transaction((store) =>
      runInvitationClaim(store, hashInvitationToken(token), subject, options.now),
    );
  } catch (error) {
    // Carrera entre dos reclamos del mismo curso: el índice único decide y la
    // transacción ya revirtió, incluido el consumo de la invitación.
    if (isUniqueViolation(error)) return { ok: false, error: "already_member" };
    throw error;
  }
}

export async function describeClaimedMembership(
  membership: ClaimSuccess,
): Promise<ClaimedMembership | null> {
  const [row] = await db()<
    {
      class_id: string;
      class_name: string;
      join_code: string;
      course_id: string;
      course_catalog_id: string;
      teacher_name: string;
      joined_at: Date;
      published_version: number | null;
      published_hash: string | null;
      published_at: Date | null;
    }[]
  >`
    select c.id as class_id, c.name as class_name, c.join_code, c.course_id,
           parent.key as course_catalog_id,
           t.name as teacher_name, m.joined_at,
           r.version as published_version,
           r.content_hash as published_hash,
           r.published_at
      from classes c
      join courses parent on parent.id = c.course_id
      join teachers t on t.id = c.teacher_id
      join class_members m
        on m.class_id = c.id and m.student_id = ${membership.studentId}
      left join lateral (
        select version, content_hash, published_at
          from class_releases
         where class_id = c.id
         order by version desc
         limit 1
      ) r on true
     where c.id = ${membership.classId}
     limit 1`;

  if (!row) return null;

  return {
    studentId: membership.studentId,
    classId: row.class_id,
    classCode: row.join_code,
    className: row.class_name,
    teacherName: row.teacher_name,
    courseId: row.course_id,
    courseCatalogId: row.course_catalog_id,
    joinedAt: row.joined_at,
    published:
      row.published_version === null || row.published_hash === null
        ? null
        : {
            version: row.published_version,
            hash: row.published_hash,
            publishedAt: new Date(row.published_at ?? Date.now()).toISOString(),
          },
  };
}
