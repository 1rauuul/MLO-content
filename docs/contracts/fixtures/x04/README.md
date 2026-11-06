# Fixtures · X-04 (grupo y publicación)

Release v3 real de grupo, generado con `buildGroupRelease` desde
`lib/content/x04-fixtures.ts`. La prueba `lib/content/group-release.test.ts`
recompone el archivo y falla si diverge.

## Política

- UTF-8 sin BOM, saltos LF.
- SHA-256 sobre bytes UTF-8 con CRLF normalizado a LF.
- Sin datos reales de alumnos.

## Archivos

| Archivo | Propósito | SHA-256 |
|---|---|---|
| `group-release.json` | Release `kind:"group"` con `courseRef`, 1 unidad/1 subtema/1 lección propia, 1 ejercicio, 1 ejemplo, 1 evaluación con pregunta y un `addition` de bloques | `d9fde2c6acade448dd59c67c6389b1dbb6ea733bcf0f8835ad6a41bfc91a04e6` |

## Uso desde MLO

Copiar a `src/shared/services/content/remote/__fixtures__/v3/x04/` y verificar el
hash con normalización CRLF→LF. Es el cuerpo de
`GET /api/mlo/v3/classes/{code}/release` para un miembro activo.
