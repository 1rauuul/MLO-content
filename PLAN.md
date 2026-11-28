# Plan del proyecto — MLO · Maestros

> Estado al **2026-11-27**. El detalle reciente vive en `MLO-Ingenieria-software/docs/estado/historial-cms.md`; este documento conserva el estado por hitos.

## 1. Objetivo

Panel web para que cada maestro cree cursos completos (unidades, temas, lecciones,
ejercicios, ejemplos y evaluaciones), con el **core** compartido como punto de partida o
sin él. La app MLO (`D:\devvv\MLO\MLO-Ingenieria-software`) descarga ese contenido por la
**API v3** (`/api/mlo/v3`) y lo aplica en el teléfono sin actualizar la app.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Stack | Next.js 16 (App Router) + React 19 + Tailwind 4, sin CMS |
| Base de datos | Supabase Postgres, conexión por el pooler (6543) |
| Core | Se guarda **una sola vez** y es compartido |
| Contenido del maestro | Cursos autónomos o **adiciones**; el core compartido no se edita desde un curso de maestro |
| Publicación | Snapshot inmutable (`release`) del curso; si usa el core, el release lo incluye |
| Ids publicados | `{key}-{contentId}`; el core conserva sus ids |
| Multimedia | Imágenes en Postgres con URL firmada y caché offline en MLO; video de YouTube embebido (requiere conexión) |
| Acceso | Admin gestiona todo y el core; maestro solo sus cursos y grupos |
| Registro | Sin registro público de maestros; el admin invita por correo y el maestro crea su contraseña |
| Contraseñas de maestro | Recuperación por enlace de un solo uso; política 8–128 con mayúscula, minúscula, número y símbolo |
| Grupos (clases) | Un maestro crea varios; código de 6 fijo desde la creación; el alumno puede estar en varios. La tabla es `classes`; `groups` se eliminó |
| Contenido extra | Bloques, ejemplos, ejercicios o evaluaciones sobre lecciones del curso; se asigna a uno o varios grupos |
| Publicación extra | Snapshot inmutable por grupo; MLO lo descarga y lo guarda para usar sin conexión |
| Identidad del alumno | UUID estable por persona + cuenta con usuario/contraseña en el CMS; el progreso se restaura al iniciar sesión |
| API pública | Solo v3 (`/api/mlo/v3`); v2 se retiró y sus releases quedan como datos históricos |

## 3. Arquitectura

### Stack y dependencias

- `next` 16.4.6, `react` 19.3.0, `tailwindcss` 4.
- `postgres` (driver, `prepare: false` por el pooler).
- `tsx` para scripts y tests.
- Auth propia: scrypt (`node:crypto`) + sesión en base + cookie httpOnly.

### Tablas

| Tabla | Contenido |
|---|---|
| `teachers` | Cuentas del panel (`admin` \| `maestro`) |
| `sessions` | Token hasheado y expiración |
| `courses` | `key` de 5 caracteres; `base` para el core |
| `units`, `topics`, `lessons` | Estructura, subtemas y texto/bloques |
| `evaluations`, `exercises`, `examples`, `questions` | Práctica, ejemplos y evaluación |
| `classes` | Clase del maestro y su código de 6 fijo |
| `students`, `class_members` | Identidad estable del alumno y sus membresías por clase |
| `student_accounts`, `student_sessions`, `student_auth_attempts` | Cuenta remota del alumno, sesiones Bearer y límite de intentos |
| `student_progress` | Respaldo v5 del progreso por alumno |
| `lesson_extras`, `extra_classes` | Contenido extra y las clases a las que se asigna |
| `releases_v3`, `class_releases_v3` | Versión, hash y snapshot inmutable v3 de curso y grupo |
| `releases`, `class_releases` | Releases v2 históricos; ya no se sirven por la API |
| `schema_migrations` | Archivos de migración ya aplicados y su fecha |

RLS activado sin políticas: la API pública de Supabase no puede leer las tablas; la app
entra con el rol `postgres`, que no pasa por RLS.

### Rutas del panel

