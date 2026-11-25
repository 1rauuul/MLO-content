# Cierre pre-deadline — implementación por fases

> **For agentic workers:** execute this plan task by task. Each task ends with tests and a commit. Do not build EAS.

**Goal:** cerrar los riesgos detectados en el informe del 25 nov: preservar contenido extra al reimportar el base, migrar toda la API pública a v3, añadir rate limit a la unión de grupos, registrar migraciones, guardar el token de alumno en SecureStore, configurar CI/CD y dejar la documentación al día.

**Architecture:** CMS Next.js 16 + Postgres; app Expo SDK 58 + SQLite. La API pública queda solo en `/api/mlo/v3`. Las tablas legacy `releases` y `class_releases` se conservan como datos históricos/internos; no se borran filas ni tablas en esta entrega. Se prohíbe romper releases ya publicados.

**Tech Stack:** Next.js 16, React 19, postgres.js, Node test + tsx; Expo 58, expo-sqlite, expo-secure-store, Jest.

**Spec:** informe del 25 nov 2026 en la conversación y `PLAN.md`.

## Global Constraints

- No añadir dependencias nuevas salvo `expo-secure-store` en la app.
- No ejecutar builds EAS; solo dejar la configuración.
- No borrar tablas ni datos de producción.
- No cambiar el formato de los releases publicados ni el contrato v3.
- Las migraciones nuevas son aditivas; el runner debe poder hacer `--baseline` sobre una base existente.
- CORS: permitir `*` solo si no hay `CORS_ALLOWED_ORIGINS`; en producción se configura esa variable.
- Todos los cambios van en la rama `chore/pre-deadline-cleanup`.

## Review Focus

- Un alumno sin cuenta puede unirse y descargar su release usando `X-MLO-Student-Key` en v3.
- Una reimportación del base conserva `lesson_extras` y `class_content_changes`.
- Un `join` repetido o masivo recibe 429 y no crece la lista.
- Un token guardado antes de esta entrega se migra a SecureStore sin perder la sesión.
- Un `db:migrate` sobre una base ya migrada no intenta reaplicar archivos.

---

### Task 1: Preservar contenido extra al importar el base

**Files:**
- Modify: `scripts/import-base.ts`
- Create: `lib/import-base.ts` (si se extrae la aplicación del fixture)
- Create: `lib/import-base.db.test.ts`
- Modify: `package.json` (`test:db`)

**Interfaces:**
- `applyCourseContent(tx, courseId, data: CoreCourse): Promise<void>` aplica upserts y borra solo lo que ya no existe.
- `main()` del script llama `applyCourseContent` y después publica.

**Steps:**
1. Extraer la escritura de unidades/temas/lecciones a una función que reciba el cliente de transacción.
2. Cambiar `delete + insert` de `units`, `topics` y `lessons` por `insert ... on conflict (course_id, content_id) do update`.
3. Borrar hijos (`questions`, `examples`, `exercises`, `evaluations`) y reinsertarlos como hoy; las lecciones conservan su `id`.
4. Borrar solo lecciones/temas/unidades que ya no estén en el fixture, de hijos a padres.
5. Prueba de base: crear un `lesson_extras` sobre una lección base dentro de una transacción, ejecutar `applyCourseContent` y verificar que la fila sigue; hacer rollback.
6. `npm test`, `npm run test:db`, `npm run lint`, `npm run build`; commit.

### Task 2: API v3 única + rate limit de join + CORS configurable

**Files:**
- Create: `app/api/mlo/v3/classes/[code]/route.ts`
- Create: `app/api/mlo/v3/classes/[code]/join/route.ts`
- Create: `app/api/mlo/v3/classes/[code]/members/[studentKey]/route.ts`
- Delete: `app/api/mlo/v2/**`
- Modify: `lib/rate-limit.ts`, tests
- Modify: `lib/api/cors.ts` y rutas v3
- Modify: `lib/content/v3-api.ts`, `lib/content/v3.ts`, tests (retirar helpers v2)
- Modify: `lib/content/releases.ts` y tests si quedan sin uso
- Modify: `.env.example`

**Interfaces:**
- Las rutas v3 de clase devuelven exactamente el mismo payload que las v2 (`classPreviewPayload`).
- `POST /api/mlo/v3/classes/{code}/join` responde 429 `rate_limited` al superar `classJoinIp`/`classJoinGlobal`.
- `corsHeaders(request)` devuelve `Vary: Origin` y el origen permitido.

**Steps:**
1. Copiar los tres handlers v2 a v3 y cambiar imports a v3.
2. Añadir `classJoinIp` (100/15 min) y `classJoinGlobal` (100/15 min) al limitador; aplicar en join.
3. Implementar `corsHeaders(request)` con `CORS_ALLOWED_ORIGINS` (coma) y actualizar las rutas v3.
4. Borrar rutas v2 y helpers que queden sin uso; actualizar tests.
5. `npm test`, `npm run lint`, `npm run build`; commit.

### Task 3: Registro de migraciones

**Files:**
- Create: `supabase/migrations/20261126000000_schema_migrations.sql`
- Create: `lib/migrations.ts`
- Create: `lib/migrations.test.ts`
- Create: `scripts/migrate.ts`
- Modify: `package.json` (`db:migrate`, descubrimiento de tests)
- Modify: `README.md`, `PLAN.md`

