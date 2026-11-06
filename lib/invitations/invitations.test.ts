import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  INVITATION_ERROR_STATUS,
  invitationErrorBody,
} from "./api";
import type {
  ClaimAdapter,
  ClaimClass,
  ClaimInvitation,
  ClaimStore,
} from "./claim";
import {
  INVITATION_MAX_ATTEMPTS,
  INVITATION_TTL_DAYS,
  buildInvitationLink,
  generateInvitationToken,
  hashInvitationToken,
  invitationClaimError,
  invitationExpiresAt,
  invitationStatus,
  isInvitationToken,
  normalizeInvitationEmail,
  type InvitationError,
  type InvitationState,
} from "./core";
import { sendInvitationEmail } from "./delivery";
import { claimInvitation } from "./invitations";

const NOW = new Date("2026-11-06T12:00:00.000Z");
const STUDENT_KEY = "11111111-1111-4111-8111-111111111111";
const OTHER_KEY = "22222222-2222-4222-8222-222222222222";
const DEFAULT_TOKEN = "a".repeat(43);

type MemoryMember = {
  studentKey: string;
  classId: string;
  courseId: string;
  active: boolean;
  joinedAt: Date;
};

type MemoryInvitation = ClaimInvitation & { token_hash: string };

type MemoryState = {
  invitations: Map<string, MemoryInvitation>;
  classes: Map<string, ClaimClass>;
  students: Map<string, string>;
  members: MemoryMember[];
};

function cloneState(state: MemoryState): MemoryState {
  return {
    invitations: new Map(
      [...state.invitations].map(([hash, row]) => [hash, { ...row }]),
    ),
    classes: new Map([...state.classes].map(([id, row]) => [id, { ...row }])),
    students: new Map(state.students),
    members: state.members.map((row) => ({ ...row })),
  };
}

function memoryStore(state: MemoryState): ClaimStore {
  return {
    async lockInvitation(tokenHash) {
      return state.invitations.get(tokenHash) ?? null;
    },
    async lockClass(classId) {
      return state.classes.get(classId) ?? null;
    },
    async countAttempt(invitationId) {
      for (const row of state.invitations.values()) {
        if (row.id === invitationId) {
          row.attempt_count = Math.min(
            row.attempt_count + 1,
            INVITATION_MAX_ATTEMPTS,
          );
        }
      }
    },
    async membership(studentKey, classId, courseId) {
      return {
        here: state.members.some(
          (row) =>
            row.active &&
            row.studentKey === studentKey &&
            row.classId === classId,
        ),
        inCourse: state.members.some(
          (row) =>
            row.active &&
            row.studentKey === studentKey &&
            row.courseId === courseId,
        ),
      };
    },
    async countActiveMembers(classId) {
      return state.members.filter(
        (row) => row.active && row.classId === classId,
      ).length;
    },
    async upsertStudent(studentKey) {
      const existing = state.students.get(studentKey);
      if (existing) return existing;
      const id = `student-${state.students.size + 1}`;
      state.students.set(studentKey, id);
      return id;
    },
    async joinClass(studentId, classId, courseId) {
      const studentKey = [...state.students].find(
        ([, id]) => id === studentId,
      )?.[0];
      if (!studentKey) return;
      const member = state.members.find(
        (row) => row.studentKey === studentKey && row.classId === classId,
      );
      if (member) {
        member.active = true;
        member.courseId = courseId;
        member.joinedAt = new Date();
        return;
      }
      state.members.push({
        studentKey,
        classId,
        courseId,
        active: true,
        joinedAt: new Date(),
      });
    },
    async grantBaseAccess() {},
    async consume(invitationId) {
      for (const row of state.invitations.values()) {
        if (row.id === invitationId) row.used_at = new Date();
      }
    },
  };
}