| Ruta | Estado |
|---|---|
| `/login` | ✅ |
| `/mis-cursos` | ✅ |
| `/cursos/[id]` | ✅ |
| `/cursos/[id]/lecciones/[lessonId]` | ✅ |
| `/cursos/[id]/temas/[topicId]` | ✅ |
| `/cursos/[id]/temas/[topicId]/evaluaciones/[evaluationId]` | ✅ |
| `/cursos/[id]/referencias` | ✅ |
| `/grupos` | ✅ |
| `/grupos/[id]` | ✅ |
| `/grupos/[id]/contenido` | ✅ |
| `/contenido-extra` | ✅ |
| `/admin/maestros` | ✅ |
| `/join` | ✅ invitación de alumno desde el correo |

Guardar el curso publica el curso (no hay pantalla `/publicar`); **Publicar grupo**
publica el snapshot del grupo. Las rutas antiguas `/clases` ya no existen.

### API para MLO (v3 única)

Rutas propias bajo `/api/mlo/v3`:

- `GET /courses` — ✅ cursos publicados y autorizados
- `GET /catalogs/{catalogId}/manifest` — ✅ release v3 completo
- `GET /classes/{code}` — ✅ vista previa
- `POST /classes/{code}/join` — ✅ `{ studentKey, studentName }` con rate limit
- `DELETE /classes/{code}/members/{studentKey}` — ✅ salir
- `GET /classes/{code}/release` — ✅ último snapshot del grupo
- `POST /auth/*` — ✅ registro, login, logout, vinculación y recuperación
- `GET/PUT /students/me/progress`, `GET /students/me/classes`, `PUT /students/me/email` — ✅
- `POST /invitations/claim` — ✅ reclamar invitación por token o código

La API v2 se eliminó el 2026-11-26: ya no existen `/api/mlo/v2/**`. Las tablas
`releases` y `class_releases` se conservan como datos históricos/internos y la
publicación sigue escribiendo el release v2 de curso mientras haya lecciones.

Las rutas de catálogo leen el último release; nunca borradores ni documentos
sueltos. Devuelven `404` si el curso no tiene release. Los grupos leen su propio
`class_releases_v3`; también devuelven `404` si no hay nada publicado. El alumno descarga
cada grupo al que pertenece y lo guarda localmente para usarlo sin conexión.

### API de cuentas (v3)

- `POST /api/mlo/v3/auth/register` — alta con usuario, contraseña y nombre; token Bearer.
- `POST /api/mlo/v3/auth/login` — login; token Bearer.
- `POST /api/mlo/v3/auth/logout` — revoca la sesión.
- `GET/PUT /api/mlo/v3/students/me/progress` — progreso del alumno autenticado.
- `GET /api/mlo/v3/students/me/classes` — clases del alumno autenticado.

Las rutas de progreso y clases aceptan `Authorization: Bearer`; durante la transición
siguen aceptando `X-MLO-Student-Key`. Las cuentas usan scrypt y sesiones de 30 días; el
token se guarda hasheado en `student_sessions`.

## 4. Hitos y estado

| Hito | Estado | Entregable |
|---|---|---|
| **M0 · Fundación** | ✅ Completado y verificado | Esquema, auth, login, seed, alta de maestros |
| **M1 · Cursos y lecciones** | ✅ Completado y verificado | Crear curso/unidad/lección, editor de bloques, permisos |
| **M2 · Core y publicación** | ✅ Completado y verificado | Importar el core, componer, hashes y primer release |
| **M3 · Reactivos** | ✅ Completado | Ejercicios, ejemplos, evaluación y preguntas |
| **M4 · API y grupos** | ✅ Completado | Grupos, contenido extra, publicación por grupo y API v3; app adaptada |
| **M5 · Cierre** | 🟡 Solo despliegue/operación pendiente | Rate limit y CORS ✅; migraciones y CI ✅; falta desplegar y operar |

### M0 · Fundación — ✅

Hecho:

- Migración inicial con 10 tablas, restricciones e índices.
- Cliente de Postgres, hash de contraseñas, sesiones y cookie httpOnly.
- Login, guard de sesión, logout.
- Seed del administrador (`npm run seed:admin`).
- Alta de maestros desde `/admin/maestros`.

### M1 · Cursos y lecciones — ✅

Hecho:

- Crear curso con clave aleatoria de 5 caracteres.
- Crear unidades (número automático) y lecciones (código visible).
- Editor de lección: título, resumen, contexto, síntesis, código y bloques
  (`p`, `h`, viñetas, numerada, tabla).
- Core en solo lectura para maestros; el admin puede editarlo.
- Aislamiento por dueño en páginas y server actions.

### M2 · Core y publicación — ✅

