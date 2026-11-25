# Ajustes de cuentas, rate limits y recuperación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los hallazgos de la revisión del 25 nov: límites de autenticación que soporten un aula detrás de una IP, emisión de códigos de vinculación desde el panel, orden seguro de recuperación de contraseña y una indicación correcta de cuenta en la nube.

**Architecture:** Los ajustes se reparten entre el CMS (Next.js + Postgres) y la app Expo (SQLite). El CMS añade emisión de códigos desde el panel, migraciones aditivas para `sent_at` y límites más altos por IP; la app corrige `needsRemoteLink` usando la existencia de `remote_session`, sin cambiar el contrato de contenido. Las pruebas de base de datos viven en un script separado `test:db` porque necesitan `.env.local`; el resto sigue en `npm test`.

**Tech Stack:** Next.js 16, React 19, Postgres (postgres.js), Node test + tsx; Expo/React Native, expo-sqlite, Jest.

**Spec:** `docs/superpowers/specs/2026-11-24-cuentas-remotas-design.md` y los hallazgos de la revisión del 2026-11-25 (sección Contexto).

## Global Constraints

- No añadir dependencias nuevas.
- Las migraciones son aditivas; no borrar tablas ni datos de usuarios en una migración.
- No cambiar el contrato v3 de contenido ni las rutas existentes.
- No revelar si un correo existe: las respuestas de recuperación son genéricas.
- La app conserva el modo offline-first; los cambios de auth no bloquean el uso sin conexión de una cuenta ya vinculada.
- Las pruebas que tocan la base usan `npm run test:db` con `.env.local`; no se añaden al `npm test` puro.
- Raíces: CMS `D:\devvv\MLO-content\mlo-teachers`; app `D:\devvv\MLO\MLO-Ingenieria-software`.

## Contexto

La revisión del 25 nov encontró siete puntos. Este plan cubre los seis que requieren código; el séptimo (actualizar cifras del historial) va en la tarea 5.

1. Los límites por IP (30 login, 10 registro, 10 vinculación) bloquean a un aula que comparte NAT.
2. El rate limiter real no tiene prueba; solo se prueban la IP y que los números sean positivos.
3. El correo de recuperación sale antes de guardar el token/código; un fallo posterior deja un enlace muerto, y dos solicitudes pueden enviar dos correos.
4. El código de vinculación solo se emite por CLI; la app dice que lo da el docente.
5. `needsRemoteLink` confunde una cuenta en la nube cuyo primer sync falló con una cuenta local.
6. La limpieza de `auth_rate_limits` recorre la tabla sin índice por `created_at`.
7. El historial y el plan tienen cifras/versiones viejas (v23, 157/541).

## Review Focus

- **Aula completa detrás de un NAT:** 40 alumnos deben poder iniciar sesión, registrarse o vincularse desde la misma IP dentro de 15 minutos; Task 1 lo prueba con 40 llamadas reales a `takeRateLimit` para cada uno de los tres flujos.
- **Correo que falla después de generar el código:** el código anterior debe seguir vigente y no debe quedar una fila pendiente; Task 4 lo prueba con un remitente falso que devuelve `sent:false`.
- **Cuenta en la nube sin primer sync:** después de cerrar sesión, la app no debe pedir vincular una cuenta que ya existe; Task 3 lo prueba con `remote_session` sin token ni hash.
- **Docente de otro grupo emitiendo un código:** solo el docente dueño de la clase o el admin puede emitir; Task 2 lo prueba con la función pura `canIssueStudentLink`.
- **Dos solicitudes de recuperación a la vez:** solo debe salir un correo y debe quedar un código vigente; Task 4 lo prueba con dos llamadas concurrentes y un remitente contador.

---

### Task 1: Límites de autenticación compatibles con un aula

**Files:**
- Modify: `lib/rate-limit.ts:19-29`
- Modify: `lib/rate-limit.test.ts`
- Create: `lib/rate-limit.db.test.ts`
- Modify: `package.json` (script `test:db`)
- Create: `supabase/migrations/20261125000004_auth_rate_limits_created_idx.sql`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `RATE_LIMITS` con los valores nuevos; `takeRateLimit(scope, key, rule)` sin cambios; script `npm run test:db`.

