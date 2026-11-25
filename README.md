# MLO · Maestros

Plan y estado del proyecto: [`PLAN.md`](PLAN.md).

Panel para que cada maestro agregue contenido propio (unidades, lecciones, ejercicios y evaluaciones)
sobre el **contenido base** del curso. La app MLO descarga el resultado por el contrato v2
(`docs/api/contrato.md` del repositorio base).

El contenido base se guarda una sola vez y es compartido. El curso de un maestro guarda
solo sus aportaciones; al publicar, el servidor compone **contenido base + adicionales**
en un snapshot inmutable.

## Estado

**M3A · Ejercicios y ejemplos.** Además de M0/M1/M2: pestañas en la lección, ejercicios
`order`, `fill`, `match` y `crossword`, la opción “Añadir como ejemplo”, ejemplos
independientes, vista previa y validación estricta al publicar. Los ejemplos
independientes no admiten `order` (el contrato no lleva `correctOrder`).

**M4A · Grupos y contenido extra.** Cada maestro crea grupos con un código fijo, agrega
bloques/ejemplos/ejercicios a lecciones del contenido base y los asigna a uno o varios
grupos. La publicación es un snapshot inmutable por grupo que MLO descargará y guardará
para usar sin conexión. También están `GET /catalogs/{catalogId}/manifest` y
`GET /catalogs/{catalogId}/lessons/{lessonId}`.

El motor de ejemplos independientes de MLO ya está corregido y probado con el release
real del panel. MLO ya tiene identidad estable, caché de clases, contenido extra y
respaldo v4 con reconciliación de duplicados. Pendiente: M3B (evaluación y preguntas) y
la prueba en la app en modo `hybrid` en un dispositivo.

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

3. Aplica las migraciones. Ya no se pegan una por una:

   ```bash
   npm run db:migrate            # aplica las pendientes y las registra
   npm run db:migrate -- --status
   ```

   En una base que ya tenía el esquema aplicado a mano, ejecuta **una sola vez**
   `npm run db:migrate -- --baseline`: marca los archivos actuales como aplicados sin
   ejecutarlos. `npm run db:apply -- <archivo>` queda solo para casos puntuales.

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
npm test        # bloques, composición, hashes, contrato y validación por tipo
npm run lint
npm run build
```

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
| `/mis-cursos` | maestro | Contenido base (lectura) y cursos propios |
| `/mis-cursos/crear` | maestro | Alta de un curso |
| `/cursos/[id]` | maestro | Unidades y lecciones; agregar contenido |
| `/cursos/[id]/lecciones/[id]` | dueño | Editar texto y bloques |
| `/cursos/[id]/publicar` | dueño / admin | Crear un release inmutable |
| `/grupos` | maestro | Crear grupos y ver sus códigos |
| `/grupos/[id]` | dueño / admin | Alumnos, contenido y publicación por grupo |
| `/contenido-extra` | dueño / admin | Contenido del grupo y aportaciones asignadas a grupos |
| `/admin/maestros` | admin | Invitar maestros y reenviar invitaciones |

### API para MLO

Solo lectura del último release, sin autenticación:

| Ruta | Qué devuelve |
|---|---|
| `GET /api/mlo/v2/catalogs/{catalogId}/manifest` | Manifest del último release |
| `GET /api/mlo/v2/catalogs/{catalogId}/lessons/{lessonId}` | Payload completo de la lección |
| `GET /api/mlo/v2/classes/{code}` | Vista previa y última versión de la clase |
| `POST /api/mlo/v2/classes/{code}/join` | Unir un alumno por UUID + nombre |
| `DELETE /api/mlo/v2/classes/{code}/members/{studentKey}` | Salir de la clase |
| `GET /api/mlo/v2/classes/{code}/release` | Snapshot publicado de la clase |

### Cuentas de alumno

| Ruta | Qué hace |
|---|---|
| `POST /api/mlo/v3/auth/register` | Alta con usuario, contraseña y nombre; devuelve token |
| `POST /api/mlo/v3/auth/login` | Login; devuelve token Bearer |
| `POST /api/mlo/v3/auth/logout` | Revoca la sesión |
| `GET/PUT /api/mlo/v3/students/me/progress` | Progreso del alumno autenticado |
| `GET /api/mlo/v3/students/me/classes` | Clases del alumno autenticado |

Las rutas de progreso y clases aceptan `Authorization: Bearer`; durante la
transición también siguen aceptando `X-MLO-Student-Key`. Las cuentas nuevas usan
scrypt y sesiones de 30 días guardadas en `student_sessions`.

`404` si el curso no tiene release, la lección no está en el snapshot o la clase no
tiene nada publicado. El snapshot de clase solo lleva contenido extra; MLO lo combina
con el curso base y lo guarda localmente para funcionar sin conexión. Hay un ejemplo
del contrato en `scripts/fixtures/class-release.json`.

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