**Además (punto 10 del informe):** `npm test` deja de enumerar archivos a mano. Descubre `lib/**/*.test.ts` y excluye `*.db.test.ts`; los tests de base siguen en `test:db`. Añade una prueba de que el descubrimiento incluye un archivo nuevo y excluye los de base.

**Interfaces:**
- `pendingMigrations(files: string[], applied: string[]): string[]` ordena y filtra.
- `npm run db:migrate` aplica pendientes en una transacción y registra cada archivo.
- `npm run db:migrate -- --baseline` marca todos los archivos actuales como aplicados sin ejecutarlos.
- `npm run db:migrate -- --status` lista pendientes.

**Steps:**
1. Crear tabla `schema_migrations (filename primary key, applied_at)`.
2. Implementar la función pura y su test.
3. Implementar el runner con bootstrap de la tabla, `--baseline`, `--status` y transacción por archivo.
4. Documentar el uso; en una base existente ejecutar primero `--baseline`.
5. `npm test`; commit.

### Task 4: SecureStore en la app

**Files:**
- Modify: `package.json`, `package-lock.json` (expo-secure-store)
- Modify: `src/features/auth/model/remoteSessionRepository.ts`
- Modify: `src/features/auth/model/__tests__/remoteSessionRepository.test.ts`
- Create: `jest.setup.js` si hace falta mock global
- Modify: `package.json` jest setup

**Interfaces:**
- `selectRemoteSession` lee el token de SecureStore; si la fila antigua tiene token en SQLite, lo migra y lo borra de SQLite.
- `saveRemoteSession` escribe el token en SecureStore y `NULL` en SQLite.
- `clearRemoteToken` borra el token de SecureStore y conserva la fila.

**Steps:**
1. `npx expo install expo-secure-store`.
2. Implementar el wrapper y la migración de tokens existentes.
3. Actualizar tests con mock de SecureStore; probar lectura, guardado, limpieza y migración.
4. `npx jest`, `npx tsc --noEmit`, `npm run lint`; commit.

### Task 5: Cliente v3, EAS production y CI de la app

**Files:**
- Modify: `src/shared/services/http/client.ts`, tests
- Modify: `src/shared/services/data/DataProvider.tsx`
- Modify: `src/shared/services/content/ContentSyncProvider.tsx`
- Modify: `.env.example`, `eas.json`, `app.json`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/eas-preview.yml` (solo manual)
- Modify docs de la app

**Interfaces:**
- `apiBaseUrl()` devuelve la base v3 tal cual; no hay `apiV3BaseUrl` ni cliente `http` v2.
- `httpV3` se usa para clases, cursos, releases, cuentas y progreso.
- `eas.json` define `EXPO_PUBLIC_DATA_MODE=hybrid` y `EXPO_PUBLIC_API_URL=https://mlo-enrichment.vercel.app/api/mlo/v3` en preview y production.

**Steps:**
1. Cambiar `DataProvider` y `ContentSyncProvider` a `httpV3`.
2. Simplificar `client.ts`, borrar `http` y la conversión v2→v3; actualizar tests.
3. Actualizar `.env.example`, `eas.json` (preview y production) y documentar.
4. Añadir CI (jest, tsc, lint) y workflow manual de EAS preview.
5. `npx jest`, `npx tsc --noEmit`, `npm run lint`; commit.

### Task 6: Prueba HTTP de integración v3

**Files:**
- Create: `lib/api/e2e.db.test.ts`
- Modify: `package.json` (`test:db`)

**Interfaces:**
- Crea curso, unidad, tema, lección, release, clase y extra temporales.
- Invoca los handlers v3: preview, join, release y manifest.
- Limpia todo en `finally`.

**Steps:**
1. Sembrar datos con `publishCourse`/`publishClassRelease` y un profesor temporal.
2. Llamar `POST join` con UUID y nombre; comprobar 200.
3. Llamar `GET release` con `X-MLO-Student-Key`; comprobar 200 y contenido.
4. Llamar `GET courses` y `GET manifest`; comprobar el curso.
5. Limpiar y ejecutar `npm run test:db`; commit.

### Task 7: Documentación final

**Files:**
- Modify: `README.md`, `PLAN.md`, `DESPLIEGUE-GCLOUD.md`
- Modify: `D:\devvv\MLO\MLO-Ingenieria-software\docs\estado\*.md`, `README.md`
- Modify: `docs/contracts/mlo-v3.md` si menciona v2 como activo

**Steps:**
1. Estado actual, rutas, API v3, migraciones y tests.
2. Marcar documentos históricos y corregir `/clases` → `/grupos`.
3. Registrar la entrega en ambos historiales.
4. Revisar enlaces y comandos; commit.

### Task 8: Verificación final

- CMS: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:db` (si hay base).
- App: `npx jest --silent`, `npx tsc --noEmit`, `npm run lint`.
- Revisar que no queden referencias a `/api/mlo/v2` ni al cliente `http` v2.
- Revisar que no se haya disparado ningún build EAS.