- [ ] **Step 1: Escribir la prueba que falla por límites bajos**

En `lib/rate-limit.test.ts`, añade:

```ts
test("los límites por IP soportan un aula compartida", () => {
  assert.ok(RATE_LIMITS.studentLoginIp.limit >= 100);
  assert.ok(RATE_LIMITS.studentRegisterIp.limit >= 50);
  assert.ok(RATE_LIMITS.studentLinkIp.limit >= 50);
  assert.ok(RATE_LIMITS.teacherLoginIp.limit >= 50);
});
```

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `node --import tsx --test lib/rate-limit.test.ts`
Expected: FAIL en la nueva prueba porque los valores actuales son 30/10/10/20.

- [ ] **Step 3: Subir los límites**

En `lib/rate-limit.ts`, deja:

```ts
studentLoginIp: { limit: 300, windowMinutes: WINDOW_MINUTES },
studentLoginGlobal: { limit: 500, windowMinutes: WINDOW_MINUTES },
studentRegisterIp: { limit: 100, windowMinutes: WINDOW_MINUTES },
studentRegisterGlobal: { limit: 100, windowMinutes: WINDOW_MINUTES },
studentLinkIp: { limit: 100, windowMinutes: WINDOW_MINUTES },
studentLinkGlobal: { limit: 100, windowMinutes: WINDOW_MINUTES },
teacherLoginIp: { limit: 60, windowMinutes: WINDOW_MINUTES },
teacherLoginEmail: { limit: 10, windowMinutes: WINDOW_MINUTES },
teacherLoginGlobal: { limit: 200, windowMinutes: WINDOW_MINUTES },
```

El límite por usuario (`student_auth_attempts`, 10/15 min) sigue siendo la protección contra fuerza bruta de una cuenta; el límite por IP ya no bloquea un aula.

- [ ] **Step 4: Verla pasar**

Run: `node --import tsx --test lib/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribir la prueba real del limiter**

Crea `lib/rate-limit.db.test.ts`:

```ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { db } from "./db";
import { RATE_LIMITS, takeRateLimit } from "./rate-limit";

const keys: string[] = [];

after(async () => {
  for (const key of keys) {
    await db()`delete from auth_rate_limits where key = ${key}`;
  }
  await db().end({ timeout: 5 });
});

test("40 alumnos caben en login, registro y vinculación por IP", async () => {
  const scopes = [
    ["student_login", RATE_LIMITS.studentLoginIp],
    ["student_register", RATE_LIMITS.studentRegisterIp],
    ["student_link", RATE_LIMITS.studentLinkIp],
  ] as const;
  for (const [scope, rule] of scopes) {
    const key = `test:${randomUUID()}`;
    keys.push(key);
    for (let index = 0; index < 40; index += 1) {
      assert.equal(await takeRateLimit(scope, key, rule), true);
    }
  }
});

test("el limiter bloquea al superar una regla pequeña", async () => {
  const key = `test:${randomUUID()}`;
  keys.push(key);
  const rule = { limit: 2, windowMinutes: 15 };
  assert.equal(await takeRateLimit("student_login", key, rule), true);
  assert.equal(await takeRateLimit("student_login", key, rule), true);
  assert.equal(await takeRateLimit("student_login", key, rule), false);
});
```

Añade a `package.json`:

```json
"test:db": "node --env-file=.env.local --import tsx --test lib/rate-limit.db.test.ts"
```

- [ ] **Step 6: Ejecutar la prueba contra la base real**

Run: `npm run test:db`
Expected: PASS. Requiere `.env.local` y la tabla `auth_rate_limits` ya aplicada.

- [ ] **Step 7: Añadir el índice de limpieza**

Crea `supabase/migrations/20261125000004_auth_rate_limits_created_idx.sql`:

```sql
create index auth_rate_limits_created_idx
  on auth_rate_limits (created_at);
```

Aplícalo:

```bash
npm run db:apply -- supabase/migrations/20261125000004_auth_rate_limits_created_idx.sql
```

- [ ] **Step 8: Verificar el índice**

Run:

```sql
select indexname from pg_indexes
 where tablename = 'auth_rate_limits'
   and indexname = 'auth_rate_limits_created_idx';