Hecho:

- `scripts/export-base.ts` en el repo de MLO exporta el contenido empaquetado a
  `scripts/fixtures/base-course.json` (5 unidades, 25 lecciones, 3 evaluaciones,
  44 ejercicios, 3 ejemplos y 76 preguntas).
- Migraciones nuevas: tabla `examples` (ejemplos independientes), `questions.position`
  y `exercises.position`/`examples.position` para que el hash del release no dependa
  del orden de las consultas.
- `scripts/import-base.ts` (`npm run import:base`) crea/actualiza el curso `base` de
  forma idempotente y conserva los releases ya publicados.
- `lib/content/compose.ts`: core + adiciones; prefija `{key}-` en cursos de maestros y
  deja intactos los ids del core; valida evaluación sin preguntas e ids repetidos.
- `lib/content/serialize.ts`: contrato v2 con campos vacíos explícitos
  (`codeSample`, `contextTitle`, `contextBody`, `synthesis`, `correctOrder`,
  `options`, `answer`).
- `lib/content/hash.ts`: JSON canónico con claves ordenadas y SHA-256 por lección y
  por release.
- `lib/content/publish.ts`, `/cursos/[id]/publicar` y su acción: snapshot inmutable
  `{ manifest, lessons }` en `releases`, con bloqueo del curso para no repetir versión.
- 6 tests nuevos (10 en total): composición del core real, prefijos, campos vacíos,
  manifest estable, detección de ids repetidos y evaluación vacía.
- Verificación contra MLO: las 25 lecciones del release pasan
  `validateLessonPayload` y sus hashes coinciden con el manifest.
- Primer release del core: versión **1**, 25 lecciones, hash
  `c33cad9e397d6fc2bf88e81c2b7c9ebad72d7862c25d178a06718e3dac89d2f3`.
  Publicar dos veces el mismo contenido produce el mismo hash.

Criterio de terminado: `build`, `lint` y tests verdes; el release del core coincide
con el contenido incluido en MLO. ✅

### M3 · Reactivos — ✅

#### M3A · Ejercicios y ejemplos — ✅

Hecho:

- Pestañas **Contenido · Ejercicios · Ejemplos** en la página de la lección.
- CRUD de ejercicios propios para `order`, `fill`, `match` y `crossword`.
- Switch **“Añadir como ejemplo”**: revela título, pasos (`text`/`why`) y pistas y los
  guarda en `exercises.example`. Al desactivarlo se borra solo el bloque de ejemplo.
- CRUD de ejemplos independientes en la tabla `examples`.
- Tres formas verificadas: ejercicio solo, ejercicio + ejemplo y ejemplo independiente.
- Vista previa estática de cada reactivo, incluida una cuadrícula del crucigrama.
- Ids legibles: `ord1.2-1`, `fill1.2-1`, `match1.2-1`, `cross1.2-1` y `ex1.2-1`.
- `lib/content/validate.ts`: reglas por tipo, ejemplos, preguntas, bloques y evaluación;
  se usa al guardar y otra vez al publicar (modo estricto).
- La publicación rechaza el release si un reactivo no cumple.
- El admin puede editar el core; un maestro solo sus lecciones.
- 7 tests nuevos (17 en total) con el fixture real del core.
- E2E: los tres modos en la lección `1.5`, edición, desactivar el ejemplo, publicar un
  release de 26 lecciones y validarlo con `validateLessonPayload` de MLO.
- Datos de prueba eliminados. La unidad del curso de prueba se renumeró de `u1` a `u6`
  porque se había creado antes de importar el core y chocaba con la unidad 1.

#### M3B · Evaluación y preguntas — ✅

Hecho:

- Editor de evaluación propia por tema (título, descripción, `questionCount`,
  `exerciseCount`).
- Preguntas `mcq`, `order`, `fill`, `match` y `crossword`, y evaluaciones de puras
  preguntas.
- Actividades directas al tema, sin exigir lección.
- Ids `ev1.2` y `ev1.2-q1`; vista previa y validación al guardar.
- La validación estricta al publicar rechaza una evaluación sin preguntas y los
  reactivos inválidos.

### M4 · API y grupos — ✅

#### M4A · Grupos y contenido extra (panel) — ✅

Hecho:

- `GET /api/mlo/v3/catalogs/{catalogId}/manifest` (release v3 completo). La API v2 y
  su endpoint por lección se retiraron; el release v2 queda como dato histórico.