/** Transacción en memoria serializada, como los bloqueos `for update`. */
function memoryAdapter(initial: {
  classes: ClaimClass[];
  invitations: MemoryInvitation[];
  members?: MemoryMember[];
}) {
  let state: MemoryState = {
    invitations: new Map(
      initial.invitations.map((row) => [row.token_hash, { ...row }]),
    ),
    classes: new Map(initial.classes.map((row) => [row.id, { ...row }])),
    students: new Map(),
    members: (initial.members ?? []).map((row) => ({ ...row })),
  };
  let queue: Promise<unknown> = Promise.resolve();

  const adapter: ClaimAdapter & {
    state: () => MemoryState;
    setCapacity: (classId: string, capacity: number | null) => void;
  } = {
    transaction<T>(work: (store: ClaimStore) => Promise<T>): Promise<T> {
      const run = queue.then(async () => {
        const draft = cloneState(state);
        const result = await work(memoryStore(draft));
        state = draft;
        return result;
      });
      queue = run.catch(() => undefined);
      return run;
    },
    state: () => state,
    setCapacity: (classId, capacity) => {
      const klass = state.classes.get(classId);
      if (klass) klass.capacity = capacity;
    },
  };

  return adapter;
}

function makeInvitation(
  options: {
    token?: string;
    expiresAt?: Date;
    usedAt?: Date | null;
    revokedAt?: Date | null;
    attemptCount?: number;
    classId?: string;
    courseId?: string;
  } = {},
): MemoryInvitation {
  const token = options.token ?? DEFAULT_TOKEN;
  return {
    id: "inv-1",
    class_id: options.classId ?? "class-1",
    course_id: options.courseId ?? "course-1",
    expires_at:
      options.expiresAt ?? new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    used_at: options.usedAt ?? null,
    revoked_at: options.revokedAt ?? null,
    attempt_count: options.attemptCount ?? 0,
    token_hash: hashInvitationToken(token),
  };
}

function makeAdapter(
  options: {
    invitation?: MemoryInvitation;
    capacity?: number | null;
    archived?: boolean;
    members?: MemoryMember[];
  } = {},
) {
  const invitation = options.invitation ?? makeInvitation();
  return memoryAdapter({
    classes: [
      {
        id: invitation.class_id,
        course_id: invitation.course_id,
        capacity: options.capacity ?? null,
        archived_at: options.archived ? NOW : null,
      },
    ],
    invitations: [invitation],
    members: options.members ?? [],
  });
}

function member(
  studentKey: string,
  overrides: Partial<MemoryMember> = {},
): MemoryMember {
  return {
    studentKey,
    classId: "class-1",
    courseId: "course-1",
    active: true,
    joinedAt: NOW,
    ...overrides,
  };
}

function claim(
  adapter: ClaimAdapter,
  token = DEFAULT_TOKEN,
) {
  return claimInvitation(
    token,
    { studentKey: STUDENT_KEY, studentName: "Ana" },
    { adapter, now: NOW },
  );
}

function invitationState(
  overrides: Partial<InvitationState> = {},
): InvitationState {
  return {
    expires_at: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    used_at: null,
    revoked_at: null,
    attempt_count: 0,
    ...overrides,
  };
}

const CLAIM_CONTEXT = {
  archived: false,
  capacity: null,
  activeMembers: 0,
  alreadyMember: false,
  now: NOW,
};

test("genera tokens de 32 bytes en base64url y no repite", () => {
  const first = generateInvitationToken();
  const second = generateInvitationToken();

  assert.equal(first.length, 43);
  assert.ok(isInvitationToken(first));
  assert.ok(isInvitationToken(second));
  assert.notEqual(first, second);
});

test("el hash es SHA-256 estable y no contiene el token", () => {
  const token = generateInvitationToken();
  const hash = hashInvitationToken(token);

  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hashInvitationToken(token), hash);
  assert.ok(!hash.includes(token));
  assert.equal(
    buildInvitationLink(token),
    `mloingenieriasoftware://join-class?token=${token}`,
  );
});

