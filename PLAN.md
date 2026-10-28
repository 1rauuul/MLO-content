# Plan del proyecto — MLO · Maestros

> Estado al **2026-10-27**. Este documento es la fuente de verdad del avance.

## 1. Objetivo

Panel web para que cada maestro agregue **contenido propio** (unidades, lecciones y, más
adelante, ejercicios y evaluaciones) sobre el **core** del curso. La app MLO
(`D:\devvv\MLO\MLO-Ingenieria-software`) descarga ese contenido por el contrato v2 y lo
aplica en el teléfono sin actualizar la app.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Stack | Next.js 16 (App Router) + React 19 + Tailwind 4, sin CMS |
| Base de datos | Supabase Postgres, conexión por el pooler (6543) |
| Core | Se guarda **una sola vez** y es compartido |
| Contenido del maestro | Solo **adiciones**; no puede editar ni borrar el core |
| Publicación | Snapshot inmutable (`release`) que compone core + adiciones |
| Ids publicados | `{key}-{contentId}`; el core conserva sus ids |
| Multimedia | Pospuesta: el contrato v2 no tiene bloque de imagen |
| Acceso | Admin gestiona todo y el core; maestro solo sus cursos y clases |
| Registro | Sin registro público; el admin crea las cuentas |
| Clases | Un maestro crea varias; código de 6 fijo desde la creación; el alumno puede estar en varias |
| Contenido extra | Bloques, ejemplos o ejercicios sobre lecciones del core; se asigna a una o varias clases |
| Publicación extra | Snapshot inmutable por clase; MLO lo descarga y lo guarda para usar sin conexión |
| Identidad del alumno | UUID estable por persona (viaja en el respaldo) + nombre; sin cuenta en el servidor |
| Grupos | Reemplazados por clases; la tabla `groups` se eliminó |

## 3. Arquitectura

### Stack y dependencias

- `next` 16.4.3, `react` 19.3.0, `tailwindcss` 4.
- `postgres` (driver, `prepare: false` por el pooler).
- `tsx` para scripts y tests.
- Auth propia: scrypt (`node:crypto`) + sesión en base + cookie httpOnly.

### Tablas

| Tabla | Contenido |
|---|---|
| `teachers` | Cuentas del panel (`admin` \| `maestro`) |
| `sessions` | Token hasheado y expiración |
| `courses` | `key` de 5 caracteres; `base` para el core |
| `units`, `lessons` | Estructura y texto/bloques |
| `evaluations`, `exercises`, `examples`, `questions` | Práctica, ejemplos y evaluación |
| `classes` | Clase del maestro y su código de 6 fijo |
| `students`, `class_members` | Identidad estable del alumno y sus membresías por clase |
| `lesson_extras`, `extra_classes` | Contenido extra y las clases a las que se asigna |
| `class_releases` | Versión, hash y snapshot inmutable de una clase |
| `releases` | Versión, hashes y snapshot JSON inmutable del curso |

RLS activado sin políticas: la API pública de Supabase no puede leer las tablas; la app
entra con el rol `postgres`, que no pasa por RLS.

### Rutas del panel

| Ruta | Estado |
|---|---|
| `/login` | ✅ |
| `/mis-cursos` | ✅ |
| `/cursos/[id]` | ✅ |
| `/cursos/[id]/lecciones/[lessonId]` | ✅ |
| `/cursos/[id]/publicar` | ✅ |
| `/clases` | ✅ |
| `/clases/[id]` | ✅ |
| `/contenido-extra` | ✅ |
| `/admin/maestros` | ✅ |
| `/grupos` | Redirige a `/clases` |

### API para MLO (contrato v2)

Rutas propias bajo `/api/mlo/v2`:

- `GET /catalogs/{catalogId}/manifest` — ✅
- `GET /catalogs/{catalogId}/lessons/{lessonId}` — ✅
- `GET /classes/{code}` — ✅ vista previa
- `POST /classes/{code}/join` — ✅ `{ studentKey, studentName }`
- `DELETE /classes/{code}/members/{studentKey}` — ✅ salir
- `GET /classes/{code}/release` — ✅ último snapshot de la clase