- Lee solo el último release; `404` para curso sin release; `Cache-Control` corto.
- Prueba HTTP real: el release base de 25 lecciones y 3 ejemplos independientes pasa
  `parseCatalogManifest` y `validateLessonPayload` desde MLO.
- Migración `20261027000004_classes.sql`: `classes`, `students`, `class_members`,
  `lesson_extras`, `extra_classes` y `class_releases`; se eliminó `groups`.
- `/grupos` y `/grupos/[id]`: crear grupo, código fijo de 6, alumnos, contenido y
  publicación por grupo. `/grupos/[id]/contenido` edita las actividades propias.
- `/contenido-extra`: agregar bloques, ejemplos, ejercicios o evaluaciones a una
  lección del curso y asignarlos a uno o varios grupos. Usan los mismos tipos y
  validadores que el contenido del curso.
- Publicación por grupo: snapshot inmutable con solo lo asignado a ese grupo; un
  contenido compartido entra en el snapshot de cada grupo al publicarlo. Los cambios
  en borrador no llegan al alumno hasta republicar.
- `GET /api/mlo/v3/classes/{code}`, `POST .../join`, `DELETE .../members/{studentKey}`
  y `GET .../release`.
- Fixture del contrato en `scripts/fixtures/class-release.json`.
- Identidad del alumno por UUID estable + nombre; el panel guarda alumno y membresía
  sin crear cuentas.
- 9 tests nuevos (30 en total) de composición, hash estable, asignación múltiple,
  snapshot vacío, validación de extras y fixture del contrato.

Hecho del lado de MLO:

- `accounts.external_key` (UUID estable), `account_classes`, `class_cache` y
  `class_extras_cache` en SQLite.
- Perfil con varios grupos, unirse/salir y sincronización del release de cada grupo.
- Bloques extra debajo de la lección; ejercicios extra en la práctica y ejemplos
  extra en su flujo, con la etiqueta del grupo.
- Respaldo v4: restaura el UUID y los grupos, vuelve a unir con la identidad
  original y retira la temporal para no duplicar al alumno.
- Fixture real del panel validado con `parseClassRelease`.

Pendiente de operación:

- Prueba desde la app MLO con `EXPO_PUBLIC_DATA_MODE=hybrid` en un dispositivo.
- Caché por `catalog:{id}` en producción.

### M5 · Cierre — 🟡

Hecho:

- Rate limit de `classes/{code}/join` (100 por IP y 1000 globales cada 15 min).
- CORS configurable con `CORS_ALLOWED_ORIGIN` y `Vary: Origin`.
- Migraciones registradas: `db:migrate`, `--status` y `--baseline`.
- CI de test, lint, `tsc` y build; prueba E2E HTTP de la API v3.
- Documentación de estado, contrato y despliegue actualizada.

Pendiente (solo despliegue/operación):

- Desplegar en Vercel + Supabase (o Cloud Run + Cloud SQL) con dominio y secretos.
- Definir `CORS_ALLOWED_ORIGIN`, `MEDIA_SECRET` y `APP_BASE_URL` en producción.
- Manual del maestro y prueba final en dispositivo.

## 5. Verificación

### Automática

Estado al 2026-11-26:

| Comando | Resultado |
|---|---|
| `npm test` | 186 pruebas (descubiertas de `lib/**/*.test.ts`) |
| `npm run test:db` | 13 pruebas contra la base: rate limit, vinculación, recuperación, importación base y E2E HTTP v3 |
| `npm run test:e2e` | Build + `next start` real: enrutado, CORS y flujo v3 |
| `npm run lint` | Sin errores |
| `npx tsc --noEmit` | Sin errores |
| `npm run build` | Compila |
| CI (`.github/workflows/ci.yml`) | `test`, `lint`, `tsc` y `build` en cada push y PR |

#### Historial (2026-10-27)

Ejecutada el 2026-10-27:

| Comando | Resultado |
|---|---|
| `npm test` | 30/30 |
| `npm run lint` | Sin errores |
| `npm run build` | Compila; 18 rutas |
| `npx tsc --noEmit` | Sin errores |
| `npm run db:apply -- <migración>` | 4 migraciones nuevas aplicadas |
| `npm run import:base` | 5 unidades, 25 lecciones, 3 evaluaciones, 44 ejercicios, 3 ejemplos, 76 preguntas; dos ejecuciones seguidas sin duplicar |
| Release del core vs. MLO | 25/25 lecciones pasan `validateLessonPayload`; hashes del manifest coinciden |

