# Cuentas remotas y progreso en la nube — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Cuentas de alumno en el CMS con progreso ligado a la cuenta, restauración en
otro equipo y sincronización automática, manteniendo el uso sin conexión.

**Architecture:** Auth propia en el CMS (scrypt + sesiones Bearer) reutilizando
`students` y `student_progress`; la app guarda token y un snapshot local por cuenta,
compara una huella SHA-256 y sube solo cuando cambia.

**Tech Stack:** Next.js 16 + Postgres (postgres.js) en el CMS; Expo/React Native +
SQLite + expo-crypto en la app; Jest y Node test.

**Spec:** `docs/superpowers/specs/2026-11-24-cuentas-remotas-design.md`

> Estado: implementado y verificado el 24 de noviembre de 2026. La app queda
> pendiente de una prueba en dispositivo y el CMS de un despliegue.

## Global Constraints

- No se crean cuentas locales nuevas; las antiguas solo se vinculan.
- El token del CMS se guarda en SQLite, nunca la contraseña.
- Las contraseñas usan scrypt del CMS (`lib/password.ts`), no PBKDF2.
- Las rutas de contenido existentes no cambian.
- El progreso se guarda automáticamente; los botones manuales desaparecen.
- Las sesiones duran 30 días y el login se limita a 10 fallos/15 min.
- `externalKey` se conserva al vincular una cuenta existente.
- Los repos tienen cambios locales sin commit: no hacer `git checkout` ni borrar
  archivos ajenos.

## Review Focus

- Un alumno sin red después de entrar debe poder seguir avanzando y sincronizar al
  volver.
- Un token caducado no debe borrar el progreso local ni dejar la app inutilizable.
- Una cuenta local antigua no debe perder su UUID ni sus clases al vincularse.
- Un login en un equipo nuevo no debe subir un progreso vacío sobre el de la nube.
- Dos dispositivos con cambios simultáneos: la última escritura gana, sin mezclar.

---

### Task 1: Migración y lógica de auth del CMS

**Files:**
- Create: `supabase/migrations/20261124000000_student_accounts.sql`
- Create: `lib/student-auth.ts`
- Create: `lib/student-auth.test.ts`
- Modify: `package.json` (lista de `npm test`)

**Interfaces:**
- `registerStudent(input: { username; password; displayName; externalKey?: string }): Promise<{ ok: true; token: string; student: StudentIdentity } | { ok: false; error: "username_taken" | "already_registered" }>`
- `loginStudent(username: string, password: string): Promise<{ ok: true; token: string; student: StudentIdentity } | { ok: false; error: "invalid_credentials" | "rate_limited" }>`
- `requireStudent(request: Request): Promise<StudentIdentity | null>`
- `resolveStudent(request: Request): Promise<StudentIdentity | null>` (Bearer o header legacy)
- `logoutStudent(request: Request): Promise<void>`
- `StudentIdentity = { studentId: string; externalKey: string; username: string; displayName: string }`

- [x] **Step 1: Crear la migración** con las tablas `student_accounts`,
  `student_sessions` y `student_auth_attempts`, índices, RLS sin políticas.
- [x] **Step 2: Escribir `lib/student-auth.test.ts`** para validación de usuario,
  contraseña y nombre, hash/verify de scrypt, generación/hash de token y ventana de
  intentos. Valores: usuario `ab` inválido, `valentina` válido, contraseña `12345678`
  inválida por no tener símbolo, `1234567a` válida, nombre de 1 carácter inválido.
- [x] **Step 3: Ejecutar el test y verlo fallar** (`npm test -- ...` según el script).
- [x] **Step 4: Implementar `lib/student-auth.ts`** con las firmas de arriba,
  reutilizando `hashPassword`, `verifyPassword`, `newSessionToken` y `hashToken`.
- [x] **Step 5: Añadir el test a `package.json` y ejecutar `npm test`.** Esperado:
  todos los tests del archivo pasan.
- [x] **Step 6: Verificar tipos** con `npx tsc --noEmit`.

### Task 2: Rutas de auth y CORS del CMS

**Files:**
- Create: `app/api/mlo/v3/auth/register/route.ts`
- Create: `app/api/mlo/v3/auth/login/route.ts`
- Create: `app/api/mlo/v3/auth/logout/route.ts`
- Modify: `lib/api/cors.ts`

**Interfaces:**
- Consume `registerStudent`, `loginStudent`, `logoutStudent` de Task 1.
- Respuestas con `CORS_HEADERS` y `Cache-Control: no-store`.

- [x] **Step 1: Implementar las tres rutas** con `OPTIONS`, validación de JSON,
  códigos `201/200/204/400/401/409/429` y mensajes `{ error, message }`.