Las rutas de catálogo leen el último `release`; nunca borradores ni documentos
sueltos. Devuelven `404` si el curso no tiene release o la lección no está en el
snapshot. Las clases leen su propio `class_release`; también devuelven `404` si no
hay nada publicado. El alumno descarga cada clase a la que pertenece y la guarda
localmente para usarla sin conexión.

## 4. Hitos y estado

| Hito | Estado | Entregable |
|---|---|---|
| **M0 · Fundación** | ✅ Completado y verificado | Esquema, auth, login, seed, alta de maestros |
| **M1 · Cursos y lecciones** | ✅ Completado y verificado | Crear curso/unidad/lección, editor de bloques, permisos |
| **M2 · Core y publicación** | ✅ Completado y verificado | Importar el core, componer, hashes y primer release |
| **M3 · Reactivos** | 🟡 M3A ✅ · M3B siguiente | Ejercicios y ejemplos editables; falta evaluación y preguntas |
| **M4 · API y clases** | 🟡 Catálogos y panel de clases ✅ · MLO siguiente | Clases, contenido extra, publicación por clase y endpoints; falta adaptar MLO |
| **M5 · Cierre** | ⬜ Pendiente | Rate limit, CORS, despliegue, documentación |

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

### M3 · Reactivos — 🟡

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

#### M3B · Evaluación y preguntas — ⬜ siguiente

- Editor de evaluación propia (título, descripción, `questionCount`, `exerciseCount`).
- Preguntas `mcq`, `order`, `fill`, `match` y `crossword`.
- Ids `ev1.2` y `ev1.2-q1`.
- Vista previa y validación al guardar.
- La validación estricta al publicar ya existe desde M3A.

### M4 · API y clases — 🟡

#### M4A · Clases y contenido extra (panel) — ✅

Hecho:

- `GET /api/mlo/v2/catalogs/{catalogId}/manifest` y
  `GET /api/mlo/v2/catalogs/{catalogId}/lessons/{lessonId}`.
- Leen solo el último `release`; `404` para curso sin release o lección fuera del
  snapshot; `Cache-Control` corto.
- Prueba HTTP real: el release base de 25 lecciones y 3 ejemplos independientes pasa
  `parseCatalogManifest` y `validateLessonPayload` desde MLO.
- Migración `20261027000004_classes.sql`: `classes`, `students`, `class_members`,
  `lesson_extras`, `extra_classes` y `class_releases`; se eliminó `groups`.
- `/clases` y `/clases/[id]`: crear clase, código fijo de 6, alumnos, contenido y
  publicación por clase. `/grupos` redirige a `/clases`.
- `/contenido-extra`: agregar bloques, ejemplos o ejercicios a una lección del core y
  asignarlos a una o varias clases. Los ejercicios extra usan los mismos tipos y
  validadores que los existentes.
- Publicación por clase: snapshot inmutable con solo lo asignado a esa clase; un
  contenido compartido entra en el snapshot de cada clase al publicarla. Los cambios
  en borrador no llegan al alumno hasta republicar.
- `GET /classes/{code}`, `POST /classes/{code}/join`,
  `DELETE /classes/{code}/members/{studentKey}` y `GET /classes/{code}/release`.
- Fixture del contrato en `scripts/fixtures/class-release.json` para la fase de MLO.
- Identidad del alumno por UUID estable + nombre; el panel guarda alumno y membresía
  sin crear cuentas ni tocar el login de MLO.
- 9 tests nuevos (30 en total) de composición, hash estable, asignación múltiple,
  snapshot vacío, validación de extras y fixture del contrato.

Hecho del lado de MLO:

- `accounts.external_key` (UUID estable), `account_classes`, `class_cache` y
  `class_extras_cache` en SQLite (versión 17).
- Perfil con varias clases, unirse/salir y sincronización del release de cada clase.
- Bloques extra debajo de la lección; ejercicios extra en la práctica y ejemplos
  extra en su flujo, con la etiqueta de la clase.
- Respaldo v4: restaura el UUID y las clases, vuelve a unir con la identidad
  original y retira la temporal para no duplicar al alumno.