```

Expected: una fila.

- [ ] **Step 9: Commit**

```bash
git add lib/rate-limit.ts lib/rate-limit.test.ts lib/rate-limit.db.test.ts package.json supabase/migrations/20261125000004_auth_rate_limits_created_idx.sql
git commit -m "fix(auth): rate limits compatibles con aulas y prueba real del limiter"
```

---

### Task 2: Emitir el código de vinculación desde el panel

**Files:**
- Create: `lib/student-link.ts`
- Modify: `scripts/issue-student-link.ts`
- Modify: `lib/classes.ts` (`listClassStudents`)
- Modify: `lib/actions/classes.ts` (nueva acción)
- Modify: `app/(panel)/grupos/[id]/page.tsx`
- Create: `app/(panel)/grupos/[id]/student-link-form.tsx`
- Create: `lib/student-link.test.ts`
- Create: `lib/student-link.db.test.ts`
- Modify: `package.json` (lista de `npm test` y script `test:db`)

**Interfaces:**
- Produces:
  - `generateStudentLinkCode(): string` (6 dígitos).
  - `isStudentLinkCode(value: string): boolean`.
  - `canIssueStudentLink(input: { teacherId: string; role: "admin" | "maestro"; classTeacherId: string; isMember: boolean }): boolean`.
  - `issueStudentLinkCode(studentId: string): Promise<{ code: string; expiresAt: Date } | null>`.
  - `createStudentLinkCode(_prev: StudentLinkResult, formData: FormData): Promise<StudentLinkResult>` con `StudentLinkResult = { error?: string; code?: string; expiresAt?: string }`.
  - `listClassStudents` devuelve además `externalKey` y `hasAccount`.

- [ ] **Step 1: Escribir las pruebas puras que fallan**

Crea `lib/student-link.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  canIssueStudentLink,
  generateStudentLinkCode,
  isStudentLinkCode,
} from "./student-link";

test("el código de vinculación es de 6 dígitos", () => {
  const code = generateStudentLinkCode();
  assert.equal(isStudentLinkCode(code), true);
  assert.match(code, /^\d{6}$/);
});

test("solo el docente dueño o el admin emiten el código", () => {
  const base = {
    teacherId: "t1",
    role: "maestro" as const,
    classTeacherId: "t1",
    isMember: true,
  };
  assert.equal(canIssueStudentLink(base), true);
  assert.equal(canIssueStudentLink({ ...base, classTeacherId: "t2" }), false);
  assert.equal(canIssueStudentLink({ ...base, isMember: false }), false);
  assert.equal(
    canIssueStudentLink({ ...base, role: "admin", classTeacherId: "t2" }),
    true,
  );
});
```

- [ ] **Step 2: Ejecutarlas y verlas fallar**

Run: `node --import tsx --test lib/student-link.test.ts`
Expected: FAIL porque `lib/student-link.ts` no existe.

- [ ] **Step 3: Implementar `lib/student-link.ts`**

La emisión real reutiliza lo que ya hace el script: verificar que el alumno existe y no tiene cuenta, generar un código de 6 dígitos con `randomInt(0, 1_000_000)`, hashearlo con `hashToken`, invalidar los códigos anteriores e insertar uno nuevo con vencimiento a 30 minutos, en una transacción. Firma exacta:

```ts
export const STUDENT_LINK_CODE_TTL_MINUTES = 30;

export function generateStudentLinkCode(): string;
export function isStudentLinkCode(value: string): boolean;
export function canIssueStudentLink(input: {
  teacherId: string;
  role: "admin" | "maestro";
  classTeacherId: string;
  isMember: boolean;
}): boolean;
export async function issueStudentLinkCode(
  studentId: string,
): Promise<{ code: string; expiresAt: Date } | null>;
```

`canIssueStudentLink` devuelve `input.isMember && (input.role === "admin" || input.teacherId === input.classTeacherId)`.

- [ ] **Step 4: Verlas pasar y añadirlas a `npm test`**

En `package.json`, añade `lib/student-link.test.ts` a la lista del script `test`.

Run: `node --import tsx --test lib/student-link.test.ts`
Expected: PASS.

- [ ] **Step 5: Prueba de emisión contra la base**

Crea `lib/student-link.db.test.ts` con un alumno de prueba:

```ts
const externalKey = randomUUID();
const [student] = await db()`insert into students (external_key, name)
  values (${externalKey}, ${"Alumno de prueba"}) returning id`;
