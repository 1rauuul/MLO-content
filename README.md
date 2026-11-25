# MLO · Maestros

Plan y estado del proyecto: [`PLAN.md`](PLAN.md).

Panel para que cada maestro agregue contenido propio (unidades, temas, lecciones,
ejercicios, ejemplos y evaluaciones) sobre el **contenido base** del curso o en un
curso completo. La app MLO descarga el resultado por la **API v3**
(`/api/mlo/v3`, contrato en [`docs/contracts/mlo-v3.md`](docs/contracts/mlo-v3.md)).

El contenido base se guarda una sola vez y es compartido. Un curso puede usarlo como
punto de partida o ser completamente autónomo; al publicar, el servidor guarda el
snapshot inmutable de su contenido.

## Estado (2026-11-26)

- **API v3 única.** La API v2 se retiró: las rutas viven solo en `/api/mlo/v3`. Los
  releases v2 históricos se conservan en la base, pero ya no se sirven.
- **Cursos y grupos.** Cursos con unidades, temas, lecciones, referencias, ejercicios,
  ejemplos y evaluaciones con preguntas. Los grupos (clases en la base) tienen código
  fijo de 6 caracteres, alumnos, contenido extra y publicación por snapshot. El panel
  usa `/grupos`; guardar el curso publica el curso y **Publicar grupo** publica su
  snapshot.
- **Cuentas de alumno.** Registro, login, logout, recuperación y vinculación de cuentas
  antiguas; progreso en la nube y listado de clases por alumno.
- **Operación.** Migraciones registradas (`schema_migrations`), rate limit en `join` y
  CORS configurable. CI ejecuta tests, lint, `tsc` y build.
- **Pendiente:** solo despliegue y operación (M5): dominio, secretos, respaldos y la
  prueba final en dispositivo con la app en modo `hybrid`.

## Puesta en marcha

Requisitos: Node 22+ y un proyecto de Supabase.

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env.local` y rellena:
   - `DATABASE_URL`: cadena del **pooler** de Supabase (puerto 6543).
   - `DATABASE_URL_DIRECT`: cadena directa (puerto 5432), opcional; `db:migrate`
     usa `DATABASE_URL`.
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (8–128 con mayúscula,
     minúscula, número y símbolo).
   - `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` y `APP_BASE_URL` para las invitaciones y
     la recuperación de contraseña por correo.
   - `MEDIA_SECRET` para firmar las URLs de `/api/media`.
   - `CORS_ALLOWED_ORIGIN` con el origen exacto de Expo web o del panel cuando corra en
     otro dominio (por ejemplo `https://mlo.example.com`). Sin ella, desarrollo permite
     `*` y producción no envía cabeceras CORS.
   - `MLO_ACCESS_CONTROL` solo si el curso base también debe exigir autorización.

3. Aplica las migraciones. Ya no se pegan una por una:

   ```bash
   npm run db:migrate            # aplica las pendientes y las registra
   npm run db:migrate -- --status
   ```

   En una base que ya tenía el esquema aplicado a mano, ejecuta **una sola vez** el
   baseline con corte hasta la última migración histórica y después aplica las nuevas:

   ```bash
   npm run db:migrate -- --baseline 20261125000005_recovery_delivery.sql
   npm run db:migrate
   ```

   El corte evita marcar como aplicadas las migraciones nuevas (por ejemplo, el rate
   limit de `class_join`). `npm run db:apply -- <archivo>` queda solo para casos puntuales.

4. Crea el administrador:

   ```bash
   npm run seed:admin
   ```

5. Importa el contenido base (el fixture ya está versionado):

   ```bash
   npm run import:base
   ```

6. Arranca:

   ```bash
   npm run dev
   ```

Entra en http://localhost:3000 con el correo y la contraseña del administrador. Desde
`/admin/maestros` podrás invitar a los maestros por correo; ellos crean su contraseña
desde el enlace.

Verificación rápida:

```bash
npm test        # descubre lib/**/*.test.ts y excluye los *.db.test.ts (186 pruebas)
npm run test:db # pruebas contra la base: rate limit, vinculación, recuperación, importación y E2E HTTP v3
npm run lint
npx tsc --noEmit
npm run build
```

El CI de GitHub Actions (`.github/workflows/ci.yml`) ejecuta `npm test`, `npm run lint`,
`npx tsc --noEmit` y `npm run build` en cada push y pull request. `npm run test:db`
requiere `DATABASE_URL` y no corre en CI.

Para regenerar el fixture desde el repo de MLO:

```bash
# desde D:\devvv\MLO\MLO-Ingenieria-software
npx tsx scripts/export-base.ts <ruta>/mlo-teachers/scripts/fixtures/base-course.json
```

Para regenerar el fixture que usa MLO en sus pruebas de contrato/motor:

```bash
npm run export:release -- base <ruta>/MLO-Ingenieria-software/src/shared/services/content/remote/__fixtures__/panelRelease.json
```

## Rutas

