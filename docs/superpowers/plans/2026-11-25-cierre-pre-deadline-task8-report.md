# Tarea 8 — E2E HTTP real contra `next start` (informe)

**Fecha:** 2026-11-26
**Rama:** `chore/pre-deadline-cleanup`
**Alcance:** solo pruebas y documentación. No se tocó la app, no se hizo push/merge y no
se ejecutó ningún build de EAS.

## Cambios

| Archivo | Cambio |
|---|---|
| `lib/api/e2e-fixtures.ts` | Nuevo: `seedE2EFixture()` / `cleanupE2EFixture()` con el curso, grupo, release y extra temporales. La limpieza es idempotente y también corre si la siembra falla a medias. |
| `lib/api/e2e.db.test.ts` | Usa el fixture compartido; se conservan las aserciones de preview, join, release, cursos y manifest (163 líneas menos). |
| `scripts/e2e-http.ts` | Nuevo: exige `.next/BUILD_ID`, siembra, arranca `node next start -p 3107` (o el primer puerto libre) con `CORS_ALLOWED_ORIGIN=https://web.e2e.test`, espera hasta 60 s y hace peticiones `fetch` reales. En `finally` mata el servidor, limpia filas y cierra la conexión. |
| `package.json` | `test:e2e` = build + `next start` real. |
| `README.md`, `PLAN.md` | Una línea documentando `npm run test:e2e`. |

## Qué cubre

- `OPTIONS /api/mlo/v3/classes/{code}/join`: 204 y `Access-Control-Allow-Origin`.
- `GET /api/mlo/v3/classes/{code}`: 200 y CORS.
- `POST .../join` real: 200, `joined: true` y CORS.
- `GET .../release` con `X-MLO-Student-Key`: 200.
- `GET /api/mlo/v3/courses` y `GET /api/mlo/v3/catalogs/{catalogId}/manifest`: 200.
- Clase inexistente: 404.

El build se genera antes de arrancar; el puerto empieza en 3107 y sube si está ocupado.
En Windows el servidor se mata con `taskkill /T /F` para no dejar hijos.

## Verificación

| Comando | Resultado |
|---|---|
| `npm run test:e2e` | Build + `OPTIONS join: 204`, `GET preview: 200`, `POST join: 200`, `GET release: 200`, `GET courses: 200`, `GET manifest: 200`, `GET clase inexistente: 404` |
| `npm run test:db` | 13/13 |
| `npm test` | 186/186 |
| `npm run lint` | Sin errores |
| `npx tsc --noEmit` | Sin errores |

Comprobado después de la ejecución: puerto 3107 libre, sin procesos `next start` de la
prueba y 0 filas `e2e-*` en `teachers`, `courses`, `classes` y `auth_rate_limits`.

## Riesgos y notas

- `test:e2e` requiere `DATABASE_URL` (`.env.local`) y un build correcto; no corre en CI.
- La limpieza borra las filas `class_join` globales creadas desde el inicio de la prueba;
  es el mismo criterio que ya usaba `test:db` y asume que no hay otra suite de join
  concurrente.
- La prueba fija el origen configurado. El caso “producción sin `CORS_ALLOWED_ORIGIN` no
  envía cabecera” sigue cubierto por `lib/api/cors.test.ts`, no por HTTP real.