const issued = await issueStudentLinkCode(student.id);
assert.ok(issued);
assert.match(issued.code, /^\d{6}$/);
assert.ok(issued.expiresAt.getTime() > Date.now());
```

Limpia `student_link_codes` y `students` en `finally`, y cierra `db()` al final del archivo. Añade el archivo al script `test:db`:

```json
"test:db": "node --env-file=.env.local --import tsx --test lib/rate-limit.db.test.ts lib/student-link.db.test.ts"
```

Run: `npm run test:db`
Expected: PASS.

- [ ] **Step 6: Reutilizar la emisión en el script**

En `scripts/issue-student-link.ts`, borra la generación/insert duplicados y usa:

```ts
const issued = await issueStudentLinkCode(student.id);
if (!issued) {
  console.error("Esa cuenta ya está vinculada o el alumno no existe.");
  process.exit(1);
}
console.log(`Código de vinculación para ${student.name}: ${issued.code}`);
```

- [ ] **Step 7: Añadir los datos que necesita el panel**

En `lib/classes.ts`, amplía `listClassStudents` para devolver `externalKey` y `hasAccount`:

```sql
select s.id, s.name, s.external_key, m.joined_at,
       exists(
         select 1 from student_accounts a where a.student_id = s.id
       ) as has_account
  from class_members m
  join students s on s.id = m.student_id
 where m.class_id = ${classId} and m.active
 order by s.name
```

Actualiza el tipo de retorno con `externalKey: string` y `hasAccount: boolean`.

- [ ] **Step 8: Añadir la acción del panel**

En `lib/actions/classes.ts`:

```ts
export type StudentLinkResult = {
  error?: string;
  code?: string;
  expiresAt?: string;
};

export async function createStudentLinkCode(
  _prev: StudentLinkResult,
  formData: FormData,
): Promise<StudentLinkResult> {
  const teacher = await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const klass = await requireEditableClass(teacher, classId);
  const [member] = await db()<{ ok: boolean }[]>`
    select exists(
      select 1 from class_members
       where class_id = ${klass.id} and student_id = ${studentId} and active
    ) as ok`;
  if (
    !canIssueStudentLink({
      teacherId: teacher.id,
      role: teacher.role,
      classTeacherId: klass.teacher_id,
      isMember: Boolean(member?.ok),
    })
  ) {
    return { error: "El alumno no pertenece a este grupo." };
  }
  const issued = await issueStudentLinkCode(studentId);
  if (!issued) return { error: "El alumno ya tiene cuenta o no existe." };
  revalidatePath(`/grupos/${klass.id}`);
  return { code: issued.code, expiresAt: issued.expiresAt.toISOString() };
}
```

- [ ] **Step 9: Añadir el formulario y el botón**

Crea `app/(panel)/grupos/[id]/student-link-form.tsx` como cliente:

- `useActionState(createStudentLinkCode, {})`.
- Un `<form>` con `classId` y `studentId` ocultos y un botón **Generar código**.
- Si `state.code`, abre el `ResultDialog` con título “Código de vinculación”, muestra el código, la fecha de vencimiento y la nota “Compártelo solo con el alumno; vence en 30 minutos”.
- Usa el patrón `dismissed` de los otros formularios para no reabrir el diálogo.

En `app/(panel)/grupos/[id]/page.tsx`, en la tabla de alumnos, añade una columna **Cuenta**:
- Si `student.hasAccount`, muestra el badge “En la nube”.
- Si no, renderiza `<StudentLinkForm classId={klass.id} studentId={student.id} studentName={student.name} />`.

- [ ] **Step 10: Verificar tipos, lint y pruebas**

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run test:db
```

Expected: todo en verde.

- [ ] **Step 11: Prueba manual**

