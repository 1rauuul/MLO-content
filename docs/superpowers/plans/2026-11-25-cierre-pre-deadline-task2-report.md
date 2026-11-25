# Tarea 2 — API v3 única, rate limit de join y CORS (informe)

**Repo:** `D:\devvv\MLO-content\mlo-teachers` · rama `chore/pre-deadline-cleanup`
**Commit:** `0d8b18d feat(api): mover clases a v3 y retirar la API v2`
**Estado:** completada

## Cambios

| Archivo | Cambio |
| --- | --- |
| `app/api/mlo/v3/classes/[code]/route.ts` | Vista previa movida desde v2; mismo `classPreviewPayload` (`schemaVersion: 2`). |
| `app/api/mlo/v3/classes/[code]/join/route.ts` | Join movido a v3 y rate limit `class_join` antes de leer el cuerpo y escribir. 429 `{ error: "rate_limited", message }` con CORS y `no-store`. |
| `app/api/mlo/v3/classes/[code]/members/[studentKey]/route.ts` | Salida de grupo movida a v3; mismo 204. |
| `app/api/mlo/v2/**` | Eliminado completo (preview, join, members, release y catálogos v2). |
| `lib/rate-limit.ts` | `classJoinIp` 100/15 min, `classJoinGlobal` 100/15 min y scope `class_join`. |
| `lib/rate-limit.test.ts` / `lib/rate-limit.db.test.ts` | Reglas y 40 joins por IP; el test de base ahora corre los cuatro scopes en paralelo. |
| `lib/api/cors.ts` | `CORS_ALLOWED_ORIGIN` (singular), valor calculado al cargar el módulo y `Vary: Origin`. Sin variable: `*` en desarrollo y sin cabecera en producción. |
| `lib/api/cors.test.ts` | Cobertura del origen de desarrollo, el configurado y producción sin variable. |
| `lib/content/releases.ts` + test | Eliminados junto con `getLatestRelease`, `manifestFrom` y `lessonFrom`. |
| `lib/content/v3-api.ts` / `lib/content/v3.ts` + tests | Eliminados `hasV2CatalogAccess` y `canAccessV2Catalog`. |
| `lib/classes.ts` | Eliminado `getClassSnapshotByCode`, que quedó sin uso. Se conserva `isStudentKey`. |
| `supabase/migrations/20261125000006_auth_rate_limits_class_join.sql` | Añade `class_join` al check de `auth_rate_limits`; sin esta migración el join falla con 23514. |
| `.env.example` | `# CORS_ALLOWED_ORIGIN=` comentado y documentado. |

Las tablas legacy `releases` y `class_releases` y su escritura interna siguen intactas.

## Verificación

| Comando | Resultado |
| --- | --- |
| `npm test` | 183 tests — OK |
| `npm run lint` | sin errores |
| `npx tsc --noEmit` | sin errores (tras `next typegen`; los tipos viejos de `.next` aún listaban rutas v2) |
| `npm run build` | OK; ya no aparecen rutas v2 |
| `npm run test:db` | 12 tests — OK (~37 s) |

La migración se aplicó a la base local con `npm run db:apply -- supabase/migrations/20261125000006_auth_rate_limits_class_join.sql`. En el primer `test:db` el check viejo rechazó `class_join`; quedó resuelto con esa migración.

## Riesgos / notas

- **Despliegue:** hay que aplicar la migración nueva antes de publicar el join v3. Sin ella, la API devuelve 500 al insertar el rate limit.
- **Límite global:** 100 joins cada 15 minutos para todo el servicio. Es lo pedido, pero un arranque masivo de varios grupos a la vez puede recibir 429.
- **CORS:** el plan global mencionaba `CORS_ALLOWED_ORIGINS` (plural); seguí la instrucción de la tarea, que pide `CORS_ALLOWED_ORIGIN` (singular). En producción, sin esa variable, el navegador no recibe `Access-Control-Allow-Origin` (la app nativa no usa CORS).
- **Contrato:** no cambió el payload de las clases (`schemaVersion: 2`) ni el contrato v3.
- **Cliente viejo:** cualquier instalación que aún llame a `/api/mlo/v2` dejará de funcionar; se confirmó que no quedan APKs ni usos activos.
- `Vary: Origin` pasa a acompañar también las respuestas de `/api/media`, por lo que su caché varía por origen.