- [x] **Step 2: Añadir `Authorization` a `Access-Control-Allow-Headers`.**
- [x] **Step 3: Verificar** `npx tsc --noEmit` y `npm run build`.

### Task 3: Progreso y clases con Bearer (y header legacy)

**Files:**
- Modify: `app/api/mlo/v3/students/me/progress/route.ts`
- Modify: `app/api/mlo/v3/students/me/classes/route.ts`

**Interfaces:**
- Consume `resolveStudent` de Task 1.
- `GET/PUT progress` y `GET classes` usan `identity.externalKey`; si no hay identidad,
  401.

- [x] **Step 1: Cambiar la resolución de identidad** en ambas rutas; mantener
  `X-MLO-Student-Key` como fallback.
- [x] **Step 2: Verificar** `npx tsc --noEmit` y `npm run build`.
- [x] **Step 3: Probar manualmente** con curl: registro → login → PUT/GET progreso →
  GET clases → logout. (Se ejecuta en Task 10.)

### Task 4: Documentación del CMS y migración aplicada

**Files:**
- Modify: `README.md`
- Modify: `DATABASE teacher.md`
- Modify: `PLAN.md` (sacar “cuentas de alumno en el servidor” de fuera de alcance)

- [x] **Step 1: Añadir las tablas y endpoints nuevos a la documentación.**
- [x] **Step 2: Aplicar la migración** con
  `npm run db:apply -- supabase/migrations/20261124000000_student_accounts.sql`.
- [x] **Step 3: Verificar** que las tablas existen (consulta a `information_schema`).

### Task 5: SQLite v23 y repositorio de sesión remota

**Files:**
- Create: `src/features/auth/model/remoteSessionRepository.ts`
- Create: `src/features/auth/model/__tests__/remoteSessionRepository.test.ts`
- Modify: `src/shared/services/db/schema.ts`
- Modify: `src/shared/services/db/database.ts`
- Modify: `src/shared/services/db/__tests__/database.test.ts`
- Modify: `src/shared/services/db/__tests__/migration.schema.test.ts`
- Modify: `src/shared/services/data/DataProvider.tsx`

**Interfaces:**
- `RemoteSession = { accountId; token: string | null; expiresAt: string | null; lastUploadedHash: string | null; lastSyncedAt: string | null; pendingRestore: boolean }`
- `selectRemoteSession(db, accountId): Promise<RemoteSession | null>`
- `saveRemoteSession(db, { accountId, token, expiresAt }): Promise<void>`
- `updateRemoteSync(db, accountId, { lastUploadedHash?, lastSyncedAt?, pendingRestore? }): Promise<void>`
- `clearRemoteToken(db, accountId): Promise<void>`

- [x] **Step 1: Escribir el test del repositorio** con un mock de SQLite, siguiendo
  `accountRepository.test.ts`.
- [x] **Step 2: Ejecutarlo y verlo fallar.**
- [x] **Step 3: Implementar el repositorio.**
- [x] **Step 4: Añadir `remote_session` a `SCHEMA_DDL` y la migración v23**; actualizar
  `DATABASE_VERSION` a 23 y los tests que esperan 22.
- [x] **Step 5: Añadir el puerto `remote` a `DataProvider`.**
- [x] **Step 6: Ejecutar** `npx jest src/features/auth/model/__tests__/remoteSessionRepository.test.ts src/shared/services/db/__tests__` y `npx tsc --noEmit`.

### Task 6: Token HTTP y API de auth remota

**Files:**
- Create: `src/shared/services/http/authToken.ts`
- Modify: `src/shared/services/http/client.ts`
- Create: `src/features/auth/model/remoteAuth.ts`
- Create: `src/features/auth/model/__tests__/remoteAuth.test.ts`

**Interfaces:**
- `setAuthToken(token: string | null): void`, `getAuthToken(): string | null`
- `httpAuth` con `getToken: getAuthToken`
- `registerRemote(input): Promise<RemoteAuthResult>`; `loginRemote(username,password)`;
  `logoutRemote()`
- Errores mapeados: `network_error`, `invalid_credentials`, `username_taken`,
  `rate_limited`, `already_registered`, `storage_error`.

- [x] **Step 1: Escribir tests** de parseo y mapeo de errores con `fetch` mockeado.
- [x] **Step 2: Verlos fallar.**
- [x] **Step 3: Implementar el store, `httpAuth` y la API.**
- [x] **Step 4: Ejecutar los tests y `npx tsc --noEmit`.**

### Task 7: `useAuth` remoto, vinculación y restauración