test("acepta cualquier dominio y rechaza correos sin formato", () => {
  assert.equal(
    normalizeInvitationEmail("  Docente@Escuela.Edu.MX "),
    "docente@escuela.edu.mx",
  );
  assert.equal(
    normalizeInvitationEmail("alumno+tag@universidad.edu.ar"),
    "alumno+tag@universidad.edu.ar",
  );
  assert.equal(normalizeInvitationEmail("a@b.co"), "a@b.co");

  for (const invalid of [
    "sin-arroba",
    "a@",
    "@b.co",
    "a@b",
    "a b@c.co",
    "",
    `${"x".repeat(250)}@b.co`,
  ]) {
    assert.equal(normalizeInvitationEmail(invalid), null, invalid);
  }
});

test("la invitación vence a los tres días", () => {
  const expires = invitationExpiresAt(NOW);
  assert.equal(
    expires.getTime() - NOW.getTime(),
    INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  assert.equal(invitationStatus(invitationState({ expires_at: expires }), NOW), "pending");
  assert.equal(
    invitationStatus(invitationState({ expires_at: NOW }), NOW),
    "expired",
  );
});

test("el estado muestra usada, revocada, vencida o pendiente", () => {
  assert.equal(
    invitationStatus(invitationState({ used_at: NOW }), NOW),
    "used",
  );
  assert.equal(
    invitationStatus(invitationState({ revoked_at: NOW }), NOW),
    "revoked",
  );
  assert.equal(
    invitationStatus(
      invitationState({ expires_at: new Date(NOW.getTime() - 1) }),
      NOW,
    ),
    "expired",
  );
  assert.equal(invitationStatus(invitationState(), NOW), "pending");
});

test("el error del reclamo respeta el orden y el límite de intentos", () => {
  assert.equal(invitationClaimError(invitationState(), CLAIM_CONTEXT), null);
  assert.equal(
    invitationClaimError(invitationState({ used_at: NOW }), CLAIM_CONTEXT),
    "used",
  );
  assert.equal(
    invitationClaimError(invitationState({ revoked_at: NOW }), CLAIM_CONTEXT),
    "revoked",
  );
  assert.equal(
    invitationClaimError(
      invitationState({ expires_at: new Date(NOW.getTime() - 1) }),
      CLAIM_CONTEXT,
    ),
    "expired",
  );
  assert.equal(
    invitationClaimError(invitationState(), {
      ...CLAIM_CONTEXT,
      archived: true,
    }),
    "invalid",
  );
  assert.equal(
    invitationClaimError(invitationState(), {
      ...CLAIM_CONTEXT,
      alreadyMember: true,
    }),
    "already_member",
  );
  assert.equal(
    invitationClaimError(invitationState(), {
      ...CLAIM_CONTEXT,
      capacity: 2,
      activeMembers: 2,
    }),
    "full",
  );
  assert.equal(
    invitationClaimError(
      invitationState({ attempt_count: INVITATION_MAX_ATTEMPTS }),
      CLAIM_CONTEXT,
    ),
    "invalid",
  );
  assert.equal(
    invitationClaimError(
      invitationState({ attempt_count: INVITATION_MAX_ATTEMPTS, used_at: NOW }),
      CLAIM_CONTEXT,
    ),
    "invalid",
  );
});

test("reclama, crea la membresía y consume la invitación", async () => {
  const adapter = makeAdapter();
  const result = await claim(adapter);

  if (!result.ok) assert.fail(result.error);
  assert.equal(result.membership.classId, "class-1");
  assert.equal(result.membership.courseId, "course-1");

  const saved = adapter.state();
  const invitation = [...saved.invitations.values()][0];
  assert.ok(invitation.used_at);
  assert.equal(invitation.attempt_count, 0);
  assert.equal(saved.members.filter((row) => row.active).length, 1);
});

test("replay: el segundo reclamo devuelve used y no duplica", async () => {
  const adapter = makeAdapter();
  const first = await claim(adapter);
  const second = await claim(adapter);

  if (!first.ok) assert.fail(first.error);
  if (second.ok) assert.fail("el segundo reclamo no debe aceptarse");
  assert.equal(second.error, "used");

  const saved = adapter.state();
  assert.equal(saved.members.length, 1);
  assert.equal([...saved.invitations.values()][0].attempt_count, 1);
});

test("concurrencia: dos reclamos simultáneos producen una sola membresía", async () => {
  const adapter = makeAdapter();
  const results = await Promise.all([claim(adapter), claim(adapter)]);

  const accepted = results.filter((result) => result.ok);
  const rejected = results.filter((result) => !result.ok);
  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 1);
  if (!rejected[0].ok) assert.equal(rejected[0].error, "used");

  const saved = adapter.state();
  assert.equal(saved.members.length, 1);
  assert.ok([...saved.invitations.values()][0].used_at);
});