- 363 tests de MLO en verde y fixture real del panel validado con
  `parseClassRelease`.

Pendiente:

- Rate limit y CORS de las rutas de clases.
- Prueba desde la app MLO con `EXPO_PUBLIC_DATA_MODE=hybrid` en un dispositivo.
- Caché por `catalog:{id}` en producción.

### M5 · Cierre — ⬜

- Rate limit de `classes/{code}/join`, CORS para Expo web.
- Despliegue en Vercel + Supabase.
- Manual del maestro y actualización del contrato.

## 5. Verificación

### Automática

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

- Multimedia (el contrato v2 no admite imágenes).
- PWA.
- Borradores e historial por documento.
- Que el maestro modifique el core en su curso.
- Cuentas de alumno en el servidor, calificaciones y sincronización de progreso.
- Expulsar alumnos desde el panel y publicación masiva de todas las clases.
- Edición offline.

## 7. Riesgos y límites

- **M2 fue el punto delicado:** composición, prefijos y hashes. Ya hay tests de ida y
  vuelta y el release del core se validó con el validador real de MLO. Cualquier cambio
  futuro en el contrato debe volver a pasar esa validación.
- **Release base parcial:** MLO archiva lo que no venga en el manifest. Publicar el core
  sin importar antes `base-course.json` dejaría el curso incompleto.
- **Las migraciones no son idempotentes:** se aplican a mano en orden con
  `npm run db:apply -- <archivo>`; un segundo intento falla con "already exists".
- **Ejemplos independientes en MLO:** el motor ya los envuelve como `Exercise` y los
  añade a `items` sin tocar el sorteo de práctica. Hay pruebas con el release real del
  panel (`panelRelease.json`): 25 lecciones aplicadas y `exA1.2` visible. Falta la
  prueba en la app en `hybrid`. El plan está en
  `D:\devvv\MLO\MLO-Ingenieria-software\docs\planes\PLAN-ejemplos-independientes.md`.
  El panel bloquea el tipo `order` para ejemplos independientes.
- **CORS y clases:** las rutas no envían CORS todavía; un cliente nativo no lo necesita,
  Expo web sí. Falta rate limit en `join`, que es la única ruta pública de escritura.
- **Código de clase:** es la única llave para leer el snapshot de la clase. Si se filtra,
  cualquiera con el código puede descargar el contenido (no los nombres de los alumnos).
- **Identidad del alumno:** el UUID vive en la cuenta local de MLO y debe viajar en el
  respaldo. Sin respaldo, una reinstalación crea otra identidad y el alumno aparece
  duplicado en la lista de la clase.
- **Contenido extra publicado:** editar el borrador no cambia lo que ve el alumno hasta
  volver a publicar esa clase.
- **Unidades creadas antes del core:** una unidad con `content_id` `u1` choca con la
  unidad 1 del core. `createUnit` ya numera después del core; los cursos antiguos hay
  que renumerarlos. El curso de prueba se corrigió (`u6`).
- **Cobertura de tests:** 21 tests de bloques, composición, serialización, hashes,
  validación por tipo y lectura de releases; auth, DB y rutas se siguen probando a mano.
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
npm run test         # bloques, composición, hashes, contrato y validación por tipo
npm run lint
npm run build
npm run seed:admin   # requiere ADMIN_* en .env.local
npm run import:base  # importa scripts/fixtures/base-course.json
npm run export:release -- base <ruta>/MLO.../panelRelease.json
npm run db:apply -- supabase/migrations/<archivo>.sql  # en orden
```

En una base nueva se aplican `20261027000000_init.sql`,
`…000001_examples.sql`, `…000002_question_position.sql`,
`…000003_exercise_example_position.sql` y `…000004_classes.sql`.

`scripts/export-base.ts` vive en el repo de MLO. Para regenerar el fixture:

```bash
# desde D:\devvv\MLO\MLO-Ingenieria-software
npx tsx scripts/export-base.ts <ruta>/mlo-teachers/scripts/fixtures/base-course.json
```

Variables en `.env.local` (no versionado): `DATABASE_URL`, `DATABASE_URL_DIRECT`,
`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

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
