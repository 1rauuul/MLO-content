# Tarea 7 — Documentación final (informe)

**Fecha:** 2026-11-26
**Rama:** `chore/pre-deadline-cleanup`
**Alcance:** solo documentación. No se tocó código, no se hizo push y no se ejecutó
ningún build de EAS.

## Cambios en el CMS (`mlo-teachers`)

| Archivo | Cambio |
|---|---|
| `README.md` | Estado actual (v3 única, grupos, cuentas), rutas reales (`/grupos`, `/cursos/[id]/temas/[topicId]`), tabla de API solo v3, migraciones, tests, CI y variables de entorno (`CORS_ALLOWED_ORIGIN`, `MEDIA_SECRET`, `APP_BASE_URL`). |
| `PLAN.md` | `/clases` → `/grupos`; M3B y M4 completados; M5 como solo despliegue/operación; sección 8 y 5 actualizadas; registro 2026-11-26 añadido. Se conserva el historial. |
| `DESPLIEGUE-GCLOUD.md` | Flujo con `db:migrate`/`--baseline`, CI (`test`, `lint`, `tsc`, `build`), `CORS_ALLOWED_ORIGIN`, rate limit de `join` y nota de que v2 ya no se sirve. |
| `PLAN-CMS-CURSOS-COMPLETOS.md` | `/clases` → `/grupos` y paso de despliegue sin v2. |
| `DATABASE teacher.md` | Aclarado que el snapshot v2 es histórico y la API servida es v3. |
| `docs/contracts/mlo-v3.md` | Estado implementado, v2 marcada como retirada y apartados 10 y 13.7 marcados como históricos. |

## Cambios en la app (`MLO-Ingenieria-software`)

| Archivo | Cambio |
|---|---|
| `README.md` | Offline-first con contenido remoto y cuentas, cliente v3, SecureStore, CI y EAS preview/production. |
| `AGENTS.md` | Contrato v3 y aclaración de `local` por defecto frente a `hybrid` en distribución. |
| `docs/estado/linea-de-tiempo.md` | Entrada 2026-11-26, estado del repositorio y pendientes (build y prueba en dispositivo). |
| `docs/estado/historial-cms.md` | Entrada 2026-11-26 con panel, app y verificación. |
| `docs/estado/estado-proyecto.md` | Aviso de documento histórico y remisión a la línea de tiempo. |
| `docs/estado/siguientes-pasos.md` | Aviso de documento histórico y remisión a la línea de tiempo. |
| `docs/estado/decisiones-alcance.md` | Nueva decisión C12 (cuentas remotas, v3 única, SecureStore, CI) que actualiza C9/C10. |
| `docs/api/contrato.md`, `docs/api/contrato-contenido-cms.md`, `docs/api/decisiones-contrato-cms.md` | Aviso de documentos históricos v2 y remisión al contrato v3. |
| `docs/contenido/como-agregar-contenido.md` | Ruta B actualizada a v3, endpoints reales y reglas del contrato; Ruta A marcada como histórica. |
| `status/PlanDesarrollo.md` | Aviso de plan histórico. |

## Verificación

- Comandos documentados comprobados contra `package.json` de cada repo (`dev`, `test`,
  `test:db`, `lint`, `build`, `db:migrate`, `db:apply`, `seed:admin`, `import:base`,
  `export:release`; `start`, `android`, `web`, `demo:web`, `demo:web:serve`, `demo:apk`,
  `test`, `lint`).
- `npm test` del CMS: 185 pruebas por descubrimiento automático (`lib/**/*.test.ts`,
  excluye `*.db.test.ts`).
- `test:db`: 13 pruebas, incluida la E2E HTTP v3 de preview, join, release y manifest.
- App: 581 pruebas; `tsc` y lint sin errores según la verificación de la entrega.
- No se ejecutaron suites completas ni builds EAS durante esta tarea.

## Discrepancias y notas

- `docs/reporte/capitulo-3-desarrollo.md` y `capitulo-4-resultados.md` conservan un
  corte anterior al 24–26 de noviembre y aún describen la app sin cuentas remotas y con
  contrato v2. Se dejaron como registro del corte; conviene actualizarlos o añadir una
  nota de alcance antes de entregar el reporte.
- `docs/diagramas-mlo.md` sigue citando Expo SDK 57 y las tablas `remote_catalogs`/
  `remote_lessons`, que ya no existen. No se tocó por estar fuera del alcance de la
  tarea.
- `docs/contenido/apk-con-contenido-remoto.md` describe el despliegue pendiente del
  servidor; se conserva como guía operativa, pero su estado ya no es el actual.
- Las referencias entre repositorios se dejaron como rutas de texto
  (`mlo-teachers/docs/contracts/mlo-v3.md`) porque ambos repos no comparten un mismo
  árbol relativo.