test("cupo lleno rechaza sin consumir ni agotar intentos", async () => {
  const adapter = makeAdapter({
    capacity: 1,
    members: [member(OTHER_KEY)],
  });
  const result = await claim(adapter);

  if (result.ok) assert.fail("el grupo está lleno");
  assert.equal(result.error, "full");

  const saved = adapter.state();
  const invitation = [...saved.invitations.values()][0];
  assert.equal(invitation.used_at, null);
  assert.equal(invitation.attempt_count, 0);
  assert.equal(saved.members.length, 1);
});

test("diez respuestas full no agotan la invitación al liberarse cupo", async () => {
  const adapter = makeAdapter({
    capacity: 1,
    members: [member(OTHER_KEY)],
  });

  for (let attempt = 0; attempt < INVITATION_MAX_ATTEMPTS; attempt += 1) {
    const result = await claim(adapter);
    if (result.ok) assert.fail("el grupo está lleno");
    assert.equal(result.error, "full");
  }

  const invitation = [...adapter.state().invitations.values()][0];
  assert.equal(invitation.attempt_count, 0);
  assert.equal(invitation.used_at, null);

  adapter.setCapacity("class-1", 2);
  const accepted = await claim(adapter);
  if (!accepted.ok) assert.fail(accepted.error);
  assert.ok([...adapter.state().invitations.values()][0].used_at);
  assert.equal(
    adapter.state().members.filter((row) => row.active).length,
    2,
  );
});

test("una invitación revocada devuelve revoked y no se consume", async () => {
  const adapter = makeAdapter({
    invitation: makeInvitation({
      revokedAt: new Date(NOW.getTime() - 1000),
    }),
  });
  const result = await claim(adapter);

  if (result.ok) assert.fail("la invitación está revocada");
  assert.equal(result.error, "revoked");
  assert.equal([...adapter.state().invitations.values()][0].used_at, null);
});

test("una invitación vencida devuelve expired en el límite exacto", async () => {
  const adapter = makeAdapter({
    invitation: makeInvitation({ expiresAt: NOW }),
  });
  const result = await claim(adapter);

  if (result.ok) assert.fail("la invitación está vencida");
  assert.equal(result.error, "expired");
});

test("una membresía activa del mismo curso devuelve already_member", async () => {
  const adapter = makeAdapter({
    members: [member(STUDENT_KEY, { classId: "class-2" })],
  });
  const result = await claim(adapter);

  if (result.ok) assert.fail("el alumno ya es miembro del curso");
  assert.equal(result.error, "already_member");
  assert.equal([...adapter.state().invitations.values()][0].used_at, null);
});

test("una membresía activa en la misma clase devuelve already_member", async () => {
  const adapter = makeAdapter({ members: [member(STUDENT_KEY)] });
  const result = await claim(adapter);

  if (result.ok) assert.fail("el alumno ya es miembro de la clase");
  assert.equal(result.error, "already_member");
});