En `/grupos/[id]`:
1. Un alumno sin cuenta muestra **Generar código**.
2. Al pulsarlo aparece un código de 6 dígitos y vence en 30 minutos.
3. El alumno abre **Vincular cuenta** en la app, introduce ese código y su contraseña nueva; la cuenta queda vinculada.
4. Un alumno con cuenta muestra “En la nube” y no ofrece el botón.

- [ ] **Step 12: Commit**

```bash
git add lib/student-link.ts lib/student-link.test.ts lib/student-link.db.test.ts scripts/issue-student-link.ts lib/classes.ts lib/actions/classes.ts "app/(panel)/grupos/[id]/page.tsx" "app/(panel)/grupos/[id]/student-link-form.tsx" package.json
git commit -m "feat(panel): emitir códigos de vinculación desde el grupo"
```

---

### Task 3: `needsRemoteLink` según la existencia de `remote_session` (app)

**Files:**
- Modify: `src/features/auth/viewmodel/useAuth.tsx:206-211` y `:463-467`
- Modify: `src/features/auth/viewmodel/__tests__/useAuth.test.tsx`

**Interfaces:**
- Consumes: `remote.select(accountId)` de `Repositories`.
- Produces: `needsRemoteLink` verdadero solo cuando no existe fila `remote_session` para la cuenta.

- [ ] **Step 1: Escribir la prueba que falla**

En `useAuth.test.tsx`, añade un caso con una cuenta cargada y `remote.select` devolviendo:

```ts
{
  accountId: 1,
  token: null,
  expiresAt: null,
  lastUploadedHash: null,
  lastSyncedAt: null,
  pendingRestore: false,
  forceRemote: false,
  createdAt: "2026-11-25T00:00:00.000Z",
}
```

Assert: `needsRemoteLink === false` después de cargar.

Añade otro caso con `remote.select` devolviendo `null` y la misma cuenta; assert: `needsRemoteLink === true`.

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `npx jest src/features/auth/viewmodel/__tests__/useAuth.test.tsx -t "needsRemoteLink"`
Expected: FAIL en el primer caso: hoy devuelve `true` porque no hay token ni hash.

- [ ] **Step 3: Cambiar la condición**

En los dos lugares (carga inicial y `reloadAccount`):

```ts
setNeedsRemoteLink(Boolean(loaded && !remoteSession));
```

La fila `remote_session` se crea al registrar, iniciar sesión o vincular, y se conserva al cerrar sesión (`clearToken` solo borra el token). Una cuenta que nunca estuvo en la nube no tiene fila.

- [ ] **Step 4: Verla pasar y comprobar tipos**

Run:

```bash
npx jest src/features/auth/viewmodel/__tests__/useAuth.test.tsx --silent
npx tsc --noEmit
```

Expected: PASS y TypeScript limpio.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/viewmodel/useAuth.tsx src/features/auth/viewmodel/__tests__/useAuth.test.tsx
git commit -m "fix(auth): no pedir vincular una cuenta que ya está en la nube"
```

---

### Task 4: Guardar el código/token antes de enviar el correo

**Files:**
- Create: `supabase/migrations/20261125000005_recovery_delivery.sql`
- Modify: `lib/student-recovery.ts`
- Modify: `lib/teacher-accounts.ts`
- Modify: `lib/student-recovery.test.ts`
- Modify: `lib/teacher-accounts.test.ts`
- Create: `lib/recovery.db.test.ts`
- Modify: `package.json` (`test:db`)

**Interfaces:**
- Cambia:
  - `requestStudentPasswordReset(rawEmail: string, deps?: { sendEmail?: typeof sendEmail }): Promise<StudentRecoveryResult>`
  - `requestTeacherPasswordReset(rawEmail: string, deps?: { sendReset?: typeof sendTeacherPasswordResetEmail; sendInvite?: typeof sendTeacherInvitationEmail }): Promise<...>`
- Migración:
  - `student_password_resets.sent_at timestamptz`.
  - `teacher_tokens_pending_idx` pasa a `where used_at is null and revoked_at is null and sent_at is not null`.
- `confirmStudentPasswordReset` solo acepta filas con `sent_at is not null`.
- `getTeacherTokenPreview` (purpose `reset`) y `resetTeacherPassword` solo aceptan tokens con `sent_at is not null`.

- [ ] **Step 1: Añadir la migración y aplicarla**

`supabase/migrations/20261125000005_recovery_delivery.sql`:

```sql
alter table student_password_resets add column sent_at timestamptz;

