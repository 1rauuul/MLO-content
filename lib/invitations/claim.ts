import { invitationClaimError, type InvitationError, type InvitationState } from "./core";

export type ClaimInvitation = InvitationState & {
  id: string;
  class_id: string;
  course_id: string;
};

export type ClaimClass = {
  id: string;
  course_id: string;
  capacity: number | null;
  archived_at: Date | null;
};

export type ClaimMembership = {
  here: boolean;
  inCourse: boolean;
};

/**
 * Operaciones que el reclamo ejecuta dentro de una transacción. El adaptador
 * de PostgreSQL bloquea la invitación y la clase con `for update`.
 */
export type ClaimStore = {
  lockInvitation(tokenHash: string): Promise<ClaimInvitation | null>;
  lockClass(classId: string): Promise<ClaimClass | null>;
  countAttempt(invitationId: string): Promise<void>;
  membership(
    studentKey: string,
    classId: string,
    courseId: string,
  ): Promise<ClaimMembership>;
  countActiveMembers(classId: string): Promise<number>;
  upsertStudent(studentKey: string, studentName: string): Promise<string>;
  joinClass(studentId: string, classId: string, courseId: string): Promise<void>;
  grantCourseAccess(studentId: string, courseId: string): Promise<void>;
  consume(invitationId: string): Promise<void>;
};

export type ClaimAdapter = {
  transaction<T>(work: (store: ClaimStore) => Promise<T>): Promise<T>;
};

export type ClaimSuccess = {
  studentId: string;
  classId: string;
  courseId: string;
};

export type ClaimResult =
  | { ok: true; membership: ClaimSuccess }
  | { ok: false; error: InvitationError };

export type ClaimSubject = {
  studentKey: string;
  studentName: string;
};

/**
 * Reclamo atómico: bloquea, valida, crea/reactiva la membresía y marca
 * `used_at` dentro de la misma transacción. Un fallo no consume la invitación.
 */
export async function runInvitationClaim(
  store: ClaimStore,
  tokenHash: string,
  subject: ClaimSubject,
  now: Date = new Date(),
): Promise<ClaimResult> {
  const invitation = await store.lockInvitation(tokenHash);
  if (!invitation) return { ok: false, error: "invalid" };

  const klass = await store.lockClass(invitation.class_id);
  if (!klass) {
    await store.countAttempt(invitation.id);
    return { ok: false, error: "invalid" };
  }

  const membership = await store.membership(
    subject.studentKey,
    klass.id,
    klass.course_id,
  );
  const activeMembers = await store.countActiveMembers(klass.id);
  const error = invitationClaimError(invitation, {
    archived: klass.archived_at !== null,
    capacity: klass.capacity,
    activeMembers,
    alreadyMember: membership.here || membership.inCourse,
    now,
  });
  if (error) {
    // Solo los errores del token son intentos fallidos. Cupo lleno o membresía
    // duplicada dependen del grupo y deben poder reintentarse sin agotar el
    // límite de la invitación.
    if (error !== "full" && error !== "already_member") {
      await store.countAttempt(invitation.id);
    }
    return { ok: false, error };
  }

  const studentId = await store.upsertStudent(
    subject.studentKey,
    subject.studentName,
  );
  await store.joinClass(studentId, klass.id, klass.course_id);
  await store.grantCourseAccess(studentId, klass.course_id);
  await store.consume(invitation.id);

  return {
    ok: true,
    membership: { studentId, classId: klass.id, courseId: klass.course_id },
  };
}