El mismo contenido publicado dos veces produjo el mismo hash
(`c33cad9e397d6fc2bf88e81c2b7c9ebad72d7862c25d178a06718e3dac89d2f3`).

### Manual (navegador, contra la base real)

Registro histórico del 2026-10-27; entonces la API era v2 y las clases vivían en
`/clases`. Esas rutas ya no existen, pero el resultado de cada prueba se conserva.

| Prueba | Resultado |
|---|---|
| Login admin / maestro | ✅ |
| Contraseña incorrecta | ✅ error, sin entrar |
| Logout | ✅ |
| Crear curso / unidad / lección | ✅ |
| Código de lección duplicado | ✅ rechazado |
| Editar lección y bloque, recargar | ✅ persiste |
| Crear maestro | ✅ |
| Maestro no ve curso ajeno | ✅ |
| Acceso directo a curso ajeno | ✅ 404 |
| Maestro en `/admin/maestros` | ✅ 404 |
| Curso `base` visible con 25 lecciones | ✅ |
| `/cursos/[id]/publicar` muestra la última versión | ✅ versión 1 |
| Botón Publicar crea una versión nueva | ✅ versión 2, mismo hash |
| Snapshot inmutable en `releases` | ✅ 25 lecciones |
| Crear ejercicio solo (`order`) | ✅ `ord1.5-1` |
| Crear ejercicio + ejemplo (`fill`) | ✅ `fill1.5-1` con `example` |
| Crear ejemplo independiente (`match`) | ✅ `ex1.5-1` |
| Editar y desactivar “Añadir como ejemplo” | ✅ persiste tras recargar |
| Publicar curso de maestro | ✅ 26 lecciones y prefijo `d3fb4-` |
| Release del maestro validado por MLO | ✅ 26/26 lecciones |
| Release base aplicado en MLO | ✅ 25/25 lecciones y 3 ejemplos independientes |
| Motor de ejemplos de MLO | ✅ 55 suites / 353 tests; `exA1.2` visible |
| Ejercicio inválido al publicar | ✅ rechazado; no se creó release |
| Ejemplo independiente `order` en el panel | ✅ no aparece en el selector y se rechaza |
| API v2: manifest base | ✅ 200, 25 lecciones |
| API v2: las 25 lecciones | ✅ 200, validan con MLO |
| API v2: curso y lección inexistentes | ✅ 404 |
| API v2: ejemplos independientes | ✅ 3 en el release base |
| Crear clase y código fijo | ✅ 6 caracteres, visible en `/clases` |
| Contenido extra tipo bloque | ✅ guardado en la lección `1.1` |
| Contenido extra tipo ejercicio | ✅ asignado a 2 clases, guardado como `order` |
| Contenido extra tipo ejemplo | ✅ `match` con 2 pares y un paso |
| Publicar clase A | ✅ v1 → v4; snapshot con 2 lecciones |
| Publicar clase B | ✅ v1 → v2; solo recibe lo asignado |
| Contenido compartido por 2 clases | ✅ aparece en el snapshot de ambas |
| Editar y publicar solo A | ✅ A recibe el cambio; B conserva la versión anterior |
| Alumno se une con UUID | ✅ nombre visible en la lista de la clase |
| Alumno vuelve a unirse | ✅ idempotente, sin duplicar |
| Alumno sale de la clase | ✅ 204, deja de aparecer en la lista |
| API v2: clase inexistente o UUID inválido | ✅ 404 / 400 |
| Publicar extra inválido | ✅ rechazado; no se creó versión |

Datos temporales de la prueba eliminados: se borró el administrador temporal, los
ejercicios/ejemplos de prueba y el release del curso de prueba; el core quedó en la
versión 1. El curso `IS-AGDC-2026` quedó con 1 unidad (renumerada `u6`) y 1 lección.

## 6. Fuera de alcance

- PWA.
- Borradores e historial por documento.
- Que el maestro modifique el core en su curso.
- Calificaciones normalizadas y reportes de progreso para el docente.
- Expulsar alumnos desde el panel y publicación masiva de todas las clases.
- Edición offline.

## 7. Riesgos y límites