update student_password_resets
   set sent_at = created_at
 where sent_at is null;

drop index if exists teacher_tokens_pending_idx;
create unique index teacher_tokens_pending_idx
  on teacher_tokens (teacher_id, purpose)
  where used_at is null
    and revoked_at is null
    and sent_at is not null;
```

Run:

```bash
npm run db:apply -- supabase/migrations/20261125000005_recovery_delivery.sql
```

Verifica la columna y el índice:

```sql
select column_name from information_schema.columns
 where table_name = 'student_password_resets' and column_name = 'sent_at';
select indexdef from pg_indexes
 where indexname = 'teacher_tokens_pending_idx';
```

- [ ] **Step 2: Escribir las pruebas de base que fallan**

Crea `lib/recovery.db.test.ts` con tres casos:

1. **Fallo de envío de alumno:** crea un alumno y una cuenta con email único y `hashPassword`; precrea un código anterior `sent_at = now()`; llama `requestStudentPasswordReset` con `sendEmail` falso `{ sent: false, reason: "network" }`; assert: devuelve `email_unavailable`, no hay filas nuevas con `sent_at is null` y el código anterior sigue con `used_at is null`.
2. **Éxito de alumno y dos solicitudes:** un remitente falso que cuenta y captura el mensaje; `Promise.all` de dos solicitudes; assert: se envió **un** correo, queda **un** código con `sent_at is not null`; extrae el código del texto y `confirmStudentPasswordReset(email, code, "NuevaClave1!")` devuelve `ok`.
3. **Fallo y éxito de maestro:** inserta un maestro activado; con un remitente falso que falla, assert: no queda token nuevo (el anterior sigue vigente); con el remitente que responde bien, extrae el token del enlace `/restablecer?token=...` y `resetTeacherPassword(token, "NuevaClave1!")` devuelve `ok`.

Limpia alumnos, cuentas, resets, tokens y maestros en `finally`; añade el archivo a `test:db`:

```json
"test:db": "node --env-file=.env.local --import tsx --test lib/rate-limit.db.test.ts lib/student-link.db.test.ts lib/recovery.db.test.ts"
```

Run: `npm run test:db`
Expected: FAIL en los tres casos con el código actual (el correo sale antes de guardar y no hay `sent_at`).

- [ ] **Step 3: Implementar el flujo del alumno**

En `requestStudentPasswordReset`:

1. Validar email/configuración/cuenta y el límite de 3 por 15 minutos.
2. En una transacción, bloquear la fila del alumno (`select id from students where id = ... for update`). Si ya hay un código **sin enviar** (`used_at is null and sent_at is null and expires_at > now()`), devolver `{ ok: true }` sin enviar otro correo: otra solicitud ya está en curso. Un reintento deliberado después de un envío correcto sí puede crear un código nuevo (hasta 3 por 15 minutos).
3. Insertar el nuevo código con `sent_at = null` (sin invalidar el anterior todavía) y confirmar la transacción.
4. Enviar el correo. Si falla, borrar la fila nueva y devolver `email_unavailable`.
5. En una transacción, marcar como usados los códigos anteriores (`id <> nuevo`) y poner `sent_at = now()` en el nuevo.

`confirmStudentPasswordReset` debe filtrar `sent_at is not null` además de `used_at is null` y `expires_at > now()`.

- [ ] **Step 4: Implementar el flujo del maestro**

En `requestTeacherPasswordReset`:

1. Validar email/configuración/cooldown/maestro.
2. En una transacción, bloquear la fila del maestro. Si hay un token **sin enviar** (`used_at is null and revoked_at is null and sent_at is null`) o el cooldown de 60 s sigue activo, devolver `{ ok: true }` sin enviar otro correo.
3. Insertar el nuevo token con `sent_at = null` sin revocar el anterior.
4. Enviar el correo. Si falla, borrar el token nuevo y devolver `email_unavailable`.
5. En una transacción, revocar los tokens anteriores del mismo propósito y marcar `sent_at = now()` en el nuevo.

En `getTeacherTokenPreview`, cuando `purpose === "reset"`, exige `sent_at is not null`; el flujo de invitación conserva el enlace de respaldo con `sent_at null`. En `resetTeacherPassword`, exige `sent_at is not null`.

- [ ] **Step 5: Verificar las pruebas**

Run:

```bash
npm test
npm run test:db
npx tsc --noEmit
npm run lint
```

Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261125000005_recovery_delivery.sql lib/student-recovery.ts lib/teacher-accounts.ts lib/student-recovery.test.ts lib/teacher-accounts.test.ts lib/recovery.db.test.ts package.json
git commit -m "fix(auth): guardar código y token antes de enviar el correo"
```

