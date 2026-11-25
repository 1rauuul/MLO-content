# Tarea 1 — Preservar contenido extra al reimportar el base

Fecha: 2026-11-25
Rama: `chore/pre-deadline-cleanup`

## Estado

Completada. `npm run import:base` ya no borra unidades, temas ni lecciones: hace upsert por
`(course_id, content_id)` y conserva los ids existentes, por lo que `lesson_extras` y
`class_content_changes` sobreviven. Solo se eliminan las filas que ya no están en el fixture.

## Archivos

- `lib/import-base.ts` (nuevo): `applyCourseContent(tx, courseId, data)` con validación del
  fixture, upserts de unidades/temas/lecciones, recreación de hijos y limpieza de filas
  ausentes en orden hijos → padres (lecciones → temas → unidades).
- `scripts/import-base.ts`: conserva `begin`, la búsqueda/creación del curso base, la llamada a
  `applyCourseContent` y la publicación final. Se movió la validación a `lib/import-base.ts`.
- `lib/import-base.db.test.ts` (nuevo): prueba contra la base real de `.env.local` dentro de una
  transacción con rollback forzado. Crea un `lesson_extras`, ejecuta `applyCourseContent` con
  `scripts/fixtures/base-course.json` y comprueba que el extra y los ids de unidades, temas y
  lecciones siguen existiendo.
- `package.json`: `test:db` incluye `lib/import-base.db.test.ts`.
- `docs/superpowers/plans/2026-11-25-cierre-pre-deadline-task1-report.md`: este informe.

## Comandos y resultados

| Comando | Resultado |
| --- | --- |
| `npm test` | 184 tests, 184 pass, 0 fail (~3 s) |
| `npm run test:db` | 12 tests, 12 pass, 0 fail (~72 s; base remota) |
| `npm run lint` | sin errores |
| `npx tsc --noEmit` | sin errores |
| `npm run build` | compilación y TypeScript correctos; 10 páginas generadas |

La prueba de base aislada (`node --env-file=.env.local --import tsx --test
lib/import-base.db.test.ts`) tarda ~38-41 s por las ~150 consultas al pooler remoto.

## Notas y dudas

- No se extrajo lógica de diff a JavaScript: la limpieza usa `not in (select value from
  jsonb_array_elements_text(...))`, por lo que no se añadió una prueba pura adicional (no hay
  capa nueva que probar).
- Si el `content_id` de una lección cambia en el fixture, se interpreta como lección nueva: la
  anterior se borra (y con ella sus extras por `on delete cascade`). Es el mismo criterio de
  identidad que usa el resto del CMS.
- Los hijos (`questions`, `examples`, `exercises`, `evaluations`) se siguen recreando, así que
  sus ids cambian en cada importación; solo se garantizan los ids de unidades, temas y lecciones.
- La primera ejecución de la prueba falló con `function json_array_elements_text(jsonb) does not
  exist`; se corrigió usando `jsonb_array_elements_text`, que es el tipo que envía `tx.json`.
