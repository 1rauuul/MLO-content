# Fixtures · X-02 (API v3 de cursos y acceso)

Fixtures de productor para la API de descubrimiento v3. Se generan con
`lib/content/v3.ts` y `lib/content/x02-fixtures.ts`; la prueba
`lib/content/v3.test.ts` recompone ambos archivos y falla si divergen.

## Política de archivos

- UTF-8 sin BOM, saltos LF.
- SHA-256 sobre los bytes UTF-8 con CRLF normalizado a LF.
- Ambos repos usan `core.autocrlf=true`.
- Los fixtures no contienen datos reales de alumnos.

## Archivos

| Archivo | Propósito | SHA-256 |
|---|---|---|
| `course-list.json` | Respuesta de `GET /api/mlo/v3/courses` con el base y un curso vacío autorizado | `1cd49563defad51f900b709a5154be3c9d89957fa2a7ab4a54768b2a61cbd6f6` |
| `manifest-empty.json` | Release v3 metadata-completo con colecciones vacías (`snapshot.release` del manifiesto) | `016248a4ed7b8d5d77aa42889a12ce21cd808c6412518af3092fdad1008b8729` |

## Uso desde MLO

Copiar ambos JSON a
`src/shared/services/content/remote/__fixtures__/v3/x02/` y verificar los hashes
con la misma normalización CRLF→LF. El manifiesto corresponde al cuerpo de
`GET /api/mlo/v3/catalogs/{catalogId}/manifest`; la lista, al cuerpo de
`GET /api/mlo/v3/courses`.