**Files:**
- Modify: `src/features/auth/viewmodel/useAuth.tsx`
- Modify: `src/features/auth/viewmodel/auth.messages.ts`
- Modify: `src/features/auth/viewmodel/auth.logic.ts` (máximo 32 del usuario)
- Create: `src/features/auth/model/accountRestore.ts`
- Create: `src/features/profile/model/progressFingerprint.ts`
- Create: `src/features/profile/model/__tests__/progressFingerprint.test.ts`
- Create: `src/features/auth/model/__tests__/accountRestore.test.ts`
- Modify: `src/shared/services/content/studentProgress.ts` (Bearer)

**Interfaces:**
- `progressFingerprint(backup: ProgressBackup): Promise<string>` (SHA-256 sin
  `exportedAt`).
- `restoreAccountState(repos, account, { forceRemote?: boolean }): Promise<{ restored: boolean; uploaded: boolean; pending: boolean }>`
- `useAuth` expone además `needsRemoteLink: boolean` y
  `linkAccount(password: string): Promise<AuthOutcome>`.

- [x] **Step 1: Escribir tests de huella** (mismo contenido con distinto `exportedAt`
  da la misma huella; un cambio de progreso cambia la huella).
- [x] **Step 2: Implementar `progressFingerprint` y ver el test pasar.**
- [x] **Step 3: Cambiar `studentProgress.ts` a `httpAuth` sin `externalKey`.**
- [x] **Step 4: Implementar `restoreAccountState`** con el orden clases → cursos →
  contenido → progreso y la política de conflicto del spec.
- [x] **Step 5: Reescribir `useAuth`** para registro/login remoto, reconciliación local,
  `linkAccount`, `needsRemoteLink`, logout y fallback offline solo para cuentas con hash
  PBKDF2.
- [x] **Step 6: Escribir tests de la política de conflicto** (local pendiente sube;
  local sin cambios descarga; identidad adoptada fuerza remoto).
- [x] **Step 7: Ejecutar tests y `npx tsc --noEmit`.**

### Task 8: Sincronización automática y Perfil

**Files:**
- Modify: `src/features/profile/viewmodel/useProgressSync.tsx`
- Modify: `src/features/profile/view/ProfileScreen.tsx`
- Modify: `src/app/_layout.tsx` (montar el proveedor)
- Modify: `src/features/profile/viewmodel/__tests__/useProgressSync.test.tsx`
- Modify: `src/features/profile/view/__tests__/ProfileScreen.test.tsx`

**Interfaces:**
- `ProgressSyncProvider` y `useProgressSync()` con
  `{ status, lastSyncedAt, error, syncNow, isSyncing, isLinked }`.
- `status`: `unlinked | syncing | synced | offline | session_expired | error`.

- [x] **Step 1: Escribir tests del proveedor** (sube si cambia la huella; no sube vacío
  sin hash; 401 → `session_expired`; network → `offline`).
- [x] **Step 2: Implementar el proveedor** con AppState, intervalo de 60 s y guardia de
  concurrencia.
- [x] **Step 3: Montarlo dentro de `AuthProvider` en `_layout.tsx`.**
- [x] **Step 4: Cambiar Perfil** a estado + reintento; eliminar Guardar/Sincronizar y el
  modal de sincronización.
- [x] **Step 5: Ejecutar tests y `npx tsc --noEmit`.**

### Task 9: Pantalla de vinculación y textos

**Files:**
- Create: `src/app/(app)/(profile)/vincular-cuenta.tsx`
- Create: `src/features/auth/view/LinkAccountScreen.tsx`
- Modify: `src/features/auth/view/LoginScreen.tsx`
- Modify: `src/features/auth/view/RegisterScreen.tsx`
- Modify: `src/features/profile/view/ProfileScreen.tsx` (tarjeta de vinculación)
- Modify: `src/features/auth/viewmodel/auth.messages.ts`

- [x] **Step 1: Crear la pantalla** con contraseña, “Vincular” y “Ahora no”.
- [x] **Step 2: Añadir la tarjeta/botón en Perfil** cuando `needsRemoteLink`.
- [x] **Step 3: Actualizar los textos** de Login y Registro.
- [x] **Step 4: Verificar** `npx tsc --noEmit` y los tests de UI existentes.

### Task 10: Verificación final

- [x] **Step 1: CMS** `npm test`, `npm run lint`, `npm run build`.
- [x] **Step 2: App** `npx tsc --noEmit`, `npm test`, `npm run lint`.
- [x] **Step 3: API real:** arrancar el CMS, registrar un alumno, guardar progreso,
  cerrar sesión, borrar la sesión local, entrar y comprobar la restauración.
- [x] **Step 4: Revisar el diff** para no incluir cambios ajenos y reportar los archivos
  tocados.