- **M2 fue el punto delicado:** composición, prefijos y hashes. Ya hay tests de ida y
  vuelta y el release del core se validó con el validador real de MLO. Cualquier cambio
  futuro en el contrato debe volver a pasar esa validación.
- **Release base parcial:** MLO archiva lo que no venga en el manifest. Publicar el core
  sin importar antes `base-course.json` dejaría el curso incompleto.
- **Migraciones:** `npm run db:migrate` aplica solo las pendientes, una transacción por
  archivo, y las registra en `schema_migrations`. En una base existente hay que
  ejecutar una sola vez el baseline con corte
  (`--baseline 20261125000005_recovery_delivery.sql`) y después `db:migrate`; así no se
  saltan las migraciones nuevas. `db:apply` queda para casos puntuales; ya no se aplican
  archivos a mano uno por uno.
- **Ejemplos independientes en MLO:** el motor ya los envuelve como `Exercise` y los
  añade a `items` sin tocar el sorteo de práctica. Hay pruebas con el release real del
  panel (`panelRelease.json`): 25 lecciones aplicadas y `exA1.2` visible. Falta la
  prueba en la app en `hybrid`. El plan está en
  `D:\devvv\MLO\MLO-Ingenieria-software\docs\planes\PLAN-ejemplos-independientes.md`.
  El panel bloquea el tipo `order` para ejemplos independientes.
- **CORS y rate limit:** resueltos. `CORS_ALLOWED_ORIGIN` define el origen permitido y
  `join` limita a 100 peticiones por IP y 1000 globales cada 15 minutos (429). En
  producción hay que definir la variable para Expo web.
- **API v2 retirada:** cualquier cliente que aún llame a `/api/mlo/v2` deja de
  funcionar. Las releases v2 quedan en la base como historial, pero no se sirven.
- **Código de grupo:** es la única llave para leer el snapshot del grupo. Si se filtra,
  cualquiera con el código puede descargar el contenido (no los nombres de los alumnos).
- **Identidad del alumno:** el UUID vive en la cuenta local de MLO y debe viajar en el
  respaldo. Sin respaldo, una reinstalación crea otra identidad y el alumno aparece
  duplicado en la lista del grupo.
- **Contenido extra publicado:** editar el borrador no cambia lo que ve el alumno hasta
  volver a publicar ese grupo.
- **Unidades creadas antes del core:** una unidad con `content_id` `u1` choca con la
  unidad 1 del core. `createUnit` ya numera después del core; los cursos antiguos hay
  que renumerarlos. El curso de prueba se corrigió (`u6`).
- **Cobertura de tests:** 186 pruebas de bloques, composición, serialización, hashes,
  validación, API v3, auth y migraciones; `test:db` cubre rate limit, vinculación,
  recuperación, importación y el flujo HTTP v3. El recorrido manual sigue siendo la
  verificación final.
- **Orden del contenido:** ejercicios y ejemplos necesitan `position`; sin ella el hash
  del release podía cambiar sin cambios de contenido.
- **Core editable por el admin:** un maestro no puede tocar el core, pero el admin sí
  puede añadir o editar ejercicios del core; esos cambios se publican en el release
  del core y llegan a todos los cursos.
- **Contraseña de la base expuesta en el chat:** si el historial se comparte, conviene
  rotarla en Supabase y actualizar `.env.local`.
- **Supabase gratuito se pausa** tras días sin actividad; para producción hace falta un
  plan de pago.

## 8. Cómo ejecutar

```bash
npm install
npm run dev          # http://localhost:3000
npm run test         # descubre lib/**/*.test.ts (186 pruebas)
npm run test:db      # pruebas contra la base (requiere DATABASE_URL)
npm run lint
npx tsc --noEmit
npm run build
npm run seed:admin   # requiere ADMIN_* en .env.local
npm run import:base  # importa scripts/fixtures/base-course.json
npm run export:release -- base <ruta>/MLO.../panelRelease.json
npm run db:migrate -- --status  # lista las migraciones pendientes
npm run db:migrate              # aplica las pendientes y las registra
```

En una base nueva basta `npm run db:migrate`. En una base existente que ya tenía el
esquema aplicado, ejecuta **una sola vez** el baseline con corte hasta la última
migración histórica y después aplica las nuevas:

```bash
npm run db:migrate -- --baseline 20261125000005_recovery_delivery.sql
npm run db:migrate
```

Las migraciones ya no se aplican a mano una por una.