---

### Task 5: Actualizar el historial y verificar todo

**Files:**
- Modify: `MLO-Ingenieria-software/docs/estado/historial-cms.md`
- Modify: `MLO-Ingenieria-software/docs/estado/linea-de-tiempo.md`
- Modify: `PLAN.md`

- [ ] **Step 1: Actualizar el historial del CMS**

Añade una entrada **2026-11-25** o amplía la del 24 con:
- Límites por IP para aulas (300/100/100/60) y prueba real del limiter.
- Código de vinculación desde el panel y guard `linked` (si aplica).
- Recuperación: código/token guardado antes de enviar; `sent_at`.
- `needsRemoteLink` por existencia de `remote_session`.
- Cifras actuales: los conteos que reporten `npm test` y `npx jest` al terminar (el punto de partida es 181 y 575; las pruebas nuevas suben el número); `DATABASE_VERSION` 24.

- [ ] **Step 2: Actualizar la línea de tiempo de la app**

En la entrada del 24 nov y el estado del repositorio:
- `DATABASE_VERSION` 24.
- 575 pruebas.
- Código de vinculación emitido desde el panel.
- `needsRemoteLink` corregido.
- Nota de la migración `20261125000005_recovery_delivery.sql`.

- [ ] **Step 3: Actualizar `PLAN.md`**

Añade la fila del 2026-11-25 con los ajustes y corrige la fila del 24: SQLite v24, los conteos finales de tests, rate limits y vinculación.

- [ ] **Step 4: Verificación completa**

CMS:

```bash
npm test          # todos en verde; el conteo sube con las pruebas nuevas (base 181)
npm run test:db   # rate-limit, student-link, recovery
npm run lint
npx tsc --noEmit
npm run build
```

App:

```bash
npx tsc --noEmit
npx jest --silent  # todos en verde (base 575)
```

- [ ] **Step 5: Commit**

```bash
git add "MLO-Ingenieria-software/docs/estado/historial-cms.md" "MLO-Ingenieria-software/docs/estado/linea-de-tiempo.md" PLAN.md
git commit -m "docs: registrar ajustes de auth, rate limits y vinculación"
```

---

## Verificación final

- [ ] Un aula de 40 puede iniciar sesión/registrarse desde una IP (prueba `test:db`).
- [ ] Un docente puede generar un código desde `/grupos/[id]` y un alumno puede vincular su cuenta.
- [ ] Un fallo del correo de recuperación no invalida el código anterior ni deja filas pendientes.
- [ ] Dos solicitudes concurrentes envían un solo correo.
- [ ] Una cuenta ya vinculada no muestra “Vincular cuenta” tras cerrar sesión.
- [ ] `npm test` y `npm run test:db` en verde, `tsc`/`lint`/`build` limpios; app `npx jest` en verde.

## Notas de ejecución

- Si el despliegue está detrás de un proxy distinto de Vercel, revisar `clientIpFromHeaders`; el plan asume que el primer valor de `x-forwarded-for` es la IP real, como ya documenta el código.
- Los códigos de vinculación y recuperación son de un solo uso; no se deben registrar en logs.
- No ejecutar los scripts de reinicio (`scripts/reset-courses-and-groups.ts`) en producción.