test("already_member no consume intentos y permite reclamar después", async () => {
  const adapter = makeAdapter({ members: [member(STUDENT_KEY)] });

  for (let attempt = 0; attempt < INVITATION_MAX_ATTEMPTS + 1; attempt += 1) {
    const result = await claim(adapter);
    if (result.ok) assert.fail("el alumno ya es miembro de la clase");
    assert.equal(result.error, "already_member");
  }

  const saved = adapter.state();
  assert.equal([...saved.invitations.values()][0].attempt_count, 0);

  // El alumno deja la clase: la misma invitación sigue disponible.
  saved.members[0].active = false;
  const accepted = await claim(adapter);
  if (!accepted.ok) assert.fail(accepted.error);
  assert.ok([...adapter.state().invitations.values()][0].used_at);
});

test("un grupo archivado no se puede reclamar", async () => {
  const adapter = makeAdapter({ archived: true });
  const result = await claim(adapter);

  if (result.ok) assert.fail("el grupo está archivado");
  assert.equal(result.error, "invalid");
});

test("el límite de intentos corta con invalid sin revelar el estado", async () => {
  const adapter = makeAdapter({
    invitation: makeInvitation({
      expiresAt: new Date(NOW.getTime() - 1000),
    }),
  });

  for (let attempt = 0; attempt < INVITATION_MAX_ATTEMPTS; attempt += 1) {
    const result = await claim(adapter);
    if (result.ok) assert.fail("no debe aceptarse");
    assert.equal(result.error, "expired");
  }

  const blocked = await claim(adapter);
  if (blocked.ok) assert.fail("no debe aceptarse tras el límite");
  assert.equal(blocked.error, "invalid");
  assert.equal(
    [...adapter.state().invitations.values()][0].attempt_count,
    INVITATION_MAX_ATTEMPTS,
  );
});

test("un token con formato inválido no abre transacción", async () => {
  let transactions = 0;
  const adapter: ClaimAdapter = {
    async transaction<T>(work: (store: ClaimStore) => Promise<T>) {
      transactions += 1;
      return work({} as ClaimStore);
    },
  };
  const result = await claimInvitation(
    "corto",
    { studentKey: STUDENT_KEY, studentName: "Ana" },
    { adapter, now: NOW },
  );

  if (result.ok) assert.fail("el token no es válido");
  assert.equal(result.error, "invalid");
  assert.equal(transactions, 0);
});

test("el adaptador de entrega no envía ni afirma envío", () => {
  assert.deepEqual(
    sendInvitationEmail({
      to: "alumno@cualquier-dominio.com",
      link: buildInvitationLink(generateInvitationToken()),
    }),
    { sent: false, reason: "not_configured" },
  );
});

function readFixture(name: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "docs/contracts/fixtures/x07", name),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

const ERROR_FIXTURES = [
  "expired.json",
  "used.json",
  "revoked.json",
  "full.json",
  "already-member.json",
] as const;

test("los fixtures de error coinciden con la API estable", () => {
  for (const file of ERROR_FIXTURES) {
    const fixture = readFixture(file);
    const error = fixture.error as InvitationError;
    assert.ok(INVITATION_ERROR_STATUS[error], file);
    assert.deepEqual(fixture, invitationErrorBody(error), file);
  }
});

test("el fixture de éxito no expone correo, token ni hash", () => {
  const fixture = readFixture("success.json");
  const text = JSON.stringify(fixture);
  assert.equal(fixture.ok, true);
  assert.ok(!text.includes("email"));
  assert.ok(!text.includes("token"));
  assert.ok(!text.includes("token_hash"));

  const membership = fixture.membership as Record<string, unknown>;
  assert.deepEqual(Object.keys(membership).sort(), [
    "classCode",
    "classId",
    "className",
    "courseCatalogId",
    "courseId",
    "joinedAt",
    "studentId",
    "teacherName",
  ]);
  assert.equal(membership.courseCatalogId, "base");
});
