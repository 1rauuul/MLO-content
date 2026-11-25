# Tarea 5 — Cliente v3, EAS production y CI/CD (informe)

**Fecha:** 2026-11-25
**Repo:** `D:\devvv\MLO\MLO-Ingenieria-software` (rama `chore/pre-deadline-cleanup`)
**Commit:** `2671629 feat(api): usar solo la API v3 y configurar CI/CD`

## Qué se hizo

- `src/shared/services/http/client.ts`: `apiBaseUrl()` es la base v3 sin transformar. Se eliminaron `apiV3BaseUrl`, el cliente v2 `http` y la conversión `/v2` → `/v3`. `httpV3`, `httpAuth` y `httpRecovery` usan `apiBaseUrl()`.
- `src/shared/services/data/DataProvider.tsx`: `fetchClassPreview`, `joinClass` y `leaveClass` usan `httpV3`; el import de `http` desapareció.
- `src/shared/services/content/ContentSyncProvider.tsx`: `refreshClassMemberships` usa `httpV3`; sin import de `http` ni comentario de vista previa v2.
- Tests: `client.test.ts` ya no prueba la conversión v2→v3 (verifica que la base v3 se conserva); los mocks de `ContentSyncProvider` y `updateNotice` ya no declaran `http`.
- `.env.example`: base de ejemplo `http://<host>:3000/api/mlo/v3` y nota con la URL de producción. `.env` local actualizado a `https://mlo-enrichment.vercel.app/api/mlo/v3` (gitignored, no se commitea). `.env.local` no contiene `EXPO_PUBLIC_API_URL`, así que no se tocó.
- `eas.json`: `build.preview` y `build.production` con `EXPO_PUBLIC_DATA_MODE=hybrid` y `EXPO_PUBLIC_API_URL=https://mlo-enrichment.vercel.app/api/mlo/v3`.
- `.github/workflows/ci.yml`: Node 22, `npm ci`, `npx tsc --noEmit`, `npx jest --runInBand`, `npm run lint` en push y PR.
- `.github/workflows/eas-preview.yml`: solo `workflow_dispatch`, `EXPO_TOKEN` desde secrets y `npx --yes eas-cli build --platform android --profile preview --non-interactive`.
- Docs de la app: base v3 en `docs/api/contrato.md` y `docs/contenido/apk-con-contenido-remoto.md` (env de preview/production, prueba de humo y tabla de estado). Los planes históricos de `docs/planes/` conservan menciones a v2 como registro.

## Verificación

- `npx jest --silent`: 83 suites, 581 tests, todo en verde.
- `npx tsc --noEmit`: sin errores.
- `npm run lint`: sin errores.
- `grep` en `src`: sin `apiV3BaseUrl`, sin `api/mlo/v2` y sin el cliente `http` v2.
- No se ejecutó ningún build EAS; no se tocó `versionCode` ni `remoteSessionRepository.ts`.

## Riesgos / pendientes

1. **La API de clases v3 aún no existe en el CMS.** En el HEAD actual del CMS solo hay `classes/[code]/release`; faltan la vista previa y `join`/`leave` v3 (Tarea 2 del plan del CMS). Hasta que se desplieguen, `fetchClassPreview`, unirse y salir darán 404 (el error se captura y se registra; la app no cae). Es un requisito de coordinación entre ambos repos.
2. El workflow de EAS usa `npx --yes eas-cli` sin versión fijada: el primer run descarga la última CLI. Requiere el secret `EXPO_TOKEN` en GitHub.
3. El CI no tiene `.env`; `expo lint` avisa de que no hay variables, pero no falla. Jest no depende de ellas.
4. `.gitignore` (que añade `.env*`) y `eas-build-preview.json` (artefacto de un build manual previo) quedaron fuera del commit: son cambios de trabajo previos, no de esta tarea.
