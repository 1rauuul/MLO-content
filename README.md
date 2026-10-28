# MLO · Maestros

Plan y estado del proyecto: [`PLAN.md`](PLAN.md).

Panel para que cada maestro agregue contenido propio (unidades, lecciones, ejercicios y evaluaciones)
sobre el **core** del curso. La app MLO descarga el resultado por el contrato v2
(`docs/api/contrato.md` del repositorio base).

El core se guarda una sola vez y es compartido. El curso de un maestro guarda solo sus
aportaciones; al publicar, el servidor compone **core + adicionales** en un snapshot inmutable.

## Estado

**M3A · Ejercicios y ejemplos.** Además de M0/M1/M2: pestañas en la lección, ejercicios
`order`, `fill`, `match` y `crossword`, la opción “Añadir como ejemplo”, ejemplos
independientes, vista previa y validación estricta al publicar. Los ejemplos
independientes no admiten `order` (el contrato no lleva `correctOrder`).

**M4A · Clases y contenido extra.** Cada maestro crea clases con un código fijo, agrega
bloques/ejemplos/ejercicios a lecciones del core y los asigna a una o varias clases. La
publicación es un snapshot inmutable por clase que MLO descargará y guardará para usar
sin conexión. También están `GET /catalogs/{catalogId}/manifest` y
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
   - `DATABASE_URL_DIRECT`: cadena directa (puerto 5432), para migraciones.
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

3. Aplica las migraciones **en orden**. Pega cada archivo de
   `supabase/migrations/` en el **SQL Editor** de Supabase (o usa
   `npm run db:apply -- <archivo>`). Son `20261027000000_init.sql`,
   `…000001_examples.sql`, `…000002_question_position.sql`,
   `…000003_exercise_example_position.sql` y `…000004_classes.sql`.

4. Crea el administrador:

   ```bash
   npm run seed:admin
   ```

5. Importa el contenido del core (el fixture ya está versionado):

   ```bash
   npm run import:base
   ```

6. Arranca:

   ```bash
   npm run dev
   ```

Entra en http://localhost:3000 y usa el correo y la contraseña del paso 2.

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
| `/login` | público | Entrar |
| `/mis-cursos` | maestro | Core (lectura) y cursos propios |
| `/cursos/[id]` | maestro | Unidades y lecciones; agregar contenido |
| `/cursos/[id]/lecciones/[id]` | dueño | Editar texto y bloques |
| `/cursos/[id]/publicar` | dueño / admin | Crear un release inmutable |
| `/clases` | maestro | Crear clases y ver sus códigos |
| `/clases/[id]` | dueño / admin | Alumnos, contenido y publicación por clase |
| `/contenido-extra` | dueño / admin | Bloques, ejemplos y ejercicios asignados a clases |
| `/admin/maestros` | admin | Alta de cuentas |

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
- Las sesiones se guardan en la base; la cookie solo lleva un token aleatorio y en la
  base queda su SHA-256.
- `cacheComponents` está desactivado: el panel es dinámico y autenticado, PPR no aporta.