| Ruta | Quién | Qué hace |
|---|---|---|
| `/login` | público | Entrar y recuperar contraseña |
| `/invitacion` | público (token) | El maestro crea su contraseña |
| `/recuperar` | público | Pedir enlace de recuperación |
| `/restablecer` | público (token) | Elegir una contraseña nueva |
| `/join` | público | Abrir una invitación de alumno desde el correo |
| `/mis-cursos` | maestro | Contenido base (lectura) y cursos propios |
| `/mis-cursos/crear` | maestro | Alta de un curso |
| `/cursos/[id]` | maestro | Unidades, temas y lecciones; guardar publica el curso |
| `/cursos/[id]/lecciones/[lessonId]` | dueño | Editar texto, bloques e imágenes |
| `/cursos/[id]/temas/[topicId]` | dueño | Editar el tema y sus actividades |
| `/cursos/[id]/temas/[topicId]/evaluaciones/[evaluationId]` | dueño | Editar evaluación y preguntas |
| `/cursos/[id]/referencias` | dueño | Bibliografía del curso |
| `/grupos` | maestro | Crear grupos y ver sus códigos |
| `/grupos/[id]` | dueño / admin | Alumnos, código de vinculación y publicación del grupo |
| `/grupos/[id]/contenido` | dueño / admin | Lecciones, ejemplos, ejercicios y evaluaciones del grupo |
| `/grupos/[id]/contenido/{ejemplos,ejercicios}/[id]` | dueño / admin | Editar el contenido propio del grupo |
| `/contenido-extra` | dueño / admin | Aportaciones asignadas a uno o varios grupos |
| `/admin/maestros` | admin | Invitar maestros y reenviar invitaciones |

Los enlaces antiguos a `/clases` y `/grupos/[id]/publicar` ya no existen: los grupos
viven en `/grupos` y cada guardado del curso o del grupo publica su snapshot.

## API para MLO (v3)

Todas las rutas cuelgan de `/api/mlo/v3`. Las de lectura de contenido aceptan
`X-MLO-Student-Key` (identidad anónima) o `Authorization: Bearer` (cuenta de alumno).
Las de progreso y correo exigen Bearer. Las respuestas de contenido usan `Cache-Control`
corto; las de cuenta, `no-store`.

| Ruta | Qué hace |
|---|---|
| `GET /courses` | Cursos publicados y autorizados para el alumno |
| `GET /catalogs/{catalogId}/manifest` | Release v3 completo: unidades, temas, lecciones, actividades y referencias |
| `GET /classes/{code}` | Vista previa y última versión del grupo |
| `POST /classes/{code}/join` | Unir un alumno con UUID + nombre (429 si se supera el límite) |
| `DELETE /classes/{code}/members/{studentKey}` | Salir del grupo |
| `GET /classes/{code}/release` | Snapshot publicado del grupo |
| `POST /auth/register` | Alta con usuario, contraseña y nombre; devuelve token |
| `POST /auth/login` | Login; devuelve token Bearer |
| `POST /auth/logout` | Revoca la sesión |
| `POST /auth/link` | Vincular una cuenta local antigua con código de un solo uso |
| `POST /auth/recover` | Pedir código de recuperación por correo |
| `POST /auth/recover/verify` | Verificar el código y cambiar la contraseña |
| `GET/PUT /students/me/progress` | Progreso del alumno autenticado (máx. 2 MB) |
| `GET /students/me/classes` | Grupos del alumno autenticado |
| `PUT /students/me/email` | Agregar o cambiar el correo de la cuenta |
| `POST /invitations/claim` | Reclamar una invitación de alumno por token o código |

CORS: `CORS_ALLOWED_ORIGIN` define el origen permitido y se envía `Vary: Origin`.
Sin la variable, desarrollo abre `*` y producción no permite orígenes cruzados; hay que
definirla para Expo web y para el panel si corre en otro dominio. La API permite
`Content-Type`, `X-MLO-Student-Key` y `Authorization`.

`POST /classes/{code}/join` tiene rate limit de 100 peticiones por IP y 1000 globales
cada 15 minutos; al superarlo responde `429 rate_limited` y no crece la lista.

`404` si el curso no tiene release, el grupo no existe o no tiene nada publicado.
`409 unpublished` si el grupo aún no se ha publicado. El snapshot de grupo solo lleva
contenido extra; MLO lo combina con el curso y lo guarda localmente para funcionar sin
conexión. Hay un ejemplo del contrato en `scripts/fixtures/class-release.json`.

## Cuentas de alumno

Las cuentas nuevas usan scrypt y sesiones Bearer de 30 días guardadas en
`student_sessions`. La recuperación y la vinculación usan códigos de un solo uso; en la
base solo queda su SHA-256. El progreso se guarda por alumno en `student_progress`.

## Notas técnicas

- El cliente de Postgres usa `prepare: false` porque el pooler de Supabase en modo
  transacción no admite prepared statements.
- Las tablas viven en `public` con **RLS activado y sin políticas**: la API pública de
  Supabase no puede leerlas ni escribirlas. La app entra con el rol `postgres`, que no
  pasa por RLS.
- Las sesiones de maestro se guardan en la base; la cookie solo lleva un token
  aleatorio y en la base queda su SHA-256. Las sesiones de alumno usan Bearer y el
  mismo esquema de token hasheado.
- Las invitaciones de maestro y los enlaces de recuperación son tokens de un solo uso;
  en `teacher_tokens` solo queda su SHA-256. Reenviar o pedir otro invalida el anterior.
- `cacheComponents` está desactivado: el panel es dinámico y autenticado, PPR no aporta.
