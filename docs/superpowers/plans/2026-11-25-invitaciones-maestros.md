# Invitaciones de maestros y recuperación de contraseña — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Alta de maestros por invitación, recuperación de contraseña y política única de
contraseña.

**Architecture:** El maestro se crea pendiente; `teacher_tokens` guarda hashes de tokens
de invitación/restablecimiento. El correo se envía con Resend y, si falla, el admin ve el
enlace. La política de contraseña es un módulo puro compartido por front y back.

**Tech Stack:** Next.js 16, React 19, Postgres (postgres.js), Resend, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-25-invitaciones-maestros-design.md`

> Estado: implementado y verificado el 25 de noviembre de 2026. Migración aplicada;
> los flujos de invitación y restablecimiento se probaron en la UI local.

## Global Constraints

- No se crean contraseñas desde el panel; solo invitaciones.
- La política es 8–128, mayúscula, minúscula, número y símbolo.
- El token en claro solo existe en el enlace/correo; en base queda SHA-256.
- Un solo token pendiente por maestro y propósito.
- Invitación 7 días; restablecimiento 60 minutos; recuperación pública con 60 s de
  enfriamiento.
- No se rompe el login de maestros existentes.
- El repo tiene cambios locales sin commit: no borrar ni revertir archivos ajenos.

## Review Focus

- Un maestro pendiente no debe poder iniciar sesión hasta aceptar la invitación.
- Un enlace reenviado debe invalidar el anterior.
- Restablecer debe invalidar las sesiones abiertas.
- La recuperación no debe revelar si el correo existe.
- La política debe rechazarse en servidor aunque el front se salte.

---

### Task 1: Migración y política de contraseña

**Files:**
- Create: `supabase/migrations/20261125000000_teacher_invitations.sql`
- Create: `lib/password-policy.ts`
- Create: `lib/password-policy.test.ts`
- Modify: `package.json`

**Interfaces:**
- `PASSWORD_MIN_LENGTH = 8`, `PASSWORD_MAX_LENGTH = 128`
- `PASSWORD_REQUIREMENTS: { id; label; test(value): boolean }[]`
- `validatePassword(value: string): { valid: boolean; unmet: string[] }`

- [x] Crear la migración del spec con `teachers.activated_at`, el check de activación y
  `teacher_tokens`.
- [x] Escribir tests de política: válida `Abcdef1!`, inválidas sin mayúscula, sin
  minúscula, sin número, sin símbolo, 7 caracteres y 129.
- [x] Verlos fallar, implementar la política y pasarlos.
- [x] Añadir el test a `package.json`.

### Task 2: Correo reutilizable y plantillas de maestro

**Files:**
- Modify: `lib/email.ts`
- Modify: `lib/invitations/delivery.ts`
- Create: `lib/teacher-emails.ts`
- Create: `lib/teacher-emails.test.ts`

**Interfaces:**
- `sendEmail({ to, subject, text, html }): Promise<EmailDelivery>`
- `escapeHtml(value: string): string`
- `teacherInvitationEmailContent({ to, name, link, expiresAt, invitedBy })`
- `teacherPasswordResetEmailContent({ to, name, link, expiresAt })`
- `sendTeacherInvitationEmail(...)`, `sendTeacherPasswordResetEmail(...)`

- [x] Extraer `sendEmail`/`escapeHtml` a `lib/email.ts` y hacer que
  `sendInvitationEmail` los use.
- [x] Escribir tests de contenido: nombre, enlace, vencimiento y escape de HTML.
- [x] Implementar las plantillas y el envío.
- [x] Ejecutar los tests existentes de invitaciones y los nuevos.

### Task 3: Tokens y cuentas de maestro

**Files:**
- Create: `lib/teacher-accounts.ts`
- Create: `lib/teacher-accounts.test.ts`

**Interfaces:**
- `TEACHER_INVITE_DAYS = 7`, `TEACHER_RESET_MINUTES = 60`,
  `TEACHER_RESEND_COOLDOWN_SECONDS = 60`
- `buildTeacherInviteLink(baseUrl, token)`, `buildTeacherResetLink(baseUrl, token)`
- `isTeacherToken(value)`, `teacherTokenStatus(state, now)`
- `createPendingTeacher({ name, email, invitedBy })`
- `resendTeacherInvitation(teacherId, invitedBy)`
- `acceptTeacherInvitation(token, password)`
- `requestTeacherPasswordReset(email)`
- `resetTeacherPassword(token, password)`

- [x] Escribir tests de enlaces, formato de token y estados (pendiente, usado,
  revocado, vencido).
- [x] Implementar la creación de tokens, revocación del anterior, envío y actualización
  de `sent_at`/`delivery_error`.
- [x] Implementar alta pendiente, reenvío, aceptación y activación.
- [x] Implementar solicitud de recuperación (genérica y con enfriamiento) y
  restablecimiento con borrado de sesiones.
- [x] Ejecutar tests y `npx tsc --noEmit`.

### Task 4: Panel de administración

**Files:**
- Modify: `app/(panel)/admin/maestros/actions.ts`
- Modify: `app/(panel)/admin/maestros/create-teacher-form.tsx`
- Modify: `app/(panel)/admin/maestros/page.tsx`
- Create: `app/(panel)/admin/maestros/resend-invitation-form.tsx`

- [x] `createTeacher` valida nombre/correo, crea pendiente, envía y devuelve enlace y
  entrega.
- [x] Formulario sin contraseña, con “Enviar invitación”, mensaje y enlace copiable.
- [x] Lista con estado, entrega del correo y reenvío para pendientes.
- [x] Verificar `npx tsc --noEmit` y `npm run build`.

### Task 5: Aceptar invitación

**Files:**
- Create: `app/invitacion/page.tsx`
- Create: `app/invitacion/accept-form.tsx`
- Create: `app/password-requirements.tsx`

- [x] La página valida el token, muestra el nombre y los estados usados/vencidos.
- [x] El formulario pide contraseña y confirmación, muestra checklist y bloquea el envío
  hasta cumplir.
- [x] La acción valida en servidor, activa, marca el token, crea sesión y redirige.
- [x] Metadatos `noindex` y `referrer: no-referrer`.

### Task 6: Recuperar y restablecer contraseña

**Files:**
- Create: `app/recuperar/page.tsx`
- Create: `app/recuperar/request-form.tsx`
- Create: `app/restablecer/page.tsx`
- Create: `app/restablecer/reset-form.tsx`
- Modify: `app/login/page.tsx`

- [x] `/recuperar` pide correo y responde genéricamente.
- [x] `/restablecer` valida token, pide contraseña con checklist y redirige a login.
- [x] Login muestra “¿Olvidaste tu contraseña?” y el aviso de éxito.
- [x] Verificar tokens inválidos/usados/vencidos.

### Task 7: Login, sesión y seed

**Files:**
- Modify: `app/login/actions.ts`
- Modify: `lib/auth.ts`
- Modify: `scripts/seed-admin.ts`
- Modify: `.env.example`

- [x] El login exige `activated_at` y hash no vacío.
- [x] `getSession` ignora cuentas no activadas.
- [x] El seed usa la política y marca `activated_at = now()`.
- [x] El `.env.example` documenta la política.

### Task 8: Documentación y verificación

**Files:**
- Modify: `README.md`, `DATABASE teacher.md`, `PLAN.md`, `package.json`

- [x] Documentar las tablas, rutas y flujo.
- [x] Ejecutar `npm test`, `npm run lint`, `npm run build`.
- [x] Aplicar la migración con `npm run db:apply`.
- [x] Probar DB: crear pendiente, aceptar, login, reenviar, recuperar, restablecer,
  sesión invalidada, token inválido.
- [x] Revisar el diff sin tocar cambios ajenos.