`scripts/export-base.ts` vive en el repo de MLO. Para regenerar el fixture:

```bash
# desde D:\devvv\MLO\MLO-Ingenieria-software
npx tsx scripts/export-base.ts <ruta>/mlo-teachers/scripts/fixtures/base-course.json
```

Variables en `.env.local` (no versionado): `DATABASE_URL`, `DATABASE_URL_DIRECT`,
`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`,
`APP_BASE_URL`, `MEDIA_SECRET` y `CORS_ALLOWED_ORIGIN`. `MLO_ACCESS_CONTROL` y
`MLO_LOCAL_URL` son opcionales.

El CI (`.github/workflows/ci.yml`) ejecuta `npm test`, `npm run lint`, `npx tsc --noEmit`
y `npm run build` en cada push y pull request.

## 9. Flujo de trabajo

1. Yo implemento el hito y corro `test`, `lint`, `build` y la pasada E2E en el navegador.
2. Corrijo lo que falle y limpio los datos de prueba.
3. Te paso el hito con el resumen de pruebas para que tú hagas la aceptación final.
4. No avanzo al siguiente hito hasta que esté verde.

## 10. Registro

| Fecha | Cambio |
|---|---|
| 2026-10-27 | M0 y M1 implementados, migración aplicada, seed ejecutado, E2E aprobada y datos de prueba limpiados. Servidor detenido. |
| 2026-10-27 | M2 implementado: export/import del core, composición, contrato v2, hashes, pantalla Publicar y release 1 del core validado con MLO. E2E de publicación aprobada y datos temporales limpiados. |
| 2026-10-27 | M3A implementado: pestañas de la lección, CRUD de ejercicios, “Añadir como ejemplo”, ejemplos independientes, vista previa y validación estricta al publicar. E2E de los tres modos y release de maestro validado con MLO. Datos de prueba limpiados. |
| 2026-10-27 | Fase 0: los ejemplos independientes de tipo `order` quedan bloqueados en el panel. M4 parcial: rutas de manifest y lección implementadas y validadas desde MLO contra el release base. Grupos y CORS pendientes. |
| 2026-10-27 | Motor de ejemplos de MLO corregido: los independientes se muestran sin tocar el sorteo de práctica. Fixture `panelRelease.json` del release base aplicado en MLO (25 lecciones, 3 ejemplos); 353 tests de MLO en verde. Falta la prueba en la app en `hybrid`. |
| 2026-10-27 | M4A implementado: clases con código fijo, contenido extra por clase, publicación por snapshot, alumnos por UUID y endpoints de clases. Migración aplicada, 30 tests en verde, E2E con dos clases y contenido compartido verificado. Datos de prueba limpiados. |
| 2026-10-27 | MLO adaptado: identidad `external_key`, caché de clases, perfil con varias clases, contenido extra en lecciones/práctica/ejemplos y respaldo v4 con reconciliación de duplicados. 363 tests de MLO, fixture real del panel validado y datos temporales del panel eliminados. Falta la prueba en dispositivo en `hybrid`. |
| 2026-11-13 | Flujo del doc «CMS flujo»: **Guardar** publica el curso y confirma en un pop up (se eliminó `/cursos/[id]/publicar`); **Publicar grupo** confirma en un pop up; cards de grupos compactas (3 columnas, orden por más nuevos); numeración `unidad.subtema` en grupo, cabecera del subtema y selector de Contenido adicional; la unión a un grupo y las invitaciones exigen una publicación previa (`409 unpublished`, mensaje propio en MLO). 128 tests del panel y 23 del contrato de MLO en verde. |
| 2026-11-16 | Invitaciones por correo: código de respaldo en el correo (texto y HTML), historial de entrega persistido (`sent_at`/`delivery_error`) y límite de 60 altas por hora y docente. Migración `20261116000000_invitation_delivery_rate.sql` aplicada. 130 tests en verde. |
| 2026-11-16 | Evaluaciones arregladas: faltaba aplicar `20261111000001_topic_direct_activities.sql` en la base (lesson_id seguía NOT NULL), así que crear evaluación/pregunta fallaba con `23502`. Migración aplicada y verificada; la base ya acepta actividades directas al subtema. Además `createEvaluation`/`saveQuestion` devuelven el error al formulario y la publicación rechaza una evaluación sin preguntas. 129 tests en verde. |
| 2026-11-16 | Referencia visual en el editor de ejercicios y ejemplos: botón **Ver muestra** con una actividad completa por tipo (ordenar, completar, relacionar, crucigrama), chips ①–⑥ ligados a los campos y **Usar esta muestra** para copiarla al formulario. Las muestras viven en `lib/content/samples.ts` y un test las valida con las reglas estrictas de publicación. La vista previa del crucigrama ahora muestra las pistas con H1/V1. 131 tests en verde. |
| 2026-11-18 | Editor de contenido del grupo: lista unificada de lecciones, ejemplos, ejercicios y evaluaciones; editores propios con vista previa interactiva; `class_content_changes` con triggers y tarjeta de versión con subtemas pendientes; edición de estructura desde el grupo; enlaces de vuelta seguros y pop ups centrados. En la app: portada con logos CINVESTAV, perfil con "Mostrar curso base", salir del curso, lección de una sola pantalla y unidad de grupo restaurada. 145 tests del panel y 581 de la app. |
| 2026-11-24 | Cuentas de alumno en el CMS y progreso en la nube: `student_accounts`, `student_sessions` y `student_auth_attempts`; auth scrypt con sesiones Bearer de 30 días y límite de intentos; endpoints `/api/mlo/v3/auth/*`; progreso y clases con Bearer (y header legacy); `student_progress` con límite de 2 MB. Pulido del panel (confirmaciones, campos obligatorios, 404, icono) y limpieza de pruebas. En la app: token y `remote_session` en SQLite v24 (v23 más `accounts.email`), restauración y sincronización automática del progreso, vinculación de cuentas antiguas. 157 tests del panel y 541 de la app. |
| 2026-11-25 | Rate limits por IP para aulas (login de alumno 300, registro 100, vinculación 100 y login de docente 60; ventana de 15 min), con prueba real del limiter contra la base (`test:db`) e índice `auth_rate_limits_created_idx`. Código de vinculación desde `/grupos/[id]` (6 dígitos, 30 min, hasheado, uno pendiente por alumno, solo docente dueño o admin) e insignia “En la nube” según `hasAccount` de `student_accounts`. Recuperación con guardado previo al envío (`sent_at`): solo `sent_at is not null` es utilizable, un fallo conserva el código anterior y no deja filas pendientes, y dos solicitudes concurrentes envían un solo correo. Migraciones `20261125000004` y `20261125000005`. En la app: `needsRemoteLink` por existencia de `remote_session` y `DATABASE_VERSION` 24. Revisión final: las respuestas de recuperación son genéricas (un correo inexistente y un envío fallido devuelven lo mismo; `email_unavailable` queda solo para fallos de configuración), el reenvío de invitación se serializa con el bloqueo del maestro y una fila de sesión sin token muestra “sesión caducada” con el botón de sincronizar deshabilitado. 184 tests del panel (`test:db` 11/11) y 579 de la app. |
| 2026-11-26 | Cierre pre-deadline: **API pública solo v3** (se eliminaron las rutas `/api/mlo/v2`; las clases viven en `/grupos`), rate limit de `join` (100 por IP y 1000 globales cada 15 min), CORS con `CORS_ALLOWED_ORIGIN`, migraciones registradas con `db:migrate`/`--status`/`--baseline` y descubrimiento automático de tests. `npm test` queda en 186 pruebas y `test:db` en 13 (incluye la E2E HTTP v3 de preview/join/release/manifest). CI con test, lint, tsc y build. En la app: cliente único v3, token en `expo-secure-store` con migración desde SQLite, CI y perfiles EAS preview/production; no se generó build. |
| 2026-11-27 | Iconos de curso y rediseño de la experiencia. Panel: catálogo de 30 iconos (7 PNG y el resto SVG), migración `courses.icon` (`20261127000000_course_icon.sql`), selector en la creación del curso, lista de cursos v3 con `icon`/`level` y descripción real en el release. App: tarjetas compactas con nivel/descripción/progreso, ficha con icono, progreso por subtema, evaluación con desglose y revisión de respuestas, feedback en completar/relacionar/crucigrama, `ContinuationButton`, `DisclosureRow` y animación de entrada; `DATABASE_VERSION` 25 (`remote_courses.icon/level`) y `versionCode` 14. CMS 188 pruebas + 13 de base; app 615 pruebas; `tsc`, lint y build en verde. Cambios **sin commit** en ambos repos. |
