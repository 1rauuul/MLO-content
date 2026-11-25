# Tarea 3: registro de migraciones y descubrimiento de tests — informe

Fecha: 2026-11-25
Rama: `chore/pre-deadline-cleanup`
Commit: `feat(db): registrar migraciones y descubrir tests automaticamente`

## Estado

Completado. No se hizo push ni merge.

## Cambios

- `supabase/migrations/20261126000000_schema_migrations.sql`: tabla
  `schema_migrations (filename primary key, applied_at)`.
- `lib/migrations.ts` + `lib/migrations.test.ts`: `pendingMigrations` filtra `.sql`,
  ordena por nombre y omite las aplicadas.
- `scripts/migrate.ts`:
  - bootstrap de `schema_migrations` desde su propio archivo;
  - `npm run db:migrate` aplica cada pendiente en su transacción, quita `begin;` /
    `commit;` y registra el filename;
  - `--baseline` registra todos los archivos actuales sin ejecutarlos;
  - `--status` lista pendientes;
  - si un archivo falla, imprime `Migración fallida: <archivo>` y aborta sin seguir.
- `package.json`: `test` usa `scripts/run-tests.ts`; nuevo `db:migrate`. `db:apply` y
  `test:db` se conservan.
- `scripts/test-files.ts`, `scripts/run-tests.ts`, `lib/test-files.test.ts`:
  - descubre `lib/**/*.test.ts`, excluye `*.db.test.ts` y ejecuta con
    `node --import tsx --test`.
- `.github/workflows/ci.yml`: Node 22, `npm ci`, `npm test`, `npm run lint`,
  `npx tsc --noEmit`, `npm run build`. Sin base de datos ni `test:db`.
- Documentación actualizada en `README.md`, `PLAN.md` y `DESPLIEGUE-GCLOUD.md`.

## Verificación

- `npm test`: 185 tests, 185 pass, 0 fail. Incluye `lib/migrations.test.ts` y
  `lib/test-files.test.ts`; no ejecuta `*.db.test.ts`.
- `npm run lint`: sin errores.
- `npx tsc --noEmit`: sin errores.
- `npm run build`: compila (Next.js 16.4.6, 10 páginas estáticas/dinámicas correctas).
- `npm run db:migrate -- --status`: funciona; creó la tabla `schema_migrations` vacía
  en la base configurada y listó 32 archivos pendientes.
- No se ejecutó `--baseline` ni se aplicó ninguna migración sobre la base real.
- `npm run test:db` no se ejecutó (no era necesario para esta tarea).

## Riesgos y notas

- **Base existente sin baseline:** la base de desarrollo actual ya tiene el esquema
  aplicado a mano, pero `schema_migrations` sigue vacía. Antes de usar
  `npm run db:migrate` sobre ella hay que ejecutar una sola vez
  `npm run db:migrate -- --baseline`. Hasta entonces `--status` seguirá mostrando los
  32 archivos como pendientes. No se ejecutó el baseline para no marcar como aplicado
  algo que no se pudo verificar objeto por objeto.
- **Conexión:** `db:migrate` usa `DATABASE_URL` (pooler), igual que `db:apply`. La
  conexión directa (`DATABASE_URL_DIRECT`) resolvió solo IPv6 y dio timeout en este
  entorno; se documentó como opcional y no la usa el runner.
- **CI sin base:** el build no necesita variables de entorno porque `db()` es perezoso
  y las rutas que consultan la base son dinámicas.
- **`test:db` sigue explícito:** incluye `lib/import-base.db.test.ts`; el
  descubrimiento automático no lo toca.
