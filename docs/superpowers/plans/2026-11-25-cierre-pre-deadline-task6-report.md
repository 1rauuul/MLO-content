# Tarea 6 — Prueba HTTP de integración v3 (informe)

**Fecha:** 2026-11-25
**Rama:** `chore/pre-deadline-cleanup`
**Commit:** `03acb08 test(api): cubrir el flujo v3 de curso, grupo y join`

## Estado

Completada. `lib/api/e2e.db.test.ts` recorre contra la base real de `.env.local`:
docente temporal → curso (clave de 5) → unidad → tema → lección → `publishCourse` →
grupo con `newJoinCode()` → `lesson_extras` + `extra_classes` → `publishClassRelease`.
Después invoca directamente los handlers v3 (sin servidor HTTP):

- `GET /classes/[code]` (preview): 200 y curso/código correctos.
- `POST /classes/[code]/join` con `x-forwarded-for` aleatorio: 200 y `joined`.
- `GET /classes/[code]/release` con `X-MLO-Student-Key`: 200, `kind: "group"`,
  `catalogId` del curso padre y la adición del extra en `additions`.
- `GET /courses` con `X-MLO-Student-Key`: 200 e incluye el curso publicado.
- `GET /catalogs/[catalogId]/manifest` con `X-MLO-Student-Key`: 200 y `kind: "course"`.

El `finally` borra la clase, las lecciones/temas/unidades, el curso de contenido,
el curso padre, el docente y el alumno; también las claves de rate limit del join
(la clave de la IP del test y la fila global creada durante la prueba). Se comprobó
después de `npm run test:db` que no quedan filas con los nombres `E2E`.

## Archivos

- `lib/api/e2e.db.test.ts` (nuevo).
- `package.json`: `lib/api/e2e.db.test.ts` añadido a `test:db`.
- Este informe (sin commitear, según la nota de coordinación: el otro agente trabaja en docs).

## Verificación

| Comando | Resultado |
| --- | --- |
| `node --env-file=.env.local --import tsx --test lib/api/e2e.db.test.ts` | 1 test, pass (~16-19 s) |
| `npm run test:db` | 13 tests, 13 pass, 0 fail (~39 s) |
| `npm test` | 185 tests, 185 pass, 0 fail |
| `npm run lint` | sin errores |
| `npx tsc --noEmit` | sin errores |

No se ejecutó ningún build EAS ni push.

## Riesgos y notas

- La prueba escribe y borra filas reales (docente, curso, grupo, alumno). Si el
  proceso muere con SIGKILL antes del `finally`, quedan filas con nombres `E2E`;
  se pueden localizar por ese texto. El caso normal no deja residuos (verificado).
- Invoca los handlers directamente: cubre request/response, autorización y SQL,
  pero no el enrutado de Next ni CORS.
- El join consume una entrada del limitador global `class_join` (1000/15 min); la
  fila creada durante el test se elimina, pero si la base ya estuviera cerca del
  límite la prueba fallaría con 429.
- La prueba tarda por el pooler remoto (~16-19 s), no por esperas artificiales.
